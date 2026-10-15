"""diary 도메인 - 모델 계층 (샘플앱 '배움일기 코치')."""

import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, Text, UniqueConstraint, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, TimestampMixin


class DiaryEntry(Base, TimestampMixin):
    """하루치 배움일기. 대화에서 초안을 만든 뒤 교육생이 고쳐 저장한다."""

    __tablename__ = "diary_entries"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid()
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # 어떤 대화에서 나왔는지 남긴다. 대화를 지워도 일기는 보존한다.
    conversation_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("conversations.id", ondelete="SET NULL"), nullable=True
    )
    entry_date: Mapped[date] = mapped_column(Date, nullable=False)
    learned: Mapped[str] = mapped_column(Text, nullable=False)
    difficult: Mapped[str] = mapped_column(Text, nullable=False)
    next_plan: Mapped[str] = mapped_column(Text, nullable=False)

    # 하루에 한 편만 쓴다(같은 날 다시 쓰면 수정하도록).
    __table_args__ = (UniqueConstraint("user_id", "entry_date", name="uq_diary_user_date"),)
