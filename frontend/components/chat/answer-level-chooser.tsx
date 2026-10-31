"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import { errorMessage } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { DEFAULT_ANSWER_LEVEL, answerLevelLabel, josaRo } from "@/lib/answer-level"
import { useAnswerLevelStore } from "@/store/answer-level"
import { useAuthStore } from "@/store/auth"

/**
 * 아직 답변 수준을 고르지 않은 사용자에게 채팅 위에 한 번 보여 주는 안내(CHAT-03).
 * 고르면 사라진다. "나중에"는 이 화면에서만 숨기고, 고를 때까지 다음 방문에 다시 보인다.
 */
export function AnswerLevelChooser() {
    const user = useAuthStore((state) => state.user)
    const updateAnswerLevel = useAuthStore((state) => state.updateAnswerLevel)
    const levels = useAnswerLevelStore((state) => state.levels)
    const load = useAnswerLevelStore((state) => state.load)
    const [dismissed, setDismissed] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const needsChoice = !!user && user.answer_level === null

    useEffect(() => {
        if (needsChoice) void load()
    }, [needsChoice, load])

    if (!needsChoice || dismissed) return null

    async function choose(level: number) {
        setBusy(true)
        setError(null)
        try {
            await updateAnswerLevel(level)
        } catch (caught) {
            setError(errorMessage(caught, "답변 수준을 저장하지 못했습니다."))
        } finally {
            setBusy(false)
        }
    }

    return (
        <section aria-label="답변 수준 고르기" data-slot="answer-level-chooser" className="shrink-0 border-b bg-sky-50/70 px-4 py-3 sm:px-6">
            <p className="text-sm font-medium">어떤 수준으로 설명해 드릴까요?</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
                고르기 전에는 {answerLevelLabel(DEFAULT_ANSWER_LEVEL, levels)}
                {josaRo(answerLevelLabel(DEFAULT_ANSWER_LEVEL, levels))} 답해요. 설정에서 언제든 바꿀 수 있어요.{" "}
                <Link href="/settings" className="underline underline-offset-2">
                    단계 설명 보기
                </Link>
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
                {levels.map((item) => (
                    <Button
                        key={item.level}
                        type="button"
                        size="sm"
                        variant="outline"
                        className="bg-background"
                        title={`${item.audience} · ${item.style}`}
                        disabled={busy}
                        onClick={() => void choose(item.level)}
                    >
                        {item.level}단계 {item.name}
                    </Button>
                ))}
                <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setDismissed(true)}>
                    나중에
                </Button>
            </div>
            {error && (
                <p role="alert" className="mt-2 text-sm text-destructive">
                    {error}
                </p>
            )}
        </section>
    )
}
