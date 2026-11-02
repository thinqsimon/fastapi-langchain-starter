"""chat 도메인 - 비즈니스 로직."""

import logging
import uuid
from collections.abc import AsyncIterator, Callable

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.core.plans import DEFAULT_PLAN
from app.domain.admin.services import AdminLlmSettingsService
from app.domain.chat.models import Conversation, Message
from app.domain.chat.repositories import ConversationRepository, MessageRepository
from app.domain.chat.schemas import DEFAULT_CONVERSATION_TITLE
from app.llm.chains.chat import ModelInfo, TokenUsage, stream_reply

logger = logging.getLogger(__name__)

# 매 요청마다 전체 이력을 보내면 토큰이 과하게 들어, 최근 N개만 문맥으로 쓴다.
HISTORY_LIMIT = 20
TITLE_FROM_MESSAGE_LENGTH = 40

# 사용자가 답변에 추천 질문을 함께 받을지 알려 주는 함수(CHAT-04). 앱 조립 지점이 넘겨준다.
SuggestQuestionsFor = Callable[[Session, uuid.UUID], bool]


class ChatService:
    def __init__(
        self,
        db: Session,
        system_prompt: str | None = None,
        suggest_questions_for: SuggestQuestionsFor | None = None,
    ) -> None:
        self.db = db
        self.system_prompt = system_prompt
        self.suggest_questions_for = suggest_questions_for
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
        self,
        conversation_id: uuid.UUID,
        user_id: uuid.UUID,
        content: str,
        plan: str = DEFAULT_PLAN,
        answer_level: int | None = None,
        level_requested: bool = False,
    ) -> AsyncIterator[str]:
        """사용자 메시지를 저장하고, LLM 응답을 토큰 단위로 흘리며, 끝나면 함께 저장한다.

        plan: 사용자의 요금제. 어떤 공급자·모델을 쓸지 이 값으로 고른다(ADMIN-03).
        answer_level: 이번 답변의 수준(CHAT-03). 어휘·설명 깊이를 맞추고, 답변과 함께 저장해
            화면에 표시한다(CHAT-04).
        level_requested: 요청에 answer_level을 직접 실어 보냈는가. 이미 한 질문을 그렇게 다시 보내면
            답변 아래 수준 버튼으로 다른 수준을 고른 것이다(CHAT-04).
        """
        conversation = self.get_conversation(conversation_id, user_id)
        # 사용자가 켰으면 답변 끝에 이어서 물어볼 질문도 함께 받는다(CHAT-04).
        suggest_questions = bool(
            self.suggest_questions_for and self.suggest_questions_for(self.db, user_id)
        )
        history = [
            (message.role, message.content)
            for message in self.messages.list_for_conversation(conversation_id)[-HISTORY_LIMIT:]
        ]

        # 같은 질문을 다른 수준으로 다시 묻는 경우. 알리지 않으면 모델이
        # 대화에 같은 질문이 있는 것을 보고 "이미 물어보셨네요"라고만 답한다.
        reanswer = level_requested and any(
            role == "user" and text == content for role, text in history
        )

        self.messages.add(conversation_id=conversation_id, role="user", content=content)
        # 첫 메시지를 제목으로 삼아 목록에서 알아보기 쉽게 한다.
        # 사용자가 먼저 이름을 붙였으면 그대로 둔다.
        if not history and conversation.title == DEFAULT_CONVERSATION_TITLE:
            conversation.title = content[:TITLE_FROM_MESSAGE_LENGTH]
        self.db.commit()

        chunks: list[str] = []
        usage: TokenUsage | None = None
        answered_by: ModelInfo | None = None
        questions: list[str] = []

        def record_usage(reported: TokenUsage) -> None:
            nonlocal usage
            usage = reported

        def record_model(info: ModelInfo) -> None:
            nonlocal answered_by
            answered_by = info

        def record_questions(found: list[str]) -> None:
            questions.extend(found)

        providers = AdminLlmSettingsService(self.db).active_provider_chain(plan)
        try:
            async for chunk in stream_reply(
                content,
                history,
                system_prompt=self.system_prompt,
                on_usage=record_usage,
                providers=providers,
                on_model=record_model,
                answer_level=answer_level,
                on_questions=record_questions if suggest_questions else None,
                reanswer=reanswer,
            ):
                chunks.append(chunk)
                yield chunk
        finally:
            # 중간에 끊겨도 받은 데까지는 남긴다(새로고침 시 이력이 비지 않도록).
            if chunks:
                answer = "".join(chunks)
                self.messages.add(
                    conversation_id=conversation_id,
                    role="assistant",
                    # 추천 질문 태그 앞에 둔 빈 줄은 답변에 남기지 않는다.
                    content=answer.rstrip() if questions else answer,
                    input_tokens=usage.input_tokens if usage else None,
                    output_tokens=usage.output_tokens if usage else None,
                    provider=answered_by.provider if answered_by else None,
                    model=answered_by.model if answered_by else None,
                    plan=plan,
                    answer_level=answer_level,
                    suggested_questions=questions or None,
                )
                self.db.commit()
                logger.info(
                    "assistant_message_saved conversation_id=%s length=%s questions=%s",
                    conversation_id,
                    len(answer),
                    len(questions),
                )
