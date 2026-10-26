"use client"

import { useEffect } from "react"

import { CatchphraseMarquee } from "@/components/catchphrase-marquee"
import { PreferencesForm } from "@/components/settings/preferences-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuthStore } from "@/store/auth"
import { usePreferencesStore } from "@/store/preferences"
import { useDiaryStore } from "@/store/diary"
import { useLearningStore } from "@/store/learning"

export function DiaryHeaderMessage() {
    const userId = useAuthStore((state) => state.user?.id)
    const catchphrase = usePreferencesStore((state) => state.preferences?.catchphrase ?? "")
    const load = usePreferencesStore((state) => state.load)
    const resetDiary = useDiaryStore((state) => state.reset)
    const resetLearning = useLearningStore((state) => state.reset)

    useEffect(() => {
        resetDiary()
        resetLearning()
        if (userId) void load()
        return () => {
            resetDiary()
            resetLearning()
        }
    }, [userId, load, resetDiary, resetLearning])

    return <CatchphraseMarquee text={catchphrase} className="mx-3 sm:mx-10" />
}

export function DiarySettingsSection() {
    const preferences = usePreferencesStore((state) => state.preferences)
    const load = usePreferencesStore((state) => state.load)

    useEffect(() => {
        if (!preferences) void load()
    }, [preferences, load])

    return (
        <Card>
            <CardHeader>
                <CardTitle>화면 설정</CardTitle>
                <CardDescription>상단 캐치프레이즈와 일기 끝에 붙는 문구입니다.</CardDescription>
            </CardHeader>
            <CardContent>{preferences ? <PreferencesForm initial={preferences} /> : <p className="text-sm text-muted-foreground">불러오는 중…</p>}</CardContent>
        </Card>
    )
}
