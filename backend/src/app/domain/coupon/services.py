"""coupon 도메인 - 비즈니스 로직.

- 발급(관리자): 요금제(pro/max)·기간(7일~12개월)·등록 기한(7~90일)·수량(1~20)·메모
- 등록(사용자): 코드 1회 사용. 등록한 순간부터 기간을 센다
  · Free → 바로 적용
  · 같은 요금제 → 남은 기간 뒤에 이어 붙인다
  · 상위 요금제(Pro 중 Max) → 지금부터 새로 시작. 남은 기간이 사라지므로 `confirm` 없이 오면
    409(CONFIRM_REQUIRED)로 확인을 요청한다
  · 하위 요금제(Max 중 Pro) → 거부(쿠폰은 살아 있다)
"""

import logging
import secrets
import uuid
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.core.exceptions import ConfirmRequiredError, ConflictError, NotFoundError
from app.core.plans import DEFAULT_PLAN, PLANS
from app.domain.auth.models import User
from app.domain.auth.repositories import UserRepository
from app.domain.coupon.models import Coupon
from app.domain.coupon.periods import DURATION_LABELS, add_duration, utcnow
from app.domain.coupon.repositories import CouponRepository
from app.domain.coupon.schemas import (
    CouponCreate,
    CouponRead,
    CouponRedeemRequest,
    CouponRedeemResponse,
    CouponStatus,
)

logger = logging.getLogger(__name__)

# 0/O, 1/I처럼 헷갈리는 글자를 뺀 32자. 12자리면 32^12(약 1.2×10^18)가지라 추측이 불가능하다.
CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
CODE_LENGTH = 12
PLAN_RANK: dict[str, int] = {plan: index for index, plan in enumerate(PLANS)}
PLAN_LABELS = {"free": "Free", "pro": "Pro", "max": "Max"}


def generate_code() -> str:
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))


def normalize_code(raw: str) -> str:
    """사용자가 붙여 넣은 코드에서 하이픈·공백을 빼고 대문자로 맞춘다."""
    return "".join(ch for ch in raw.upper() if ch.isalnum())


def format_code(code: str) -> str:
    return "-".join(code[i : i + 4] for i in range(0, len(code), 4))


def status_of(coupon: Coupon, now: datetime) -> CouponStatus:
    if coupon.revoked_at is not None:
        return "revoked"
    if coupon.redeemed_at is not None:
        return "redeemed"
    if coupon.expires_at <= now:
        return "expired"
    return "active"


class CouponService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.coupons = CouponRepository(db)
        self.users = UserRepository(db)

    # ----- 관리자 -----

    def issue(self, admin: User, payload: CouponCreate) -> list[CouponRead]:
        now = utcnow()
        batch_id = uuid.uuid4()
        expires_at = now + timedelta(days=payload.valid_days)
        created: list[Coupon] = []
        for _ in range(payload.quantity):
            code = generate_code()
            while self.coupons.exists(code):  # 충돌은 사실상 없지만 혹시 몰라 다시 뽑는다
                code = generate_code()
            created.append(
                self.coupons.create(
                    code=code,
                    plan=payload.plan,
                    duration=payload.duration,
                    expires_at=expires_at,
                    memo=payload.memo or None,
                    batch_id=batch_id,
                    created_by=admin.id,
                )
            )
        self.db.commit()
        logger.info(
            "coupon_issued admin=%s plan=%s duration=%s valid_days=%s count=%s batch=%s",
            admin.id,
            payload.plan,
            payload.duration,
            payload.valid_days,
            len(created),
            batch_id,
        )
        return [self._to_read(c, now, {}) for c in created]

    def list(self, status: CouponStatus | None = None) -> list[CouponRead]:
        now = utcnow()
        emails: dict[uuid.UUID, str | None] = {}
        rows = [self._to_read(c, now, emails) for c in self.coupons.list_recent()]
        return [row for row in rows if status is None or row.status == status]

    def revoke(self, coupon_id: uuid.UUID) -> CouponRead:
        coupon = self.coupons.get(coupon_id)
        if coupon is None:
            raise NotFoundError("쿠폰을 찾을 수 없습니다.")
        now = utcnow()
        if status_of(coupon, now) != "active":
            raise ConflictError("미사용 쿠폰만 취소할 수 있습니다.")
        coupon.revoked_at = now
        self.db.commit()
        logger.info("coupon_revoked coupon=%s", coupon.id)
        return self._to_read(coupon, now, {})

    # ----- 사용자 -----

    def redeem(self, user: User, payload: CouponRedeemRequest) -> CouponRedeemResponse:
        now = utcnow()
        coupon = self.coupons.get_by_code(normalize_code(payload.code))
        if coupon is None:
            raise NotFoundError("없는 쿠폰 코드예요. 코드를 다시 확인해 주세요.")
        status = status_of(coupon, now)
        if status == "revoked":
            raise ConflictError("취소된 쿠폰이에요.")
        if status == "redeemed":
            raise ConflictError("이미 사용한 쿠폰이에요.")
        if status == "expired":
            raise ConflictError("등록 기한이 지난 쿠폰이에요.")

        current_plan, current_until = user.plan, user.plan_expires_at
        if current_plan != DEFAULT_PLAN and current_until is not None and current_until <= now:
            current_plan, current_until = DEFAULT_PLAN, None
        current_rank = PLAN_RANK.get(current_plan, 0)
        coupon_rank = PLAN_RANK[coupon.plan]
        coupon_label = f"{PLAN_LABELS[coupon.plan]} {DURATION_LABELS[coupon.duration]}"
        current_label = PLAN_LABELS.get(current_plan, current_plan)

        if current_rank == 0:
            new_until = add_duration(now, coupon.duration)
        elif coupon_rank == current_rank:
            if current_until is None:
                raise ConflictError(
                    f"이미 {current_label} 요금제를 기한 없이 이용 중이라 이 쿠폰은 필요 없어요."
                )
            # 같은 요금제는 남은 기간 뒤에 이어 붙인다.
            new_until = add_duration(current_until, coupon.duration)
        elif coupon_rank > current_rank:
            if not payload.confirm:
                remaining = (
                    f"{current_until:%Y-%m-%d}까지 남은 {current_label} 기간"
                    if current_until is not None
                    else f"기한 없는 {current_label} 요금제"
                )
                raise ConfirmRequiredError(
                    f"{coupon_label} 쿠폰을 등록하면 지금부터 {PLAN_LABELS[coupon.plan]}가 "
                    f"적용되고 "
                    f"{remaining}은 사라져요. 계속할까요?",
                    details={
                        "current_plan": current_plan,
                        "current_expires_at": current_until.isoformat() if current_until else None,
                        "coupon_plan": coupon.plan,
                        "coupon_duration": coupon.duration,
                    },
                )
            new_until = add_duration(now, coupon.duration)
        else:
            raise ConflictError(
                f"지금 {current_label}를 이용 중이라 {coupon_label} 쿠폰은 등록할 수 없어요. "
                f"{current_label}가 끝난 뒤 등록해 주세요."
            )

        user.plan = coupon.plan
        user.plan_expires_at = new_until
        coupon.redeemed_by = user.id
        coupon.redeemed_at = now
        coupon.plan_until = new_until
        self.db.commit()
        logger.info(
            "coupon_redeemed user=%s coupon=%s plan=%s until=%s",
            user.id,
            coupon.id,
            coupon.plan,
            new_until,
        )
        return CouponRedeemResponse(
            plan=coupon.plan,
            plan_expires_at=new_until,
            message=f"{coupon_label} 쿠폰을 등록했어요.",
        )

    def _to_read(
        self, coupon: Coupon, now: datetime, emails: dict[uuid.UUID, str | None]
    ) -> CouponRead:
        email: str | None = None
        if coupon.redeemed_by is not None:
            if coupon.redeemed_by not in emails:
                redeemer = self.users.get_by_id(coupon.redeemed_by)
                emails[coupon.redeemed_by] = redeemer.email if redeemer else None
            email = emails[coupon.redeemed_by]
        return CouponRead(
            id=coupon.id,
            code=format_code(coupon.code),
            plan=coupon.plan,  # type: ignore[arg-type]
            duration=coupon.duration,  # type: ignore[arg-type]
            duration_label=DURATION_LABELS.get(coupon.duration, coupon.duration),
            expires_at=coupon.expires_at,
            memo=coupon.memo,
            batch_id=coupon.batch_id,
            status=status_of(coupon, now),
            created_at=coupon.created_at,
            redeemed_at=coupon.redeemed_at,
            redeemed_by_email=email,
            plan_until=coupon.plan_until,
            revoked_at=coupon.revoked_at,
        )
