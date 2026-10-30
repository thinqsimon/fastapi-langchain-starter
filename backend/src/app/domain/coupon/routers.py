"""coupon 도메인 - 라우터. 사용자용(등록)과 관리자용(발급·목록·취소)을 나눈다."""

import uuid

from fastapi import APIRouter, status

from app.domain.admin.dependencies import AdminUser
from app.domain.auth.dependencies import CurrentUser, DbSession
from app.domain.coupon.schemas import (
    CouponCreate,
    CouponRead,
    CouponRedeemRequest,
    CouponRedeemResponse,
    CouponStatus,
)
from app.domain.coupon.services import CouponService

router = APIRouter(prefix="/coupons", tags=["coupons"])
admin_router = APIRouter(prefix="/admin/coupons", tags=["admin"])


@router.post(
    "/redeem",
    response_model=CouponRedeemResponse,
    summary="쿠폰 등록",
    description=(
        "코드를 등록하면 그 순간부터 쿠폰 기간만큼 요금제가 적용됩니다. "
        "하이픈·대소문자는 상관없습니다.\n\n"
        "- 같은 요금제 쿠폰은 남은 기간 뒤에 이어 붙습니다\n"
        "- 상위 요금제 쿠폰은 지금부터 새로 시작합니다. 남은 기간이 사라지므로 "
        "먼저 409 `CONFIRM_REQUIRED`가 오고, "
        "`confirm: true`로 다시 보내면 적용됩니다\n"
        "- 하위 요금제 쿠폰은 지금 요금제가 끝난 뒤 등록해야 합니다(409)"
    ),
    responses={
        404: {"description": "없는 코드"},
        409: {
            "description": "사용됨·만료·취소, 요금제 규칙 위반, 또는 확인 필요(CONFIRM_REQUIRED)"
        },
    },
)
def redeem_coupon(
    payload: CouponRedeemRequest, current_user: CurrentUser, db: DbSession
) -> CouponRedeemResponse:
    return CouponService(db).redeem(current_user, payload)


@admin_router.get(
    "",
    response_model=list[CouponRead],
    summary="쿠폰 목록(최근 200장)",
    responses={403: {"description": "관리자가 아님"}},
)
def list_coupons(
    _admin: AdminUser, db: DbSession, status_filter: CouponStatus | None = None
) -> list[CouponRead]:
    return CouponService(db).list(status_filter)


@admin_router.post(
    "",
    response_model=list[CouponRead],
    status_code=status.HTTP_201_CREATED,
    summary="쿠폰 발급",
    description=(
        "요금제·기간·등록 기한·수량(1~20)을 정해 1회용 코드를 만듭니다. "
        "발급 뒤 코드는 목록과 복사 버튼으로 볼 수 있습니다."
    ),
    responses={403: {"description": "관리자가 아님"}},
)
def issue_coupons(payload: CouponCreate, admin: AdminUser, db: DbSession) -> list[CouponRead]:
    return CouponService(db).issue(admin, payload)


@admin_router.post(
    "/{coupon_id}/revoke",
    response_model=CouponRead,
    summary="쿠폰 취소(미사용만)",
    responses={
        403: {"description": "관리자가 아님"},
        404: {"description": "쿠폰 없음"},
        409: {"description": "이미 사용·만료·취소됨"},
    },
)
def revoke_coupon(coupon_id: uuid.UUID, _admin: AdminUser, db: DbSession) -> CouponRead:
    return CouponService(db).revoke(coupon_id)
