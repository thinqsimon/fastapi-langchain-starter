"""answer_level 도메인 - 데이터 접근 계층."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.answer_level.models import AnswerLevelName


class AnswerLevelNameRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def names(self) -> dict[int, str]:
        rows = self.db.execute(select(AnswerLevelName)).scalars()
        return {row.level: row.name for row in rows}

    def upsert(self, level: int, name: str) -> None:
        row = self.db.get(AnswerLevelName, level)
        if row is None:
            self.db.add(AnswerLevelName(level=level, name=name))
        else:
            row.name = name
        self.db.flush()

    def delete(self, level: int) -> None:
        row = self.db.get(AnswerLevelName, level)
        if row is not None:
            self.db.delete(row)
            self.db.flush()
