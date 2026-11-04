"""admin 도메인 - 데이터 접근 계층."""

import uuid
from datetime import datetime
from typing import Any, cast

from sqlalchemy import CursorResult, func, select, update
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

    def claim_recheck(self, provider: str, now: datetime, checked_before: datetime) -> bool:
        """소진된 공급사를 다시 시도할 차례를 잡는다. 조건부 UPDATE라 동시에도 한 건만 된다."""
        result = self.db.execute(
            update(LlmProvider)
            .where(
                LlmProvider.provider == provider,
                LlmProvider.exhausted_at.is_not(None),
                LlmProvider.exhausted_checked_at <= checked_before,
            )
            .values(exhausted_checked_at=now)
            .execution_options(synchronize_session=False)
        )
        return cast(CursorResult[Any], result).rowcount == 1

    def mark_exhausted(self, provider: str, now: datetime) -> None:
        """처음 감지한 시각은 그대로 두고 마지막 확인 시각만 고친다."""
        self.db.execute(
            update(LlmProvider)
            .where(LlmProvider.provider == provider)
            .values(
                exhausted_at=func.coalesce(LlmProvider.exhausted_at, now),
                exhausted_checked_at=now,
            )
            .execution_options(synchronize_session=False)
        )

    def clear_exhausted(self, provider: str) -> bool:
        """소진 표시를 지운다. 지울 것이 있었으면 True."""
        result = self.db.execute(
            update(LlmProvider)
            .where(LlmProvider.provider == provider, LlmProvider.exhausted_at.is_not(None))
            .values(exhausted_at=None, exhausted_checked_at=None)
            .execution_options(synchronize_session=False)
        )
        return cast(CursorResult[Any], result).rowcount == 1


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
