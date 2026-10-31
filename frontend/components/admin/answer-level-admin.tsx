"use client"

import { useEffect, useState } from "react"

import type { AnswerLevelInfo } from "@/lib/api"
import { FormStatus, useFormAction } from "@/components/settings/form-status"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { josaRo } from "@/lib/answer-level"
import { useAnswerLevelStore } from "@/store/answer-level"
import { useAuthStore } from "@/store/auth"

/** 관리자: 답변 수준 단계 이름 바꾸기(CHAT-03). 관리자가 아니면 아무것도 그리지 않는다. */
export function AnswerLevelAdmin() {
    const user = useAuthStore((state) => state.user)
    const levels = useAnswerLevelStore((state) => state.levels)
    const load = useAnswerLevelStore((state) => state.load)
    const isAdmin = user?.is_admin === true

    useEffect(() => {
        if (isAdmin) void load(true)
    }, [isAdmin, load])

    if (!isAdmin) return null

    return (
        <Card>
            <CardHeader>
                <CardTitle>답변 수준 이름</CardTitle>
                <CardDescription>사용자에게 보이는 단계 이름만 바뀝니다. 답변 방식은 단계 번호로 정해져 그대로입니다.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                {levels.map((item) => (
                    <LevelNameForm key={item.level} item={item} />
                ))}
            </CardContent>
        </Card>
    )
}

function LevelNameForm({ item }: { item: AnswerLevelInfo }) {
    const rename = useAnswerLevelStore((state) => state.rename)
    const resetName = useAnswerLevelStore((state) => state.resetName)
    const [name, setName] = useState(item.name)
    // 저장·되돌리기로 서버 이름이 바뀌면 입력칸도 맞춘다(폼을 다시 만들지 않아 결과 문구가 남는다).
    const [shownName, setShownName] = useState(item.name)
    if (item.name !== shownName) {
        setShownName(item.name)
        setName(item.name)
    }
    const { result, isPending, run } = useFormAction()
    const id = `answer-level-name-${item.level}`

    return (
        <form
            aria-label={`${item.level}단계 이름`}
            className="flex flex-col gap-1"
            onSubmit={(event) => {
                event.preventDefault()
                if (!name.trim()) return
                void run(async () => {
                    const updated = await rename(item.level, name.trim())
                    return `${item.level}단계 이름을 '${updated.name}'${josaRo(updated.name)} 바꿨습니다.`
                }, "이름을 바꾸지 못했습니다.")
            }}
        >
            <Label htmlFor={id}>{item.level}단계</Label>
            <div className="flex gap-2">
                <Input id={id} className="min-w-0 flex-1" value={name} onChange={(event) => setName(event.target.value)} maxLength={20} required />
                <Button type="submit" variant="outline" disabled={isPending || !name.trim() || name.trim() === item.name}>
                    저장
                </Button>
                {item.name !== item.default_name && (
                    <Button
                        type="button"
                        variant="ghost"
                        disabled={isPending}
                        onClick={() =>
                            void run(async () => {
                                await resetName(item.level)
                                return `기본 이름 '${item.default_name}'${josaRo(item.default_name)} 되돌렸습니다.`
                            }, "되돌리지 못했습니다.")
                        }
                    >
                        기본 이름으로
                    </Button>
                )}
            </div>
            <p className="text-xs text-muted-foreground">
                기본 이름 {item.default_name} · {item.audience}
            </p>
            <FormStatus result={result} />
        </form>
    )
}
