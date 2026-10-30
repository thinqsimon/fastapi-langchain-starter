"""coupon 도메인 - 요청/응답 스키마."""

import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints

from app.domain.coupon.periods import DEFAULT_VALID_DAYS, CouponDuration, ValidDays

CouponPlan = Literal["pro", "max"]
CouponStatus = Literal["active", "redeemed", "expired", "revoked"]


class CouponCreate(BaseModel):
    plan: CouponPlan
    duration: CouponDuration
    valid_days: ValidDays = DEFAULT_VALID_DAYS
    quantity: int = Field(default=1, ge=1, le=20)
    memo: Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)] | None = None


class CouponRead(BaseModel):
    id: uuid.UUID
    # XXXX-XXXX-XXXX 형식
    code: str
    plan: CouponPlan
    duration: CouponDuration
    duration_label: str
    expires_at: datetime
    memo: str | None
    batch_id: uuid.UUID
    status: CouponStatus
    created_at: datetime
    redeemed_at: datetime | None
    redeemed_by_email: str | None
    plan_until: datetime | None
    revoked_at: datetime | None


class CouponRedeemRequest(BaseModel):
    code: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=32)]
    # 상위 요금제 쿠폰으로 바꿀 때 남은 기간이 사라진다는 안내를 보고 동의했는지.
    confirm: bool = False


class CouponRedeemResponse(BaseModel):
    plan: str
    plan_expires_at: datetime
    message: str
