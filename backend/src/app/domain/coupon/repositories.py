"""coupon 도메인 - 데이터 접근 계층."""

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.coupon.models import Coupon


class CouponRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(
        self,
        *,
        code: str,
        plan: str,
        duration: str,
        expires_at: datetime,
        memo: str | None,
        batch_id: uuid.UUID,
        created_by: uuid.UUID,
    ) -> Coupon:
        coupon = Coupon(
            code=code,
            plan=plan,
            duration=duration,
            expires_at=expires_at,
            memo=memo,
            batch_id=batch_id,
            created_by=created_by,
        )
        self.db.add(coupon)
        self.db.flush()
        return coupon

    def get(self, coupon_id: uuid.UUID) -> Coupon | None:
        return self.db.get(Coupon, coupon_id)

    def get_by_code(self, code: str) -> Coupon | None:
        return self.db.execute(select(Coupon).where(Coupon.code == code)).scalar_one_or_none()

    def exists(self, code: str) -> bool:
        return self.get_by_code(code) is not None

    def list_recent(self, limit: int = 200) -> list[Coupon]:
        return list(
            self.db.execute(
                select(Coupon).order_by(Coupon.created_at.desc(), Coupon.code).limit(limit)
            ).scalars()
        )
