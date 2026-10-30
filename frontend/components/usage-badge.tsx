"use client"

import { useEffect } from "react"

import { providerLabel } from "@/lib/llm-labels"
import { useUsageStore } from "@/store/usage"

/** 내 LLM 사용량(계정 메뉴에 표시). 비용은 추정치다. */
export function UsageBadge({ emptyText }: { emptyText?: string }) {
    const usage = useUsageStore((state) => state.usage)
    const refresh = useUsageStore((state) => state.refresh)

    useEffect(() => {
        void refresh()
        // 대화가 오가는 동안에도 값이 따라오도록 주기적으로 다시 읽는다.
        const timer = setInterval(() => void refresh(), 30_000)
        return () => clearInterval(timer)
    }, [refresh])

    if (!usage || usage.message_count === 0) {
        return emptyText ? <span className="text-xs text-muted-foreground">{emptyText}</span> : null
    }

    // 모델이 섞이면(공급자 전환) 모델별 내역을 툴팁으로 보여 준다. 비용은 모델별 단가로 합산된 값이다.
    const detail = (usage.by_model ?? [])
        .map(
            (item) =>
                `${item.provider ? `${providerLabel(item.provider)} · ` : ""}${item.model}: 입력 ${item.input_tokens.toLocaleString()} / 출력 ${item.output_tokens.toLocaleString()} 토큰 · 약 $${item.estimated_cost_usd}`
        )
        .join("\n")

    return (
        <span className="text-xs text-muted-foreground" title={detail || `${usage.model} · 입력 ${usage.input_tokens} / 출력 ${usage.output_tokens} 토큰`}>
            {usage.total_tokens.toLocaleString()} 토큰 · 약 ${usage.estimated_cost_usd}
        </span>
    )
}
