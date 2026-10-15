"""usage 도메인 - 비즈니스 로직."""

import uuid

from sqlalchemy.orm import Session

from app.core.config import settings
from app.domain.usage.repositories import UsageRepository
from app.domain.usage.schemas import UsageSummary
from app.llm.pricing import estimate_cost_usd


class UsageService:
    def __init__(self, db: Session) -> None:
        self.usage = UsageRepository(db)

    def summary_for_user(self, user_id: uuid.UUID) -> UsageSummary:
        message_count, input_tokens, output_tokens = self.usage.totals_for_user(user_id)

        return UsageSummary(
            model=settings.LLM_MODEL,
            message_count=message_count,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=input_tokens + output_tokens,
            estimated_cost_usd=estimate_cost_usd(settings.LLM_MODEL, input_tokens, output_tokens),
        )
