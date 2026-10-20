"""diary 도메인 - 비즈니스 로직 (샘플앱).

핵심 규칙
- 일기 단위는 채팅이다. 채팅을 골라 그 대화로 초안을 만든다.
- 같은 채팅은 마지막 일기 이후 **새 대화가 있을 때만** 다시 일기를 쓸 수 있다.
  다시 쓰는 일기는 새로 추가된 대화가 주제이고, 이전 대화는 맥락으로만 쓴다.
- 같은 날 여러 편을 쓸 수 있다. 두 번째부터 제목 날짜에 (2), (3)이 붙는다.
- '내일 할 것'이 비어 있으면 항목 없이 저장한다.
- 저장할 때의 푸터 문구를 일기에 남긴다.
"""

import logging
import re
import uuid
from datetime import UTC, date, datetime, timedelta

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.domain.chat.models import Message
from app.domain.chat.repositories import ConversationRepository, MessageRepository
from app.domain.diary.models import DiaryEntry
from app.domain.diary.repositories import DiaryRepository
from app.domain.diary.schemas import (
    DiaryDraftResponse,
    EligibleConversation,
    WeeklyReviewResponse,
)
from app.domain.preferences.services import PreferenceService
from app.llm.chains.diary import draft_diary, review_week

logger = logging.getLogger(__name__)


def today_in_utc() -> date:
    return datetime.now(UTC).date()


def week_bounds(reference: date) -> tuple[date, date]:
    """해당 날짜가 속한 주의 월요일과 일요일."""
    monday = reference - timedelta(days=reference.weekday())
    return monday, monday + timedelta(days=6)


def format_title(entry_date: date, day_sequence: int, keywords: str) -> str:
    """'2026-10-20 JWT, 토큰' / 같은 날 두 번째부터 '2026-10-20(2) …'."""
    suffix = "" if day_sequence <= 1 else f"({day_sequence})"
    return f"{entry_date.isoformat()}{suffix} {keywords.strip()}".strip()


def align_title_sequence(title: str, entry_date: date, day_sequence: int) -> str:
    """제목이 그날 날짜로 시작하면 (n)을 실제 순번에 맞춘다.

    초안을 만든 뒤 다른 일기가 먼저 저장되면 초안 제목의 순번이 어긋나기 때문이다.
    날짜로 시작하지 않는 제목은 사용자가 고친 것이므로 그대로 둔다.
    """
    pattern = re.compile(rf"^{re.escape(entry_date.isoformat())}(?:\(\d+\))?(?=\s|$)")
    prefix = format_title(entry_date, day_sequence, "")
    return pattern.sub(lambda _: prefix, title, count=1)


def blank_to_none(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def split_by_coverage(
    messages: list[Message], covered_until: datetime | None
) -> tuple[list[Message], list[Message]]:
    """(이전에 일기로 다룬 대화, 새로 추가된 대화)로 나눈다."""
    if covered_until is None:
        return [], messages
    earlier = [m for m in messages if m.created_at <= covered_until]
    newer = [m for m in messages if m.created_at > covered_until]
    return earlier, newer


class DiaryService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.entries = DiaryRepository(db)
        self.conversations = ConversationRepository(db)
        self.messages = MessageRepository(db)

    def eligible_conversations(self, user_id: uuid.UUID) -> list[EligibleConversation]:
        """일기로 만들 수 있는 채팅만. 새 대화가 없는 채팅은 숨긴다."""
        return [
            EligibleConversation(
                id=conversation.id,
                title=conversation.title,
                last_message_at=last_message_at,
                diary_count=diary_count,
            )
            for conversation, last_message_at, diary_count in self.entries.eligible_conversations(
                user_id
            )
        ]

    async def draft_from_conversation(
        self, conversation_id: uuid.UUID, user_id: uuid.UUID, entry_date: date | None = None
    ) -> DiaryDraftResponse:
        """채팅을 읽어 일기 초안을 만든다. 저장하지는 않는다."""
        if self.conversations.get_owned(conversation_id, user_id) is None:
            raise NotFoundError("대화를 찾을 수 없습니다.")

        messages = self.messages.list_for_conversation(conversation_id)
        if not messages:
            raise NotFoundError("대화 내용이 없습니다.")

        covered_until = self.entries.covered_until(user_id, conversation_id)
        earlier, newer = split_by_coverage(messages, covered_until)
        if not newer:
            raise ConflictError("이 채팅에는 일기로 정리할 새 대화가 없습니다.")

        draft = await draft_diary(
            new_messages=[(m.role, m.content) for m in newer],
            context_messages=[(m.role, m.content) for m in earlier],
        )

        # 제목 날짜는 채팅 날짜와 상관없이 오늘이다.
        entry_date = entry_date or today_in_utc()
        sequence = self.entries.next_day_sequence(user_id, entry_date)
        return DiaryDraftResponse(
            conversation_id=conversation_id,
            source_last_message_at=newer[-1].created_at,
            entry_date=entry_date,
            title=format_title(entry_date, sequence, draft.keywords),
            learned=draft.learned,
            learned_detail=draft.learned_detail,
            difficult=draft.difficult,
            next_plan=draft.next_plan.strip(),
        )

    def create_entry(
        self,
        user_id: uuid.UUID,
        title: str,
        learned: str,
        difficult: str,
        learned_detail: str = "",
        next_plan: str | None = None,
        entry_date: date | None = None,
        conversation_id: uuid.UUID | None = None,
        source_last_message_at: datetime | None = None,
    ) -> DiaryEntry:
        target_date = entry_date or today_in_utc()

        if conversation_id is not None:
            source_last_message_at = self._check_reissue(
                user_id, conversation_id, source_last_message_at
            )

        sequence = self.entries.next_day_sequence(user_id, target_date)
        try:
            entry = self.entries.create(
                user_id=user_id,
                conversation_id=conversation_id,
                source_last_message_at=source_last_message_at,
                entry_date=target_date,
                day_sequence=sequence,
                title=align_title_sequence(title.strip(), target_date, sequence),
                learned=learned,
                learned_detail=learned_detail,
                difficult=difficult,
                next_plan=blank_to_none(next_plan),
                # 저장 시점의 푸터를 그대로 남긴다(나중에 설정을 바꿔도 이 일기는 그대로).
                footer=PreferenceService(self.db).diary_footer_for(user_id),
            )
        except IntegrityError as exc:
            # 같은 날 거의 동시에 두 번 저장해 순번이 겹친 경우
            self.db.rollback()
            raise ConflictError("동시에 저장되었습니다. 다시 시도해 주세요.") from exc

        self.db.commit()
        logger.info(
            "diary_entry_created user_id=%s date=%s seq=%s",
            user_id,
            target_date,
            entry.day_sequence,
        )
        return entry

    def _check_reissue(
        self,
        user_id: uuid.UUID,
        conversation_id: uuid.UUID,
        source_last_message_at: datetime | None,
    ) -> datetime:
        """같은 채팅으로 다시 쓰려면 지난 일기 이후 새 대화가 있어야 한다."""
        if self.conversations.get_owned(conversation_id, user_id) is None:
            raise NotFoundError("대화를 찾을 수 없습니다.")

        messages = self.messages.list_for_conversation(conversation_id)
        if not messages:
            raise NotFoundError("대화 내용이 없습니다.")
        latest = messages[-1].created_at

        # 초안이 다룬 시점을 받는다. 없거나 실제보다 미래면 현재 마지막 대화로 맞춘다.
        covered = source_last_message_at
        if covered is None or covered > latest:
            covered = latest

        previous = self.entries.covered_until(user_id, conversation_id)
        if previous is not None and covered <= previous:
            raise ConflictError("이 채팅에는 일기로 정리할 새 대화가 없습니다.")
        return covered

    def list_entries(self, user_id: uuid.UUID) -> list[DiaryEntry]:
        return self.entries.list_for_user(user_id)

    def get_entry(self, entry_id: uuid.UUID, user_id: uuid.UUID) -> DiaryEntry:
        entry = self.entries.get_owned(entry_id, user_id)
        if entry is None:
            raise NotFoundError("일기를 찾을 수 없습니다.")
        return entry

    def update_entry(
        self,
        entry_id: uuid.UUID,
        user_id: uuid.UUID,
        title: str,
        learned: str,
        difficult: str,
        learned_detail: str = "",
        next_plan: str | None = None,
    ) -> DiaryEntry:
        entry = self.get_entry(entry_id, user_id)
        entry.title = title.strip()
        entry.learned = learned
        entry.learned_detail = learned_detail
        entry.difficult = difficult
        entry.next_plan = blank_to_none(next_plan)
        # 푸터는 저장 시점 값으로 고정한다(수정하지 않음).
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
                f"{entry.title}\n배운 것: {entry.learned}\n어려웠던 것: {entry.difficult}"
                + (f"\n내일 할 것: {entry.next_plan}" if entry.next_plan else "")
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
