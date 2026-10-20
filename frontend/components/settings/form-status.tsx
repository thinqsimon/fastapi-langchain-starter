"use client"

import { useState } from "react"

import { errorMessage } from "@/api"

export type FormResult = { kind: "success" | "error"; message: string }

/** 설정 폼마다 반복되는 "저장 중 → 성공/실패 메시지" 처리. */
export function useFormAction() {
    const [result, setResult] = useState<FormResult | null>(null)
    const [isPending, setIsPending] = useState(false)

    /** action이 돌려준 문장을 성공 메시지로 보여준다. 실패하면 서버 메시지(없으면 fallback)를 보여준다. */
    async function run(action: () => Promise<string>, fallback: string) {
        setIsPending(true)
        setResult(null)
        try {
            setResult({ kind: "success", message: await action() })
        } catch (caught) {
            setResult({ kind: "error", message: errorMessage(caught, fallback) })
        } finally {
            setIsPending(false)
        }
    }

    return { result, isPending, run, fail: (message: string) => setResult({ kind: "error", message }) }
}

export function FormStatus({ result }: { result: FormResult | null }) {
    if (!result) return null
    // E2E에서 Next.js route announcer(role="alert")와 겹치지 않게 p 태그에 역할을 단다.
    return result.kind === "error" ? (
        <p role="alert" className="text-sm text-destructive">
            {result.message}
        </p>
    ) : (
        <p role="status" className="text-sm text-muted-foreground">
            {result.message}
        </p>
    )
}
