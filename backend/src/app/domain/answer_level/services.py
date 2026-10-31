"""answer_level 도메인 - 비즈니스 로직."""

import logging

from sqlalchemy.orm import Session

from app.core.answer_levels import ANSWER_LEVELS, LEVEL_INFO
from app.domain.answer_level.repositories import AnswerLevelNameRepository
from app.domain.answer_level.schemas import AnswerLevelRead

logger = logging.getLogger(__name__)


class AnswerLevelService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.names = AnswerLevelNameRepository(db)

    def list(self) -> list[AnswerLevelRead]:
        """1~5단계. 이름은 관리자가 바꾼 값이 있으면 그것, 없으면 기본 이름."""
        custom = self.names.names()
        return [self._read(level, custom) for level in ANSWER_LEVELS]

    def rename(self, level: int, name: str) -> AnswerLevelRead:
        info = LEVEL_INFO[level]
        if name == info.default_name:
            # 기본 이름과 같으면 저장해 둘 필요가 없다(나중에 기본 이름이 바뀌면 따라가게).
            self.names.delete(level)
        else:
            self.names.upsert(level, name)
        self.db.commit()
        logger.info("answer_level_renamed level=%s name=%s", level, name)
        return self._read(level, self.names.names())

    def reset(self, level: int) -> AnswerLevelRead:
        self.names.delete(level)
        self.db.commit()
        logger.info("answer_level_name_reset level=%s", level)
        return self._read(level, {})

    @staticmethod
    def _read(level: int, custom: dict[int, str]) -> AnswerLevelRead:
        info = LEVEL_INFO[level]
        return AnswerLevelRead(
            level=level,
            name=custom.get(level, info.default_name),
            default_name=info.default_name,
            audience=info.audience,
            style=info.style,
            example=info.example,
        )
