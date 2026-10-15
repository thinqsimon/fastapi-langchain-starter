"""diary 도메인 - 라우터 (샘플앱)."""

import uuid
from datetime import date

from fastapi import APIRouter, status

from app.domain.auth.dependencies import CurrentUser, DbSession
from app.domain.diary.schemas import (
    DiaryDraftRequest,
    DiaryDraftResponse,
    DiaryEntryCreate,
    DiaryEntryRead,
    DiaryEntryUpdate,
    WeeklyReviewResponse,
)
from app.domain.diary.services import DiaryService

router = APIRouter(prefix="/diary", tags=["diary"])


@router.post("/draft", response_model=DiaryDraftResponse)
async def draft_entry(
    payload: DiaryDraftRequest, current_user: CurrentUser, db: DbSession
) -> DiaryDraftResponse:
    draft = await DiaryService(db).draft_from_conversation(payload.conversation_id, current_user.id)
    return DiaryDraftResponse(**draft.model_dump())


@router.post("", response_model=DiaryEntryRead, status_code=status.HTTP_201_CREATED)
def create_entry(
    payload: DiaryEntryCreate, current_user: CurrentUser, db: DbSession
) -> DiaryEntryRead:
    entry = DiaryService(db).create_entry(
        current_user.id,
        payload.entry_date,
        conversation_id=payload.conversation_id,
        learned=payload.learned,
        difficult=payload.difficult,
        next_plan=payload.next_plan,
    )
    return DiaryEntryRead.model_validate(entry)


@router.get("", response_model=list[DiaryEntryRead])
def list_entries(current_user: CurrentUser, db: DbSession) -> list[DiaryEntryRead]:
    entries = DiaryService(db).list_entries(current_user.id)
    return [DiaryEntryRead.model_validate(entry) for entry in entries]


@router.get("/weekly", response_model=WeeklyReviewResponse)
async def weekly_review(
    current_user: CurrentUser, db: DbSession, reference: date | None = None
) -> WeeklyReviewResponse:
    return await DiaryService(db).weekly_review(current_user.id, reference)


@router.get("/{entry_id}", response_model=DiaryEntryRead)
def get_entry(entry_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> DiaryEntryRead:
    return DiaryEntryRead.model_validate(DiaryService(db).get_entry(entry_id, current_user.id))


@router.patch("/{entry_id}", response_model=DiaryEntryRead)
def update_entry(
    entry_id: uuid.UUID, payload: DiaryEntryUpdate, current_user: CurrentUser, db: DbSession
) -> DiaryEntryRead:
    entry = DiaryService(db).update_entry(
        entry_id,
        current_user.id,
        learned=payload.learned,
        difficult=payload.difficult,
        next_plan=payload.next_plan,
    )
    return DiaryEntryRead.model_validate(entry)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_entry(entry_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> None:
    DiaryService(db).delete_entry(entry_id, current_user.id)
