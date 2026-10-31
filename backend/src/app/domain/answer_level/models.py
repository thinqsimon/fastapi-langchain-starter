"""answer_level 도메인 - 모델 계층. 관리자가 바꾼 단계 이름만 저장한다(없으면 기본 이름)."""

from sqlalchemy import CheckConstraint, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, TimestampMixin


class AnswerLevelName(Base, TimestampMixin):
    __tablename__ = "answer_level_names"
    __table_args__ = (
        CheckConstraint("level BETWEEN 1 AND 5", name="ck_answer_level_names_level_range"),
    )

    level: Mapped[int] = mapped_column(SmallInteger, primary_key=True, autoincrement=False)
    name: Mapped[str] = mapped_column(String(20), nullable=False)
