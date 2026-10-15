"""usage 도메인 - 응답 스키마."""

from decimal import Decimal

from pydantic import BaseModel


class UsageSummary(BaseModel):
    model: str
    message_count: int
    input_tokens: int
    output_tokens: int
    total_tokens: int
    estimated_cost_usd: Decimal
