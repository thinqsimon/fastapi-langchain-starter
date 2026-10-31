"use client"

import { useEffect, useState } from "react"

import { FormStatus, useFormAction } from "@/components/settings/form-status"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DEFAULT_ANSWER_LEVEL, answerLevelLabel, josaRo } from "@/lib/answer-level"
import { cn } from "@/lib/utils"
import { useAnswerLevelStore } from "@/store/answer-level"
import { useAuthStore } from "@/store/auth"

/** 설정 화면의 "답변 수준" 카드(CHAT-03). 계정 정보 바로 아래에 놓인다. */
export function AnswerLevelCard() {
    const user = useAuthStore((state) => state.user)
    const updateAnswerLevel = useAuthStore((state) => state.updateAnswerLevel)
    const levels = useAnswerLevelStore((state) => state.levels)
    const load = useAnswerLevelStore((state) => state.load)
    const loadError = useAnswerLevelStore((state) => state.error)
    const saved = user?.answer_level ?? null
    const [selected, setSelected] = useState<number>(saved ?? DEFAULT_ANSWER_LEVEL)
    const { result, isPending, run } = useFormAction()

    useEffect(() => {
        void load()
    }, [load])

    const current = levels.find((item) => item.level === selected)

    return (
        <Card>
            <CardHeader>
                <CardTitle>답변 수준</CardTitle>
                <CardDescription>
                    채팅 답변과 일기 초안·주간 회고의 어휘와 설명 깊이를 정합니다. 대화 중에 &quot;더 쉽게 설명해 줘&quot;처럼 직접 요청하면 그 요청이
                    먼저입니다.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form
                    aria-label="답변 수준"
                    className="flex flex-col gap-4"
                    onSubmit={(event) => {
                        event.preventDefault()
                        void run(async () => {
                            await updateAnswerLevel(selected)
                            const label = answerLevelLabel(selected, levels)
                            return `답변 수준을 '${label}'${josaRo(label)} 저장했습니다. 다음 답변부터 적용됩니다.`
                        }, "답변 수준을 저장하지 못했습니다.")
                    }}
                >
                    {saved === null && (
                        <p data-slot="answer-level-unset" className="rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-900">
                            아직 고르지 않았어요. 지금은 {answerLevelLabel(DEFAULT_ANSWER_LEVEL, levels)}
                            {josaRo(answerLevelLabel(DEFAULT_ANSWER_LEVEL, levels))} 답합니다.
                        </p>
                    )}
                    {loadError && (
                        <p role="alert" className="text-sm text-destructive">
                            {loadError}
                        </p>
                    )}
                    {/* sr-only legend는 위치 기준이 없으면 문서 바깥으로 넘쳐 페이지 전체가 스크롤된다. 이름은 aria-label로 준다. */}
                    <fieldset aria-label="답변 수준 단계" className="flex flex-col gap-2">
                        {levels.map((item) => (
                            <label
                                key={item.level}
                                className={cn(
                                    "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50",
                                    selected === item.level && "border-sky-500 bg-sky-50/60"
                                )}
                            >
                                <input
                                    type="radio"
                                    name="answer-level"
                                    value={item.level}
                                    checked={selected === item.level}
                                    onChange={() => setSelected(item.level)}
                                    // 글자 크기는 라디오 모양과 무관하다. 폰에서 입력 요소는 16px 이상이라는 규칙(확대 방지)에 맞춘다.
                                    className="mt-1 size-4 shrink-0 text-base accent-sky-600"
                                />
                                <span className="flex min-w-0 flex-col gap-0.5">
                                    <span className="text-sm font-medium">
                                        {item.level}단계 {item.name}
                                        {saved === item.level && <span className="ml-2 text-xs font-normal text-sky-700">사용 중</span>}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {item.audience} · {item.style}
                                    </span>
                                </span>
                            </label>
                        ))}
                    </fieldset>
                    {current && (
                        <div data-slot="answer-level-example" className="rounded-md bg-muted px-3 py-2 text-sm leading-6">
                            <p className="text-xs text-muted-foreground">
                                예: &apos;API&apos;를 {answerLevelLabel(current.level, levels)}
                                {josaRo(answerLevelLabel(current.level, levels))} 설명하면
                            </p>
                            <p>{current.example}</p>
                        </div>
                    )}
                    <div>
                        <Button type="submit" disabled={isPending || selected === saved}>
                            {isPending ? "저장 중…" : "수준 저장"}
                        </Button>
                    </div>
                    <FormStatus result={result} />
                </form>
            </CardContent>
        </Card>
    )
}
