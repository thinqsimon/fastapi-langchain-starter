"""LLM 공급자 팩토리. 서비스 계층은 get_chat_model()만 호출한다.

공급자 교체는 코드 수정 없이 .env의 LLM_PROVIDER / LLM_MODEL로 한다.
"""

from typing import Any

from langchain.chat_models import init_chat_model
from langchain_core.language_models import BaseChatModel

from app.core.config import settings
from app.llm.fake import build_fake_chat_model


def get_chat_model() -> BaseChatModel:
    if settings.LLM_PROVIDER == "fake":
        return build_fake_chat_model()
    # OpenAI는 스트리밍에서 기본적으로 사용량을 주지 않아 명시해야 한다.
    extra: dict[str, Any] = {"stream_usage": True} if settings.LLM_PROVIDER == "openai" else {}

    model: BaseChatModel = init_chat_model(
        settings.LLM_MODEL,
        model_provider=settings.LLM_PROVIDER,
        api_key=settings.llm_api_key or None,
        base_url=settings.LLM_BASE_URL or None,
        temperature=settings.LLM_TEMPERATURE,
        **extra,
    )
    return model
