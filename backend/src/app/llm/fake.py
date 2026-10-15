"""테스트·CI용 가짜 LLM. API 키 없이 스트리밍까지 흉내 낸다."""

from langchain_core.language_models import BaseChatModel
from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage


def build_fake_chat_model(reply: str = "안녕하세요! 테스트 응답입니다.") -> BaseChatModel:
    def _replies():
        while True:
            yield AIMessage(content=reply)

    return GenericFakeChatModel(messages=_replies())
