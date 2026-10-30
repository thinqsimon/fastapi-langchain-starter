"""admin 도메인 - 데이터 접근 계층."""

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.domain.admin.models import LlmPlanRoute, LlmProvider


class LlmProviderRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_all(self) -> list[LlmProvider]:
        return list(self.db.execute(select(LlmProvider)).scalars())

    def get(self, provider: str) -> LlmProvider | None:
        return self.db.execute(
            select(LlmProvider).where(LlmProvider.provider == provider)
        ).scalar_one_or_none()

    def create(self, provider: str) -> LlmProvider:
        row = LlmProvider(provider=provider)
        self.db.add(row)
        self.db.flush()
        return row


class LlmPlanRouteRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_all(self) -> list[LlmPlanRoute]:
        return list(
            self.db.execute(
                select(LlmPlanRoute).order_by(
                    LlmPlanRoute.plan, LlmPlanRoute.priority, LlmPlanRoute.created_at
                )
            ).scalars()
        )

    def list_for_plan(self, plan: str) -> list[LlmPlanRoute]:
        return list(
            self.db.execute(
                select(LlmPlanRoute)
                .where(LlmPlanRoute.plan == plan)
                .order_by(LlmPlanRoute.priority, LlmPlanRoute.created_at)
            ).scalars()
        )

    def get(self, route_id: uuid.UUID) -> LlmPlanRoute | None:
        return self.db.get(LlmPlanRoute, route_id)

    def next_priority(self, plan: str) -> int:
        current = self.db.execute(
            select(func.max(LlmPlanRoute.priority)).where(LlmPlanRoute.plan == plan)
        ).scalar_one()
        return int(current or 0) + 1

    def create(self, plan: str, provider: str, model: str, priority: int) -> LlmPlanRoute:
        row = LlmPlanRoute(plan=plan, provider=provider, model=model, priority=priority)
        self.db.add(row)
        self.db.flush()
        return row

    def delete(self, route: LlmPlanRoute) -> None:
        self.db.delete(route)
        self.db.flush()

    def clear_forced_except(self, plan: str, route_id: uuid.UUID) -> None:
        """강제 사용은 요금제당 하나만. 새로 켤 라우트를 뺀 같은 요금제의 나머지를 끈다."""
        rows = self.db.execute(
            select(LlmPlanRoute).where(
                LlmPlanRoute.plan == plan,
                LlmPlanRoute.forced.is_(True),
                LlmPlanRoute.id != route_id,
            )
        ).scalars()
        for row in rows:
            row.forced = False
        self.db.flush()
