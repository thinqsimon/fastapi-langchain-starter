"""LLM 공급자 팩토리. 서비스 계층은 get_chat_model()만 호출한다.

공급자 교체는 코드 수정 없이 .env의 LLM_PROVIDER / LLM_MODEL로 하거나,
관리자가 "서버 설정" 화면(ADMIN-01)에서 등록한 우선순위·강제 설정을 따른다.
이 모듈은 domain을 import하지 않는다(계층 규칙). DB에서 읽은 값은 domain 쪽에서
`ProviderAttempt`로 감싸 llm/chains/* 함수에 인자로 넘긴다.
"""

from dataclasses import dataclass
from typing import Any

from langchain.chat_models import init_chat_model
from langchain_core.language_models import BaseChatModel

from app.core.config import settings
from app.llm.fake import build_fake_chat_model


@dataclass(frozen=True)
class ProviderAttempt:
    """시도할 공급자 하나. 관리자가 등록한 우선순위대로 리스트에 담겨 넘어온다.

    provider가 빈 문자열이면 "설정 그대로"를 뜻한다(.env의 LLM_PROVIDER/LLM_MODEL).
    """

    provider: str = ""
    model: str = ""
    api_key: str | None = None


# OpenAI는 스트리밍에서 기본적으로 사용량을 주지 않아 명시해야 한다.
_STREAM_USAGE_PROVIDERS = {"openai"}


def get_chat_model(
    *,
    provider: str | None = None,
    model: str | None = None,
    api_key: str | None = None,
    base_url: str | None = None,
) -> BaseChatModel:
    """채팅 모델을 만든다. 인자를 비우면 `.env` 설정을 그대로 쓴다.

    `.env`가 fake면 관리자가 어떤 공급자를 등록했든 항상 테스트용 모델을 돌려준다.
    테스트·E2E에서 실제 API가 호출되는 일이 없게 하는 안전장치다.
    """
    resolved_provider = provider or settings.LLM_PROVIDER
    if resolved_provider == "fake" or settings.LLM_PROVIDER == "fake":
        return build_fake_chat_model()

    resolved_model = model or settings.LLM_MODEL
    resolved_key = api_key if api_key is not None else settings.llm_api_key
    resolved_base_url = base_url if base_url is not None else settings.LLM_BASE_URL
    extra: dict[str, Any] = (
        {"stream_usage": True} if resolved_provider in _STREAM_USAGE_PROVIDERS else {}
    )

    chat_model: BaseChatModel = init_chat_model(
        resolved_model,
        model_provider=resolved_provider,
        api_key=resolved_key or None,
        base_url=resolved_base_url or None,
        temperature=settings.LLM_TEMPERATURE,
        **extra,
    )
    return chat_model
