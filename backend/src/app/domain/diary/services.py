"""diary 도메인 - 비즈니스 로직 (샘플앱)."""

import logging
import uuid
from datetime import UTC, date, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.domain.chat.repositories import ConversationRepository, MessageRepository
from app.domain.diary.models import DiaryEntry
from app.domain.diary.repositories import DiaryRepository
from app.domain.diary.schemas import WeeklyReviewResponse
from app.llm.chains.diary import DiaryDraft, draft_diary, review_week

logger = logging.getLogger(__name__)


def today_in_utc() -> date:
    return datetime.now(UTC).date()


def week_bounds(reference: date) -> tuple[date, date]:
    """해당 날짜가 속한 주의 월요일과 일요일."""
    monday = reference - timedelta(days=reference.weekday())
    return monday, monday + timedelta(days=6)


class DiaryService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.entries = DiaryRepository(db)
        self.conversations = ConversationRepository(db)
        self.messages = MessageRepository(db)

    async def draft_from_conversation(
        self, conversation_id: uuid.UUID, user_id: uuid.UUID
    ) -> DiaryDraft:
        """코칭 대화를 읽어 일기 초안을 만든다. 저장하지는 않는다."""
        if self.conversations.get_owned(conversation_id, user_id) is None:
            raise NotFoundError("대화를 찾을 수 없습니다.")

        messages = self.messages.list_for_conversation(conversation_id)
        if not messages:
            raise NotFoundError("대화 내용이 없습니다.")

        return await draft_diary([(message.role, message.content) for message in messages])

    def create_entry(
        self,
        user_id: uuid.UUID,
        entry_date: date | None,
        learned: str,
        difficult: str,
        next_plan: str,
        conversation_id: uuid.UUID | None = None,
    ) -> DiaryEntry:
        target_date = entry_date or today_in_utc()
        if self.entries.get_by_date(user_id, target_date) is not None:
            raise ConflictError("그날의 일기가 이미 있습니다. 수정해 주세요.")

        entry = self.entries.create(
            user_id=user_id,
            entry_date=target_date,
            learned=learned,
            difficult=difficult,
            next_plan=next_plan,
            conversation_id=conversation_id,
        )
        self.db.commit()
        logger.info("diary_entry_created user_id=%s date=%s", user_id, target_date)
        return entry

    def list_entries(self, user_id: uuid.UUID) -> list[DiaryEntry]:
        return self.entries.list_for_user(user_id)

    def get_entry(self, entry_id: uuid.UUID, user_id: uuid.UUID) -> DiaryEntry:
        entry = self.entries.get_owned(entry_id, user_id)
        if entry is None:
            raise NotFoundError("일기를 찾을 수 없습니다.")
        return entry

    def update_entry(self, entry_id: uuid.UUID, user_id: uuid.UUID, **fields: str) -> DiaryEntry:
        entry = self.get_entry(entry_id, user_id)
        for name, value in fields.items():
            setattr(entry, name, value)
        self.db.commit()
        return entry

    def delete_entry(self, entry_id: uuid.UUID, user_id: uuid.UUID) -> None:
        self.entries.delete(self.get_entry(entry_id, user_id))
        self.db.commit()

    async def weekly_review(
        self, user_id: uuid.UUID, reference: date | None = None
    ) -> WeeklyReviewResponse:
        start, end = week_bounds(reference or today_in_utc())
        entries = self.entries.list_between(user_id, start, end)
        if not entries:
            raise NotFoundError("이번 주에 작성한 일기가 없습니다.")

        review = await review_week(
            [
                f"{entry.entry_date}\n배운 것: {entry.learned}\n"
                f"어려웠던 것: {entry.difficult}\n내일 할 것: {entry.next_plan}"
                for entry in entries
            ]
        )
        return WeeklyReviewResponse(
            week_start=start,
            week_end=end,
            entry_count=len(entries),
            grown=review.grown,
            repeated_difficulty=review.repeated_difficulty,
            suggestion=review.suggestion,
        )
