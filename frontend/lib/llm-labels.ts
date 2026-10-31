/** 서버의 공급자 식별자(langchain 이름)를 화면용 이름으로. 관리자 화면과 답변 표기가 같이 쓴다. */
const PROVIDER_LABELS: Record<string, string> = {
    openai: "OpenAI",
    anthropic: "Claude",
    google_genai: "Gemini",
    fake: "테스트",
}

export function providerLabel(provider: string): string {
    return PROVIDER_LABELS[provider] ?? provider
}

/** 답변 아래에 붙는 "Gemini · gemini-2.5-flash" 같은 표기. 공급자를 모르는(예전) 답변은 null. */
export function answeredByLabel(provider: string | null | undefined, model: string | null | undefined): string | null {
    if (!provider) return null
    if (provider === "fake") return "테스트 응답"
    return model ? `${providerLabel(provider)} · ${model}` : providerLabel(provider)
}

/** 요금제 목록과 표시명. 서버의 app/core/plans.py와 같은 순서다. */
export const PLANS = ["free", "pro", "max"] as const
const PLAN_LABELS: Record<string, string> = { free: "Free", pro: "Pro", max: "Max" }

export function planLabel(plan: string): string {
    return PLAN_LABELS[plan] ?? plan
}

/** 유료 요금제의 만료일까지 붙인 표기. "Pro · 2026. 11. 30.까지", 기한 없으면 "Pro · 기한 없음", Free는 "Free". */
export function planPeriodLabel(plan: string, expiresAt: string | null | undefined): string {
    const label = planLabel(plan)
    if (plan === "free") return label
    return expiresAt ? `${label} · ${new Date(expiresAt).toLocaleDateString("ko-KR")}까지` : `${label} · 기한 없음`
}

/** 쿠폰 기간 코드(서버 app/domain/coupon/periods.py와 같은 순서)와 표시명. */
export const COUPON_DURATIONS = ["7d", "15d", "1m", "3m", "6m", "12m"] as const
export const COUPON_DURATION_LABELS: Record<string, string> = { "7d": "7일", "15d": "15일", "1m": "1개월", "3m": "3개월", "6m": "6개월", "12m": "12개월" }
export const COUPON_VALID_DAYS = [7, 14, 30, 90] as const

/**
 * 요금제별 기본 모델(백엔드 app/domain/admin/defaults.py와 같은 값). 라우트 추가 폼이 미리 채운다.
 * Free는 가장 싼 모델, Pro·Max는 공급자마다 한 단계씩 비싼 모델.
 */
export const DEFAULT_ROUTE_MODELS: Record<string, Record<string, string>> = {
    free: { google_genai: "gemini-2.5-flash", openai: "gpt-4o-mini", anthropic: "claude-haiku-5-5" },
    pro: { google_genai: "gemini-2.5-pro", openai: "gpt-4.1-mini", anthropic: "claude-sonnet-5-5" },
    max: { openai: "gpt-4.1", google_genai: "gemini-2.5-pro", anthropic: "claude-opus-5-5" },
}
