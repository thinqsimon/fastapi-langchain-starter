"""chat 도메인 - 모델 계층.

대화(conversation)와 메시지(message). 샘플앱은 이 구조를 그대로 쓰고 프롬프트만 바꾼다.
"""

import uuid
from typing import Literal

from sqlalchemy import ForeignKey, Index, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin

MessageRole = Literal["user", "assistant", "system"]


class Conversation(Base, TimestampMixin):
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid()
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(100), nullable=False)

    messages: Mapped[list["Message"]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )

    # 목록은 "내 대화를 최신순으로"가 기본이라 복합 인덱스를 둔다.
    __table_args__ = (Index("ix_conversations_user_id_created_at", "user_id", "created_at"),)


class Message(Base, TimestampMixin):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid()
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # LLM 사용량. 사용자 메시지에는 없다.
    input_tokens: Mapped[int | None] = mapped_column(nullable=True)
    output_tokens: Mapped[int | None] = mapped_column(nullable=True)
    # 실제로 답한 공급자·모델(ADMIN-01 우선순위 전환 뒤에는 .env와 다를 수 있다).
    # 사용자 메시지와 이 컬럼이 생기기 전의 답변은 NULL이다.
    provider: Mapped[str | None] = mapped_column(String(32), nullable=True)
    model: Mapped[str | None] = mapped_column(String(100), nullable=True)

    conversation: Mapped["Conversation"] = relationship(back_populates="messages")
