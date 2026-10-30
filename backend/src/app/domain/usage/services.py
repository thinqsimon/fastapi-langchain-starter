"""usage 도메인 - 비즈니스 로직."""

import uuid
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.config import settings
from app.domain.usage.repositories import UsageRepository
from app.domain.usage.schemas import ModelUsage, UsageSummary
from app.llm.pricing import estimate_cost_usd


class UsageService:
    def __init__(self, db: Session) -> None:
        self.usage = UsageRepository(db)

    def summary_for_user(self, user_id: uuid.UUID) -> UsageSummary:
        """모델별로 단가를 따로 적용해 합산한다.

        관리자가 공급자 우선순위를 바꾸면(ADMIN-01) 한 계정 안에 OpenAI·Gemini 답변이 섞인다.
        .env의 모델 하나로 계산하면 비용이 틀리므로 메시지에 저장된 모델을 쓴다.
        모델을 기록하기 전의 답변(NULL)은 예전처럼 .env의 LLM_MODEL로 본다.
        """
        by_model = [
            ModelUsage(
                provider=provider,
                model=model or settings.LLM_MODEL,
                message_count=count,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                estimated_cost_usd=estimate_cost_usd(
                    model or settings.LLM_MODEL, input_tokens, output_tokens
                ),
            )
            for provider, model, count, input_tokens, output_tokens in self.usage.totals_by_model(
                user_id
            )
        ]

        input_tokens = sum(item.input_tokens for item in by_model)
        output_tokens = sum(item.output_tokens for item in by_model)
        return UsageSummary(
            model=by_model[0].model if by_model else settings.LLM_MODEL,
            message_count=sum(item.message_count for item in by_model),
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=input_tokens + output_tokens,
            estimated_cost_usd=sum(
                (item.estimated_cost_usd for item in by_model), Decimal("0.000000")
            ),
            by_model=by_model,
        )
