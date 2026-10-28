"""notebook 도메인 - 서비스 계층 (샘플앱).

학습장 업로드·조회·수정·삭제. 트랜잭션 경계는 여기다.
"""

import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.domain.notebook.models import Notebook, NotebookTopic
from app.domain.notebook.parser import join_tags, parse_notebook
from app.domain.notebook.repositories import NotebookRepository, TopicRepository
from app.domain.notebook.schemas import TopicCreate, TopicUpdate

logger = logging.getLogger(__name__)

DUPLICATE_MESSAGE = (
    "같은 프로젝트의 같은 파일을 이미 올렸습니다. 기존 학습장을 삭제한 뒤 다시 올려 주세요."
)
MAX_FILENAME = 200


def blank_to_none(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def apply_kept(topic: NotebookTopic, kept: bool) -> None:
    """보관함에 넣거나 뺀다. 보관 시각은 넣을 때만 기록한다."""
    topic.kept = kept
    topic.kept_at = datetime.now(UTC) if kept else None


def base_filename(filename: str) -> str:
    """경로가 섞여 와도 파일 이름만 남긴다."""
    name = filename.replace("\\", "/").rsplit("/", 1)[-1].strip()
    return (name or "notebook.md")[:MAX_FILENAME]


class NotebookService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.notebooks = NotebookRepository(db)
        self.topics = TopicRepository(db)

    # ----- 학습장 -----

    def list_notebooks(self, user_id: uuid.UUID) -> list[Notebook]:
        return self.notebooks.list_for_user(user_id)

    def get_notebook(self, notebook_id: uuid.UUID, user_id: uuid.UUID) -> Notebook:
        notebook = self.notebooks.get_owned(notebook_id, user_id)
        if notebook is None:
            raise NotFoundError("학습장을 찾을 수 없습니다.")
        return notebook

    def upload(self, user_id: uuid.UUID, filename: str, content: str) -> Notebook:
        """마크다운 파일 하나를 학습장 1개 + 주제 N개로 저장한다."""
        # 내용이 없으면 400. DB를 건드리기 전에 끝난다.
        parsed = parse_notebook(content, filename)
        name = base_filename(filename)
        if (
            parsed.project is not None
            and self.notebooks.get_by_project_filename(user_id, parsed.project, name) is not None
        ):
            # 중복 정책: 같은 프로젝트의 같은 파일만 거부(앱에서 고친 내용·완료 표시 보호).
            # project가 없는 일반 md는 항상 추가된다.
            # 덮어쓰기로 바꾸려면 여기서 기존 학습장을 지우면 된다.
            raise ConflictError(DUPLICATE_MESSAGE)
        try:
            notebook = self.notebooks.create(
                user_id,
                title=parsed.title,
                filename=name,
                project=parsed.project,
                summary=parsed.summary,
            )
            notebook_id = notebook.id
            self.topics.add_many(
                notebook_id,
                [
                    {
                        "position": position,
                        "title": topic.title,
                        "kind": topic.kind,
                        "tags": join_tags(topic.tags),
                        "difficulty": topic.difficulty,
                        "content": topic.content,
                    }
                    for position, topic in enumerate(parsed.topics, start=1)
                ],
            )
            self.db.commit()
        except IntegrityError as exc:
            # 같은 파일을 거의 동시에 두 번 올린 경우
            self.db.rollback()
            raise ConflictError(DUPLICATE_MESSAGE) from exc
        logger.info(
            "notebook_uploaded user_id=%s notebook_id=%s topics=%s",
            user_id,
            notebook_id,
            len(parsed.topics),
        )
        return self.get_notebook(notebook_id, user_id)

    def create_notebook(self, user_id: uuid.UUID, title: str) -> Notebook:
        """업로드 없이 직접 쓰는 빈 학습장."""
        notebook = self.notebooks.create(user_id, title=title.strip(), filename=None)
        notebook_id = notebook.id
        self.db.commit()
        logger.info("notebook_created user_id=%s notebook_id=%s", user_id, notebook_id)
        return self.get_notebook(notebook_id, user_id)

    def rename_notebook(self, notebook_id: uuid.UUID, user_id: uuid.UUID, title: str) -> Notebook:
        notebook = self.get_notebook(notebook_id, user_id)
        notebook.title = title.strip()
        self.db.commit()
        return notebook

    def delete_notebook(self, notebook_id: uuid.UUID, user_id: uuid.UUID) -> None:
        """주제는 ORM cascade(그리고 FK ON DELETE CASCADE)로 함께 지워진다."""
        self.notebooks.delete(self.get_notebook(notebook_id, user_id))
        self.db.commit()
        logger.info("notebook_deleted user_id=%s notebook_id=%s", user_id, notebook_id)

    # ----- 주제 -----

    def get_topic(self, topic_id: uuid.UUID, user_id: uuid.UUID) -> NotebookTopic:
        topic = self.topics.get_owned(topic_id, user_id)
        if topic is None:
            raise NotFoundError("주제를 찾을 수 없습니다.")
        return topic

    def create_topic(
        self, notebook_id: uuid.UUID, user_id: uuid.UUID, payload: TopicCreate
    ) -> NotebookTopic:
        notebook = self.get_notebook(notebook_id, user_id)
        topic = self.topics.create(
            notebook.id,
            position=self.topics.next_position(notebook.id),
            title=payload.title,
            kind=blank_to_none(payload.kind),
            tags=join_tags(payload.tags),
            difficulty=payload.difficulty,
            content=payload.content,
        )
        self.db.commit()
        return topic

    def update_topic(
        self, topic_id: uuid.UUID, user_id: uuid.UUID, patch: TopicUpdate
    ) -> NotebookTopic:
        """보낸 필드만 바꾼다. 유형을 빈 문자열로 보내면 '없음'이 된다."""
        topic = self.get_topic(topic_id, user_id)
        changed = patch.model_fields_set
        if "title" in changed and patch.title is not None:
            topic.title = patch.title
        if "content" in changed and patch.content is not None:
            topic.content = patch.content
        if "kind" in changed:
            topic.kind = blank_to_none(patch.kind)
        if "tags" in changed and patch.tags is not None:
            topic.tags = join_tags(patch.tags)
        if "difficulty" in changed:
            topic.difficulty = patch.difficulty
        if "completed" in changed and patch.completed is not None:
            topic.completed = patch.completed
        if "kept" in changed and patch.kept is not None:
            apply_kept(topic, patch.kept)
        self.db.commit()
        return topic

    def set_kept(
        self, topic_ids: list[uuid.UUID], user_id: uuid.UUID, kept: bool
    ) -> list[NotebookTopic]:
        """여러 주제를 한 번에 보관/해제한다. 하나라도 남의 것이거나 없으면 전부 거부한다."""
        wanted = list(dict.fromkeys(topic_ids))  # 순서를 지키며 중복 제거
        topics = self.topics.list_owned(wanted, user_id)
        if len(topics) != len(wanted):
            raise NotFoundError("주제를 찾을 수 없습니다.")
        by_id = {topic.id: topic for topic in topics}
        ordered = [by_id[topic_id] for topic_id in wanted]
        for topic in ordered:
            apply_kept(topic, kept)
        self.db.commit()
        logger.info("notebook_topics_kept user_id=%s count=%s kept=%s", user_id, len(ordered), kept)
        return ordered

    def delete_topic(self, topic_id: uuid.UUID, user_id: uuid.UUID) -> None:
        self.topics.delete(self.get_topic(topic_id, user_id))
        self.db.commit()
