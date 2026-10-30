import { httpClient } from "./client"
import type { Coupon, CouponCreate, CouponRedeemResult, CouponStatus } from "./types"

/** 쿠폰 코드를 등록한다. 상위 요금제로 바꾸는 경우 서버가 409 CONFIRM_REQUIRED를 주면 confirm=true로 다시 보낸다. */
export async function redeemCoupon(code: string, confirm = false): Promise<CouponRedeemResult> {
    const { data } = await httpClient.post<CouponRedeemResult>("/api/coupons/redeem", { code, confirm })
    return data
}

/** 관리자: 쿠폰 발급(1~20장). 발급된 코드 목록을 돌려준다. */
export async function issueCoupons(payload: CouponCreate): Promise<Coupon[]> {
    const { data } = await httpClient.post<Coupon[]>("/api/admin/coupons", payload)
    return data
}

/** 관리자: 최근 200장. 상태로 거를 수 있다. */
export async function fetchCoupons(status?: CouponStatus): Promise<Coupon[]> {
    const { data } = await httpClient.get<Coupon[]>("/api/admin/coupons", { params: status ? { status_filter: status } : {} })
    return data
}

/** 관리자: 미사용 쿠폰 취소. */
export async function revokeCoupon(couponId: string): Promise<Coupon> {
    const { data } = await httpClient.post<Coupon>(`/api/admin/coupons/${couponId}/revoke`)
    return data
}
