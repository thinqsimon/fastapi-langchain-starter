"""usage 도메인 - 응답 스키마."""

from decimal import Decimal

from pydantic import BaseModel


class ModelUsage(BaseModel):
    """모델 하나의 사용량. 공급자 우선순위 전환(ADMIN-01)으로 여러 모델이 섞일 수 있다."""

    # 이 컬럼이 생기기 전 답변은 공급자를 모른다(null). 모델은 그때의 .env 값으로 본다.
    provider: str | None
    model: str
    message_count: int
    input_tokens: int
    output_tokens: int
    estimated_cost_usd: Decimal


class UsageSummary(BaseModel):
    # 가장 많이 쓴 모델(하위 호환). 자세한 내역은 by_model.
    model: str
    message_count: int
    input_tokens: int
    output_tokens: int
    total_tokens: int
    estimated_cost_usd: Decimal
    by_model: list[ModelUsage] = []
