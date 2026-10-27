"""notebook 도메인 - 라우터 (샘플앱)."""

import uuid

from fastapi import APIRouter, status

from app.domain.auth.dependencies import CurrentUser, DbSession
from app.domain.notebook.schemas import (
    NotebookCreate,
    NotebookRead,
    NotebookUpdate,
    NotebookUpload,
    TopicCreate,
    TopicRead,
    TopicUpdate,
)
from app.domain.notebook.services import NotebookService

router = APIRouter(prefix="/notebooks", tags=["notebook"])


@router.get(
    "",
    response_model=list[NotebookRead],
    summary="내 학습장 목록",
    description=(
        "최근에 올린 순서입니다. 주제는 본문 없이 요약만 싣고, 본문은 주제 상세에서 받습니다."
    ),
)
def list_notebooks(current_user: CurrentUser, db: DbSession) -> list[NotebookRead]:
    return [
        NotebookRead.model_validate(notebook)
        for notebook in NotebookService(db).list_notebooks(current_user.id)
    ]


@router.post(
    "/upload",
    response_model=NotebookRead,
    status_code=status.HTTP_201_CREATED,
    summary="마크다운 학습 노트 올리기",
    description=(
        "브라우저가 읽은 파일 내용을 JSON으로 보냅니다. `## 제목` 마다 주제로 나누고, "
        "`## 목차`와 코드 블록 안의 제목은 건너뜁니다. 주제가 없으면 전체가 주제 하나가 됩니다."
    ),
    responses={
        400: {"description": "저장할 내용이 없음"},
        409: {"description": "같은 이름의 파일을 이미 올림"},
    },
)
def upload_notebook(
    payload: NotebookUpload, current_user: CurrentUser, db: DbSession
) -> NotebookRead:
    notebook = NotebookService(db).upload(current_user.id, payload.filename, payload.content)
    return NotebookRead.model_validate(notebook)


@router.post(
    "",
    response_model=NotebookRead,
    status_code=status.HTTP_201_CREATED,
    summary="빈 학습장 만들기",
    description="업로드 없이 주제를 직접 쓸 때 씁니다.",
)
def create_notebook(
    payload: NotebookCreate, current_user: CurrentUser, db: DbSession
) -> NotebookRead:
    return NotebookRead.model_validate(
        NotebookService(db).create_notebook(current_user.id, payload.title)
    )


@router.get("/topics/{topic_id}", response_model=TopicRead, summary="주제 상세(본문 포함)")
def get_topic(topic_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> TopicRead:
    return TopicRead.model_validate(NotebookService(db).get_topic(topic_id, current_user.id))


@router.patch(
    "/topics/{topic_id}",
    response_model=TopicRead,
    summary="주제 수정",
    description="보낸 필드만 바꿉니다. `completed`만 보내면 학습 완료 표시만 바뀝니다.",
)
def update_topic(
    topic_id: uuid.UUID, payload: TopicUpdate, current_user: CurrentUser, db: DbSession
) -> TopicRead:
    return TopicRead.model_validate(
        NotebookService(db).update_topic(topic_id, current_user.id, payload)
    )


@router.delete("/topics/{topic_id}", status_code=status.HTTP_204_NO_CONTENT, summary="주제 삭제")
def delete_topic(topic_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> None:
    NotebookService(db).delete_topic(topic_id, current_user.id)


@router.post(
    "/{notebook_id}/topics",
    response_model=TopicRead,
    status_code=status.HTTP_201_CREATED,
    summary="주제 추가",
)
def create_topic(
    notebook_id: uuid.UUID, payload: TopicCreate, current_user: CurrentUser, db: DbSession
) -> TopicRead:
    return TopicRead.model_validate(
        NotebookService(db).create_topic(notebook_id, current_user.id, payload)
    )


@router.patch("/{notebook_id}", response_model=NotebookRead, summary="학습장 이름 바꾸기")
def rename_notebook(
    notebook_id: uuid.UUID, payload: NotebookUpdate, current_user: CurrentUser, db: DbSession
) -> NotebookRead:
    return NotebookRead.model_validate(
        NotebookService(db).rename_notebook(notebook_id, current_user.id, payload.title)
    )


@router.delete(
    "/{notebook_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="학습장 삭제",
    description="안의 주제도 함께 지워집니다.",
)
def delete_notebook(notebook_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> None:
    NotebookService(db).delete_notebook(notebook_id, current_user.id)
