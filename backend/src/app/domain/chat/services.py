"""chat 도메인 - 비즈니스 로직."""

import logging
import uuid
from collections.abc import AsyncIterator

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.domain.admin.services import AdminLlmSettingsService
from app.domain.chat.models import Conversation, Message
from app.domain.chat.repositories import ConversationRepository, MessageRepository
from app.llm.chains.chat import TokenUsage, stream_reply

logger = logging.getLogger(__name__)

# 매 요청마다 전체 이력을 보내면 토큰이 과하게 들어, 최근 N개만 문맥으로 쓴다.
HISTORY_LIMIT = 20
TITLE_FROM_MESSAGE_LENGTH = 40


class ChatService:
    def __init__(self, db: Session, system_prompt: str | None = None) -> None:
        self.db = db
        self.system_prompt = system_prompt
        self.conversations = ConversationRepository(db)
        self.messages = MessageRepository(db)

    def create_conversation(self, user_id: uuid.UUID, title: str) -> Conversation:
        conversation = self.conversations.create(user_id=user_id, title=title)
        self.db.commit()
        return conversation

    def list_conversations(self, user_id: uuid.UUID) -> list[Conversation]:
        return self.conversations.list_for_user(user_id)

    def get_conversation(self, conversation_id: uuid.UUID, user_id: uuid.UUID) -> Conversation:
        conversation = self.conversations.get_owned(conversation_id, user_id)
        if conversation is None:
            # 남의 대화인지 없는 대화인지 구분해 알려주지 않는다.
            raise NotFoundError("대화를 찾을 수 없습니다.")
        return conversation

    def rename_conversation(
        self, conversation_id: uuid.UUID, user_id: uuid.UUID, title: str
    ) -> Conversation:
        conversation = self.get_conversation(conversation_id, user_id)
        conversation.title = title
        self.db.commit()
        return conversation

    def delete_conversation(self, conversation_id: uuid.UUID, user_id: uuid.UUID) -> None:
        conversation = self.get_conversation(conversation_id, user_id)
        self.conversations.delete(conversation)
        self.db.commit()

    def list_messages(self, conversation_id: uuid.UUID, user_id: uuid.UUID) -> list[Message]:
        self.get_conversation(conversation_id, user_id)
        return self.messages.list_for_conversation(conversation_id)

    async def stream_answer(
        self, conversation_id: uuid.UUID, user_id: uuid.UUID, content: str
    ) -> AsyncIterator[str]:
        """사용자 메시지를 저장하고, LLM 응답을 토큰 단위로 흘리며, 끝나면 함께 저장한다."""
        conversation = self.get_conversation(conversation_id, user_id)
        history = [
            (message.role, message.content)
            for message in self.messages.list_for_conversation(conversation_id)[-HISTORY_LIMIT:]
        ]

        self.messages.add(conversation_id=conversation_id, role="user", content=content)
        # 첫 메시지를 제목으로 삼아 목록에서 알아보기 쉽게 한다.
        if not history:
            conversation.title = content[:TITLE_FROM_MESSAGE_LENGTH]
        self.db.commit()

        chunks: list[str] = []
        usage: TokenUsage | None = None

        def record_usage(reported: TokenUsage) -> None:
            nonlocal usage
            usage = reported

        providers = AdminLlmSettingsService(self.db).active_provider_chain()
        try:
            async for chunk in stream_reply(
                content,
                history,
                system_prompt=self.system_prompt,
                on_usage=record_usage,
                providers=providers,
            ):
                chunks.append(chunk)
                yield chunk
        finally:
            # 중간에 끊겨도 받은 데까지는 남긴다(새로고침 시 이력이 비지 않도록).
            if chunks:
                self.messages.add(
                    conversation_id=conversation_id,
                    role="assistant",
                    content="".join(chunks),
                    input_tokens=usage.input_tokens if usage else None,
                    output_tokens=usage.output_tokens if usage else None,
                )
                self.db.commit()
                logger.info(
                    "assistant_message_saved conversation_id=%s length=%s",
                    conversation_id,
                    len("".join(chunks)),
                )
