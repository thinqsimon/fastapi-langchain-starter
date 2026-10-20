"""diary 도메인 - 모델 계층 (샘플앱 '배움일기 코치').

일기 단위는 **채팅**이다. 채팅 하나를 골라 그 대화에서 배운 것을 일기로 쓴다.
같은 채팅이라도 새 대화가 추가되면 다시 일기를 쓸 수 있다(새로 추가된 부분이 주제).
"""

import uuid
from datetime import date, datetime

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, TimestampMixin


class DiaryEntry(Base, TimestampMixin):
    __tablename__ = "diary_entries"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid()
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # 어떤 채팅에서 나왔는지. 채팅을 지워도 일기는 보존한다.
    conversation_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("conversations.id", ondelete="SET NULL"), index=True, nullable=True
    )
    # 이 일기가 다룬 대화의 마지막 메시지 시각.
    # 채팅에 이보다 늦은 메시지가 생겨야 같은 채팅으로 다시 일기를 쓸 수 있다.
    source_last_message_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # 제목의 날짜(기본값 오늘). 채팅 날짜와 무관하다.
    entry_date: Mapped[date] = mapped_column(Date, nullable=False)
    # 같은 날 몇 번째 일기인지. 제목의 (2), (3)에 대응한다.
    day_sequence: Mapped[int] = mapped_column(nullable=False, server_default=text("1"))
    title: Mapped[str] = mapped_column(String(200), nullable=False, server_default="")

    learned: Mapped[str] = mapped_column(Text, nullable=False)
    # 주제별 소제목으로 정리한 상세 내용(마크다운). 길이 제한 없음.
    learned_detail: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
    difficult: Mapped[str] = mapped_column(Text, nullable=False)
    # 대화에 '내일 할 것'이 없으면 비운다(NULL이면 화면에서도 항목 자체를 숨김).
    next_plan: Mapped[str | None] = mapped_column(Text, nullable=True)
    # 저장할 때의 푸터 문구를 그대로 남긴다. 나중에 설정을 바꿔도 지난 일기는 그대로다.
    footer: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        # 같은 날 같은 순번이 두 번 생기지 않게 DB가 막는다(동시에 두 번 저장한 경우).
        UniqueConstraint("user_id", "entry_date", "day_sequence", name="uq_diary_user_date_seq"),
        Index("ix_diary_entries_user_id_entry_date", "user_id", "entry_date"),
    )
