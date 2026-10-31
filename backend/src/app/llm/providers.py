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
# Claude에는 temperature를 보내지 않는다. anthropic SDK 2.x가 쓰는 API 버전(2026-10-21)은
# temperature·top_p·top_k를 보내면 모든 모델에서 400이고, 5.5 계열은 그 전부터 기본값만 받는다
# (langchain-anthropic은 보내기 전에 ValueError를 낸다). 빼면 모델 기본 샘플링을 쓴다.
_NO_SAMPLING_PROVIDERS = {"anthropic"}
# 공급자 SDK 안의 자동 재시도는 한 번만 한다. 실패하면 관리자가 정한 우선순위의 다음 공급자로
# 넘어가는 편이 빠르다. Gemini SDK 기본값은 6번까지 대기 시간을 늘려 가며 다시 시도해서,
# 운영에서 실패를 알기까지 15초쯤 걸렸고 일기 초안이 화면 제한 시간을 넘겼다.
# Gemini의 max_retries는 "시도 횟수"(1이면 재시도 없음), OpenAI·Claude는 "재시도 횟수"라
# 같은 한 번 재시도라도 값이 다르다.
_MAX_RETRIES = {"google_genai": 2, "openai": 1, "anthropic": 1}


def _provider_kwargs(provider: str) -> dict[str, Any]:
    """공급자마다 다른 생성 옵션. 테스트가 실제 호출 없이 확인할 수 있게 따로 둔다."""
    kwargs: dict[str, Any] = {}
    if provider not in _NO_SAMPLING_PROVIDERS:
        kwargs["temperature"] = settings.LLM_TEMPERATURE
    if provider in _STREAM_USAGE_PROVIDERS:
        kwargs["stream_usage"] = True
    if provider in _MAX_RETRIES:
        kwargs["max_retries"] = _MAX_RETRIES[provider]
    return kwargs


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

    chat_model: BaseChatModel = init_chat_model(
        resolved_model,
        model_provider=resolved_provider,
        api_key=resolved_key or None,
        base_url=resolved_base_url or None,
        **_provider_kwargs(resolved_provider),
    )
    return chat_model
