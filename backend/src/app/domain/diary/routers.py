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
    EligibleConversation,
    SavedWeeklyReviewRead,
    StudyItemRead,
    StudyProgressUpdate,
    WeeklyReviewCreate,
    WeeklyReviewResponse,
)
from app.domain.diary.services import DiaryService, LearningService

router = APIRouter(prefix="/diary", tags=["diary"])


@router.get(
    "/conversations",
    response_model=list[EligibleConversation],
    summary="일기로 만들 수 있는 채팅",
    description=(
        "메시지가 있고, 마지막 일기 이후 **새 대화가 있는** 채팅만 돌려줍니다. "
        "새 대화가 없는 채팅은 목록에 나오지 않습니다."
    ),
)
def eligible_conversations(current_user: CurrentUser, db: DbSession) -> list[EligibleConversation]:
    return DiaryService(db).eligible_conversations(current_user.id)


@router.post(
    "/draft",
    response_model=DiaryDraftResponse,
    summary="채팅으로 일기 초안 만들기",
    description="저장하지 않습니다. 같은 채팅을 다시 쓰면 새로 추가된 대화를 주제로 씁니다.",
    responses={409: {"description": "일기로 정리할 새 대화가 없음"}},
)
async def draft_entry(
    payload: DiaryDraftRequest, current_user: CurrentUser, db: DbSession
) -> DiaryDraftResponse:
    return await DiaryService(db).draft_from_conversation(
        payload.conversation_id, current_user.id, payload.entry_date, plan=current_user.plan
    )


@router.post(
    "",
    response_model=DiaryEntryRead,
    status_code=status.HTTP_201_CREATED,
    summary="일기 저장",
    description="같은 날 여러 편을 쓸 수 있습니다. 저장할 때의 푸터가 맨 끝에 붙습니다.",
    responses={409: {"description": "같은 채팅에 새 대화가 없음"}},
)
def create_entry(
    payload: DiaryEntryCreate, current_user: CurrentUser, db: DbSession
) -> DiaryEntryRead:
    entry = DiaryService(db).create_entry(
        current_user.id,
        title=payload.title,
        learned=payload.learned,
        learned_detail=payload.learned_detail,
        difficult=payload.difficult,
        next_plan=payload.next_plan,
        entry_date=payload.entry_date,
        conversation_id=payload.conversation_id,
        source_last_message_at=payload.source_last_message_at,
    )
    return DiaryEntryRead.model_validate(entry)


@router.get("", response_model=list[DiaryEntryRead], summary="내 일기 목록")
def list_entries(current_user: CurrentUser, db: DbSession) -> list[DiaryEntryRead]:
    entries = DiaryService(db).list_entries(current_user.id)
    return [DiaryEntryRead.model_validate(entry) for entry in entries]


@router.get("/weekly", response_model=WeeklyReviewResponse, summary="주간 회고")
async def weekly_review(
    current_user: CurrentUser, db: DbSession, reference: date | None = None
) -> WeeklyReviewResponse:
    return await DiaryService(db).weekly_review(current_user.id, reference, plan=current_user.plan)


@router.get("/reviews", response_model=list[SavedWeeklyReviewRead], summary="저장된 주간 회고 목록")
def list_reviews(current_user: CurrentUser, db: DbSession) -> list[SavedWeeklyReviewRead]:
    return [
        SavedWeeklyReviewRead.model_validate(review)
        for review in LearningService(db).list_reviews(current_user.id)
    ]


@router.post(
    "/reviews",
    response_model=SavedWeeklyReviewRead,
    summary="주간 회고 생성·저장",
    description=(
        "계정당 한 주에 한 편을 저장합니다. 이미 저장했다면 LLM 재호출 없이 기존 회고를 돌려줍니다."
    ),
)
async def create_review(
    payload: WeeklyReviewCreate, current_user: CurrentUser, db: DbSession
) -> SavedWeeklyReviewRead:
    return SavedWeeklyReviewRead.model_validate(
        await LearningService(db).create_review(
            current_user.id, payload.reference, plan=current_user.plan
        )
    )


@router.delete(
    "/reviews/{review_id}", status_code=status.HTTP_204_NO_CONTENT, summary="저장된 회고 삭제"
)
def delete_review(review_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> None:
    LearningService(db).delete_review(review_id, current_user.id)


@router.get("/study", response_model=list[StudyItemRead], summary="어려웠던 내용과 복습 진행")
def list_study(current_user: CurrentUser, db: DbSession) -> list[StudyItemRead]:
    return LearningService(db).list_study(current_user.id)


@router.put("/study/{entry_id}", response_model=StudyItemRead, summary="복습 메모·완료 상태 저장")
def save_study(
    entry_id: uuid.UUID, payload: StudyProgressUpdate, current_user: CurrentUser, db: DbSession
) -> StudyItemRead:
    return LearningService(db).save_study(
        entry_id, current_user.id, payload.completed, payload.note
    )


@router.get("/{entry_id}", response_model=DiaryEntryRead, summary="일기 상세")
def get_entry(entry_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> DiaryEntryRead:
    return DiaryEntryRead.model_validate(DiaryService(db).get_entry(entry_id, current_user.id))


@router.patch(
    "/{entry_id}",
    response_model=DiaryEntryRead,
    summary="일기 수정",
    description="푸터는 저장 시점 값으로 고정되어 바뀌지 않습니다.",
)
def update_entry(
    entry_id: uuid.UUID, payload: DiaryEntryUpdate, current_user: CurrentUser, db: DbSession
) -> DiaryEntryRead:
    entry = DiaryService(db).update_entry(
        entry_id,
        current_user.id,
        title=payload.title,
        learned=payload.learned,
        learned_detail=payload.learned_detail,
        difficult=payload.difficult,
        next_plan=payload.next_plan,
    )
    return DiaryEntryRead.model_validate(entry)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT, summary="일기 삭제")
def delete_entry(entry_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> None:
    DiaryService(db).delete_entry(entry_id, current_user.id)
