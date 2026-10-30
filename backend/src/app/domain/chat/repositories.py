"""chat 도메인 - 데이터 접근 계층."""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.domain.chat.models import Conversation, Message


class ConversationRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, user_id: uuid.UUID, title: str) -> Conversation:
        conversation = Conversation(user_id=user_id, title=title)
        self.db.add(conversation)
        self.db.flush()
        return conversation

    def list_for_user(self, user_id: uuid.UUID) -> list[Conversation]:
        return list(
            self.db.scalars(
                select(Conversation)
                .where(Conversation.user_id == user_id)
                .order_by(Conversation.created_at.desc())
            )
        )

    def get_owned(self, conversation_id: uuid.UUID, user_id: uuid.UUID) -> Conversation | None:
        """남의 대화는 아예 조회되지 않게 소유자 조건을 쿼리에 넣는다."""
        return self.db.scalar(
            select(Conversation)
            .where(Conversation.id == conversation_id, Conversation.user_id == user_id)
            .options(selectinload(Conversation.messages))
        )

    def delete(self, conversation: Conversation) -> None:
        self.db.delete(conversation)
        self.db.flush()


class MessageRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def add(
        self,
        conversation_id: uuid.UUID,
        role: str,
        content: str,
        input_tokens: int | None = None,
        output_tokens: int | None = None,
        provider: str | None = None,
        model: str | None = None,
    ) -> Message:
        message = Message(
            conversation_id=conversation_id,
            role=role,
            content=content,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            provider=provider,
            model=model,
        )
        self.db.add(message)
        self.db.flush()
        return message

    def list_for_conversation(self, conversation_id: uuid.UUID) -> list[Message]:
        return list(
            self.db.scalars(
                select(Message)
                .where(Message.conversation_id == conversation_id)
                .order_by(Message.created_at)
            )
        )
