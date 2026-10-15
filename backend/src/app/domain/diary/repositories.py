"""diary 도메인 - 데이터 접근 계층."""

import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.diary.models import DiaryEntry


class DiaryRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_for_user(self, user_id: uuid.UUID) -> list[DiaryEntry]:
        return list(
            self.db.scalars(
                select(DiaryEntry)
                .where(DiaryEntry.user_id == user_id)
                .order_by(DiaryEntry.entry_date.desc())
            )
        )

    def get_owned(self, entry_id: uuid.UUID, user_id: uuid.UUID) -> DiaryEntry | None:
        return self.db.scalar(
            select(DiaryEntry).where(DiaryEntry.id == entry_id, DiaryEntry.user_id == user_id)
        )

    def get_by_date(self, user_id: uuid.UUID, entry_date: date) -> DiaryEntry | None:
        return self.db.scalar(
            select(DiaryEntry).where(
                DiaryEntry.user_id == user_id, DiaryEntry.entry_date == entry_date
            )
        )

    def list_between(self, user_id: uuid.UUID, start: date, end: date) -> list[DiaryEntry]:
        return list(
            self.db.scalars(
                select(DiaryEntry)
                .where(
                    DiaryEntry.user_id == user_id,
                    DiaryEntry.entry_date >= start,
                    DiaryEntry.entry_date <= end,
                )
                .order_by(DiaryEntry.entry_date)
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
