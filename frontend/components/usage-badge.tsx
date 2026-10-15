"use client"

import { useEffect } from "react"

import { useUsageStore } from "@/store/usage"

/** 헤더에 표시하는 내 LLM 사용량. 비용은 추정치다. */
export function UsageBadge() {
    const usage = useUsageStore((state) => state.usage)
    const refresh = useUsageStore((state) => state.refresh)

    useEffect(() => {
        void refresh()
        // 대화가 오가는 동안에도 값이 따라오도록 주기적으로 다시 읽는다.
        const timer = setInterval(() => void refresh(), 30_000)
        return () => clearInterval(timer)
    }, [refresh])

    if (!usage || usage.message_count === 0) return null

    return (
        <span className="text-xs text-muted-foreground" title={`${usage.model} · 입력 ${usage.input_tokens} / 출력 ${usage.output_tokens} 토큰`}>
            {usage.total_tokens.toLocaleString()} 토큰 · 약 ${usage.estimated_cost_usd}
        </span>
    )
}
