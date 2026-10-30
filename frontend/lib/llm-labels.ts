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
