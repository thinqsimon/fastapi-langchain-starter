"""LLM 토큰 단가와 비용 추정.

⚠️ 아래 표는 기본값일 뿐이고 공급자가 수시로 바꾼다. 실제 청구와 맞추려면
`.env`의 `LLM_PRICE_INPUT_PER_1M` / `LLM_PRICE_OUTPUT_PER_1M`로 직접 지정한다.
표에 없는 모델은 0으로 계산되며 경고 로그를 남긴다.
"""

import logging
from decimal import Decimal

from app.core.config import settings

logger = logging.getLogger(__name__)

# 모델 → (입력 100만 토큰당 USD, 출력 100만 토큰당 USD)
DEFAULT_PRICES_USD_PER_MILLION: dict[str, tuple[str, str]] = {
    "gpt-4o-mini": ("0.15", "0.60"),
    "gpt-4o": ("2.50", "10.00"),
    "gpt-4.1-mini": ("0.40", "1.60"),
    "claude-haiku-4-5": ("1.00", "5.00"),
    "claude-sonnet-4-5": ("3.00", "15.00"),
    # 테스트용 공급자는 비용이 없다.
    "fake": ("0", "0"),
}

_MILLION = Decimal(1_000_000)


def _prices_for(model: str) -> tuple[Decimal, Decimal]:
    """설정값이 있으면 그것을 쓰고, 없으면 기본 표에서 찾는다."""
    if settings.LLM_PRICE_INPUT_PER_1M is not None:
        return (
            Decimal(str(settings.LLM_PRICE_INPUT_PER_1M)),
            Decimal(str(settings.LLM_PRICE_OUTPUT_PER_1M or 0)),
        )

    prices = DEFAULT_PRICES_USD_PER_MILLION.get(model)
    if prices is None:
        logger.warning(
            "unknown_model_pricing model=%s — 비용을 0으로 계산합니다. "
            "LLM_PRICE_INPUT_PER_1M / LLM_PRICE_OUTPUT_PER_1M를 설정하세요.",
            model,
        )
        return Decimal(0), Decimal(0)

    return Decimal(prices[0]), Decimal(prices[1])


def estimate_cost_usd(model: str, input_tokens: int, output_tokens: int) -> Decimal:
    """토큰 수로 비용을 추정한다(달러). 소수점 6자리까지."""
    input_price, output_price = _prices_for(model)
    cost = (Decimal(input_tokens) * input_price + Decimal(output_tokens) * output_price) / _MILLION
    return cost.quantize(Decimal("0.000001"))
