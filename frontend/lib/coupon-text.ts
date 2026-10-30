import type { Coupon } from "@/lib/api"
import { APP_NAME } from "@/components/brand-logo"
import { planLabel } from "@/lib/llm-labels"

/** 카카오톡 등으로 그대로 보낼 수 있는 쿠폰 안내문. 코드와 사용처(현재 사이트 주소)를 포함한다. */
export function couponShareText(coupon: Coupon, origin: string): string {
    const plan = planLabel(coupon.plan)
    return [
        `[${APP_NAME} 쿠폰] ${plan} ${coupon.duration_label}`,
        `쿠폰 코드: ${coupon.code}`,
        `등록 기한: ${new Date(coupon.expires_at).toLocaleDateString("ko-KR")}까지`,
        `등록한 날부터 ${coupon.duration_label} 동안 ${plan} 요금제가 적용됩니다.`,
        `사용처: ${origin} → 로그인 → 설정 → 요금제와 쿠폰 → 쿠폰 등록`,
    ].join("\n")
}

/** 여러 장을 한 번에 보낼 때. 코드마다 한 장씩 안내문을 붙인다. */
export function couponsShareText(coupons: Coupon[], origin: string): string {
    return coupons.map((coupon) => couponShareText(coupon, origin)).join("\n\n")
}

/** 클립보드에 복사한다. 보안 컨텍스트가 아니면(http 로컬 IP 등) 옛 방식으로 시도한다. */
export async function copyToClipboard(text: string): Promise<void> {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        return
    }
    const area = document.createElement("textarea")
    area.value = text
    area.setAttribute("readonly", "")
    area.style.position = "fixed"
    area.style.opacity = "0"
    document.body.appendChild(area)
    area.select()
    try {
        document.execCommand("copy")
    } finally {
        document.body.removeChild(area)
    }
}
