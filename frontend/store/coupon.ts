import { create } from "zustand"

import { couponApi, errorMessage, type Coupon, type CouponCreate, type CouponStatus } from "@/lib/api"

type CouponState = {
    coupons: Coupon[]
    /** 방금 발급한 묶음(복사 버튼용). */
    issued: Coupon[]
    isLoading: boolean
    error: string | null
    load: (status?: CouponStatus) => Promise<void>
    issue: (payload: CouponCreate) => Promise<Coupon[]>
    revoke: (couponId: string) => Promise<Coupon>
    reset: () => void
}

export const useCouponStore = create<CouponState>((set) => ({
    coupons: [],
    issued: [],
    isLoading: false,
    error: null,

    load: async (status) => {
        set({ isLoading: true, error: null })
        try {
            set({ coupons: await couponApi.fetchCoupons(status), isLoading: false })
        } catch (caught) {
            set({ isLoading: false, error: errorMessage(caught, "쿠폰 목록을 불러오지 못했습니다.") })
        }
    },

    issue: async (payload) => {
        const issued = await couponApi.issueCoupons(payload)
        set((state) => ({ issued, coupons: [...issued, ...state.coupons] }))
        return issued
    },

    revoke: async (couponId) => {
        const updated = await couponApi.revokeCoupon(couponId)
        set((state) => ({
            coupons: state.coupons.map((coupon) => (coupon.id === couponId ? updated : coupon)),
            issued: state.issued.map((coupon) => (coupon.id === couponId ? updated : coupon)),
        }))
        return updated
    },

    reset: () => set({ coupons: [], issued: [], isLoading: false, error: null }),
}))
