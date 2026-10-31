"""ADMIN-04: 요금제별 기본 모델 사다리와 공급자별 생성 옵션."""

import pytest

from app.core.config import settings
from app.domain.admin.defaults import DEFAULT_MODEL_BY_PLAN, DEFAULT_ROUTES
from app.llm import providers
from app.llm.pricing import DEFAULT_PRICES_USD_PER_MILLION, estimate_cost_usd


def _cost(model: str) -> float:
    """입력·출력 각 100만 토큰 기준 비용. 사다리가 '한 단계씩 비싼지' 비교하는 데 쓴다."""
    return float(estimate_cost_usd(model, 1_000_000, 1_000_000))


def test_every_plan_has_all_three_providers_and_known_prices() -> None:
    assert set(DEFAULT_ROUTES) == {"free", "pro", "max"}
    for routes in DEFAULT_ROUTES.values():
        assert sorted(provider for provider, _ in routes) == ["anthropic", "google_genai", "openai"]
        # 단가표에 없으면 비용이 0으로 잡힌다.
        assert all(model in DEFAULT_PRICES_USD_PER_MILLION for _, model in routes)


@pytest.mark.parametrize("provider", ["openai", "anthropic", "google_genai"])
def test_each_provider_gets_pricier_from_free_to_pro_to_max(provider: str) -> None:
    free, pro, max_ = (DEFAULT_MODEL_BY_PLAN[plan][provider] for plan in ("free", "pro", "max"))
    assert _cost(free) < _cost(pro) <= _cost(max_)
    if provider != "google_genai":  # Gemini는 2.5 Pro 위로 안정판이 없어 Max도 같은 모델
        assert _cost(pro) < _cost(max_)


def test_first_choice_of_each_plan_is_pricier_than_the_plan_below() -> None:
    """요금제의 1순위 모델은 아래 요금제의 1순위보다 입력 단가가 비싸다."""
    first = {plan: routes[0][1] for plan, routes in DEFAULT_ROUTES.items()}
    price = {plan: float(DEFAULT_PRICES_USD_PER_MILLION[m][0]) for plan, m in first.items()}
    assert price["free"] < price["pro"] < price["max"]


def test_claude_requests_never_carry_temperature() -> None:
    """anthropic SDK 2.x(API 2026-10-21)는 temperature를 거부한다. OpenAI·Gemini에는 보낸다."""
    assert "temperature" not in providers._provider_kwargs("anthropic")
    assert providers._provider_kwargs("openai") == {
        "temperature": settings.LLM_TEMPERATURE,
        "stream_usage": True,
        "max_retries": 1,
    }
    assert providers._provider_kwargs("google_genai") == {
        "temperature": settings.LLM_TEMPERATURE,
        "max_retries": 2,
    }


def test_claude_5_5_model_builds_without_temperature(monkeypatch: pytest.MonkeyPatch) -> None:
    """호출 없이 요청 본문만 만들어 본다. temperature가 실리면 langchain이 ValueError를 낸다."""
    monkeypatch.setattr(
        settings, "LLM_PROVIDER", "openai"
    )  # fake 안전장치를 끄고 진짜 모델 객체를 만든다
    model = providers.get_chat_model(provider="anthropic", model="claude-sonnet-5-5", api_key="k")
    payload = model._get_request_payload([("user", "안녕")])  # type: ignore[attr-defined]
    assert payload["model"] == "claude-sonnet-5-5"
    assert "temperature" not in payload


@pytest.mark.parametrize(
    ("provider", "model", "retries"),
    [
        ("google_genai", "gemini-2.5-flash", 2),
        ("openai", "gpt-4o-mini", 1),
        ("anthropic", "claude-haiku-5-5", 1),
    ],
)
def test_sdk_retries_stay_small_so_failover_is_quick(
    monkeypatch: pytest.MonkeyPatch, provider: str, model: str, retries: int
) -> None:
    """공급자 안에서 오래 다시 시도하지 않고 우선순위 다음 공급자로 넘어간다.

    Gemini 기본값(6회 시도)으로는 실패를 알기까지 15초쯤 걸렸다.
    """
    monkeypatch.setattr(
        settings, "LLM_PROVIDER", "openai"
    )  # fake 안전장치를 끄고 진짜 모델 객체를 만든다
    chat_model = providers.get_chat_model(provider=provider, model=model, api_key="k")
    assert chat_model.max_retries == retries  # type: ignore[attr-defined]
