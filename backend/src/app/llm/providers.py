"""LLM 공급자 팩토리. 서비스 계층은 get_chat_model()만 호출한다.

공급자 교체는 코드 수정 없이 .env의 LLM_PROVIDER / LLM_MODEL로 한다.
"""

from langchain.chat_models import init_chat_model
from langchain_core.language_models import BaseChatModel

from app.core.config import settings
from app.llm.fake import build_fake_chat_model


def get_chat_model() -> BaseChatModel:
    if settings.LLM_PROVIDER == "fake":
        return build_fake_chat_model()
    return init_chat_model(
        settings.LLM_MODEL,
        model_provider=settings.LLM_PROVIDER,
        api_key=settings.llm_api_key or None,
        base_url=settings.LLM_BASE_URL or None,
        temperature=settings.LLM_TEMPERATURE,
    )
