"""diary 도메인 - 데이터 접근 계층."""

import uuid
from datetime import date, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.domain.chat.models import Conversation, Message
from app.domain.diary.models import DiaryEntry


class DiaryRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_for_user(self, user_id: uuid.UUID) -> list[DiaryEntry]:
        return list(
            self.db.scalars(
                select(DiaryEntry)
                .where(DiaryEntry.user_id == user_id)
                .order_by(DiaryEntry.entry_date.desc(), DiaryEntry.day_sequence.desc())
            )
        )

    def get_owned(self, entry_id: uuid.UUID, user_id: uuid.UUID) -> DiaryEntry | None:
        return self.db.scalar(
            select(DiaryEntry).where(DiaryEntry.id == entry_id, DiaryEntry.user_id == user_id)
        )

    def next_day_sequence(self, user_id: uuid.UUID, entry_date: date) -> int:
        """그날 몇 번째 일기가 될지. 지운 번호는 다시 쓰지 않도록 최댓값 + 1."""
        current = self.db.scalar(
            select(func.max(DiaryEntry.day_sequence)).where(
                DiaryEntry.user_id == user_id, DiaryEntry.entry_date == entry_date
            )
        )
        return (current or 0) + 1

    def covered_until(self, user_id: uuid.UUID, conversation_id: uuid.UUID) -> datetime | None:
        """이 채팅으로 쓴 일기들이 다룬 마지막 메시지 시각. 일기가 없으면 None."""
        return self.db.scalar(
            select(func.max(DiaryEntry.source_last_message_at)).where(
                DiaryEntry.user_id == user_id, DiaryEntry.conversation_id == conversation_id
            )
        )

    def eligible_conversations(
        self, user_id: uuid.UUID
    ) -> list[tuple[Conversation, datetime, int]]:
        """일기로 만들 수 있는 채팅: 메시지가 있고, 마지막 일기 이후 새 대화가 있는 것.

        (채팅, 마지막 메시지 시각, 이 채팅으로 쓴 일기 수)를 최근 대화 순으로 돌려준다.
        """
        last_message = (
            select(
                Message.conversation_id.label("conversation_id"),
                func.max(Message.created_at).label("last_message_at"),
            )
            .group_by(Message.conversation_id)
            .subquery()
        )
        diaries = (
            select(
                DiaryEntry.conversation_id.label("conversation_id"),
                func.max(DiaryEntry.source_last_message_at).label("covered_until"),
                func.count(DiaryEntry.id).label("diary_count"),
            )
            .where(DiaryEntry.user_id == user_id, DiaryEntry.conversation_id.is_not(None))
            .group_by(DiaryEntry.conversation_id)
            .subquery()
        )

        rows = self.db.execute(
            select(
                Conversation,
                last_message.c.last_message_at,
                func.coalesce(diaries.c.diary_count, 0),
            )
            .join(last_message, last_message.c.conversation_id == Conversation.id)
            .outerjoin(diaries, diaries.c.conversation_id == Conversation.id)
            .where(
                Conversation.user_id == user_id,
                or_(
                    diaries.c.covered_until.is_(None),
                    last_message.c.last_message_at > diaries.c.covered_until,
                ),
            )
            .order_by(last_message.c.last_message_at.desc())
        ).all()

        return [(row[0], row[1], int(row[2])) for row in rows]

    def list_between(self, user_id: uuid.UUID, start: date, end: date) -> list[DiaryEntry]:
        return list(
            self.db.scalars(
                select(DiaryEntry)
                .where(
                    DiaryEntry.user_id == user_id,
                    DiaryEntry.entry_date >= start,
                    DiaryEntry.entry_date <= end,
                )
                .order_by(DiaryEntry.entry_date, DiaryEntry.day_sequence)
            )
        )

    def create(self, user_id: uuid.UUID, **fields: object) -> DiaryEntry:
        entry = DiaryEntry(user_id=user_id, **fields)
        self.db.add(entry)
        self.db.flush()
        return entry

    def delete(self, entry: DiaryEntry) -> None:
        self.db.delete(entry)
        self.db.flush()
