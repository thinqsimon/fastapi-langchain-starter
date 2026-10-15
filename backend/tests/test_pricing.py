"""OPT-USAGE 비용 계산 검증."""

from decimal import Decimal

from app.llm.pricing import estimate_cost_usd


def test_known_model_uses_price_table() -> None:
    # gpt-4o-mini: 입력 $0.15 / 출력 $0.60 per 1M
    cost = estimate_cost_usd("gpt-4o-mini", input_tokens=1_000_000, output_tokens=1_000_000)

    assert cost == Decimal("0.750000")


def test_small_usage_keeps_precision() -> None:
    cost = estimate_cost_usd("gpt-4o-mini", input_tokens=1_000, output_tokens=500)

    # 1000 * 0.15/1M + 500 * 0.60/1M = 0.00015 + 0.0003
    assert cost == Decimal("0.000450")


def test_unknown_model_costs_zero_instead_of_crashing() -> None:
    """단가를 모르는 모델이라고 API가 실패하면 안 된다."""
    assert estimate_cost_usd("some-new-model", 1_000, 1_000) == Decimal("0.000000")


def test_fake_provider_is_free() -> None:
    assert estimate_cost_usd("fake", 10_000, 10_000) == Decimal("0.000000")
