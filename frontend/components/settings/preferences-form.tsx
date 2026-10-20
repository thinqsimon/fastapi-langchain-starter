"use client"

import { useState } from "react"

import type { Preferences } from "@/api"
import { FormStatus, useFormAction } from "@/components/settings/form-status"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { usePreferencesStore } from "@/store/preferences"

/** 캐치프레이즈와 일기 푸터. 불러온 값(initial)으로 입력칸을 채운다. */
export function PreferencesForm({ initial }: { initial: Preferences }) {
    const save = usePreferencesStore((state) => state.save)
    const reset = usePreferencesStore((state) => state.reset)
    const [catchphrase, setCatchphrase] = useState(initial.catchphrase)
    const [footer, setFooter] = useState(initial.diary_footer)
    const { result, isPending, run } = useFormAction()

    function handleReset() {
        void run(async () => {
            const defaults = await reset()
            setCatchphrase(defaults.catchphrase)
            setFooter(defaults.diary_footer)
            return "기본값으로 되돌렸습니다."
        }, "되돌리지 못했습니다.")
    }

    return (
        <form
            aria-label="화면 설정"
            className="flex flex-col gap-4"
            onSubmit={(event) => {
                event.preventDefault()
                void run(async () => {
                    await save({ catchphrase, diary_footer: footer })
                    return "설정을 저장했습니다."
                }, "설정을 저장하지 못했습니다.")
            }}
        >
            <div className="flex flex-col gap-2">
                <Label htmlFor="settings-catchphrase">캐치프레이즈</Label>
                <Input id="settings-catchphrase" value={catchphrase} onChange={(event) => setCatchphrase(event.target.value)} maxLength={300} />
                <p className="text-xs text-muted-foreground">상단 가운데에 보입니다. 공간보다 길면 전광판처럼 흐릅니다. 비우면 보이지 않습니다.</p>
            </div>

            <div className="flex flex-col gap-2">
                <Label htmlFor="settings-footer">일기 푸터</Label>
                <Textarea id="settings-footer" value={footer} onChange={(event) => setFooter(event.target.value)} rows={2} maxLength={300} />
                <p className="text-xs text-muted-foreground">
                    일기를 저장할 때 맨 끝에 붙습니다. 비우면 붙지 않습니다. 바꿔도 이미 저장한 일기는 그대로입니다.
                </p>
            </div>

            <div className="flex gap-2">
                <Button type="submit" disabled={isPending}>
                    {isPending ? "저장 중…" : "설정 저장"}
                </Button>
                <Button type="button" variant="outline" disabled={isPending} onClick={handleReset}>
                    기본값으로 되돌리기
                </Button>
            </div>
            <FormStatus result={result} />
        </form>
    )
}
