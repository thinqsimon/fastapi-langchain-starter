"""notebook 도메인 - 데이터 접근 계층."""

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.domain.notebook.models import Notebook, NotebookTopic


class NotebookRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_for_user(self, user_id: uuid.UUID) -> list[Notebook]:
        return list(
            self.db.scalars(
                select(Notebook)
                .where(Notebook.user_id == user_id)
                .options(selectinload(Notebook.topics))
                .order_by(Notebook.created_at.desc())
            )
        )

    def get_owned(self, notebook_id: uuid.UUID, user_id: uuid.UUID) -> Notebook | None:
        """남의 학습장은 아예 조회되지 않게 소유자 조건을 쿼리에 넣는다."""
        return self.db.scalar(
            select(Notebook)
            .where(Notebook.id == notebook_id, Notebook.user_id == user_id)
            .options(selectinload(Notebook.topics))
        )

    def get_by_filename(self, user_id: uuid.UUID, filename: str) -> Notebook | None:
        return self.db.scalar(
            select(Notebook).where(Notebook.user_id == user_id, Notebook.filename == filename)
        )

    def create(self, user_id: uuid.UUID, **fields: object) -> Notebook:
        notebook = Notebook(user_id=user_id, **fields)
        self.db.add(notebook)
        self.db.flush()
        return notebook

    def delete(self, notebook: Notebook) -> None:
        self.db.delete(notebook)
        self.db.flush()


class TopicRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_owned(self, topic_id: uuid.UUID, user_id: uuid.UUID) -> NotebookTopic | None:
        """주제는 학습장을 통해 소유자를 확인한다."""
        return self.db.scalar(
            select(NotebookTopic)
            .join(Notebook, Notebook.id == NotebookTopic.notebook_id)
            .where(NotebookTopic.id == topic_id, Notebook.user_id == user_id)
        )

    def next_position(self, notebook_id: uuid.UUID) -> int:
        """지운 번호는 다시 쓰지 않도록 최댓값 + 1."""
        current = self.db.scalar(
            select(func.max(NotebookTopic.position)).where(NotebookTopic.notebook_id == notebook_id)
        )
        return (current or 0) + 1

    def create(self, notebook_id: uuid.UUID, **fields: object) -> NotebookTopic:
        topic = NotebookTopic(notebook_id=notebook_id, **fields)
        self.db.add(topic)
        self.db.flush()
        return topic

    def add_many(
        self, notebook_id: uuid.UUID, rows: list[dict[str, object]]
    ) -> list[NotebookTopic]:
        topics = [NotebookTopic(notebook_id=notebook_id, **row) for row in rows]
        self.db.add_all(topics)
        self.db.flush()
        return topics

    def delete(self, topic: NotebookTopic) -> None:
        self.db.delete(topic)
        self.db.flush()
