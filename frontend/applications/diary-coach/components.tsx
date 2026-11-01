"use client"

import { useEffect } from "react"

import { CatchphraseMarquee } from "@/components/catchphrase-marquee"
import { FormStatus, useFormAction } from "@/components/settings/form-status"
import { PreferencesForm } from "@/components/settings/preferences-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { useAuthStore } from "@/store/auth"
import { usePreferencesStore } from "@/store/preferences"
import { useDiaryStore } from "@/store/diary"
import { useLearningStore } from "@/store/learning"
import { useNotebookStore } from "@/store/notebook"

export function DiaryHeaderMessage() {
    const userId = useAuthStore((state) => state.user?.id)
    const catchphrase = usePreferencesStore((state) => state.preferences?.catchphrase ?? "")
    const load = usePreferencesStore((state) => state.load)
    const resetDiary = useDiaryStore((state) => state.reset)
    const resetLearning = useLearningStore((state) => state.reset)
    const resetNotebook = useNotebookStore((state) => state.reset)

    useEffect(() => {
        resetDiary()
        resetLearning()
        resetNotebook()
        if (userId) void load()
        return () => {
            resetDiary()
            resetLearning()
            resetNotebook()
        }
    }, [userId, load, resetDiary, resetLearning, resetNotebook])

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

/** 설정 화면 답변 수준 카드 바로 아래(CHAT-04). 켜면 답변마다 이어서 물어볼 질문 3개를 함께 받는다. */
export function SuggestQuestionsCard() {
    const preferences = usePreferencesStore((state) => state.preferences)
    const load = usePreferencesStore((state) => state.load)
    const setSuggestQuestions = usePreferencesStore((state) => state.setSuggestQuestions)
    const { result, isPending, run } = useFormAction()
    const enabled = preferences?.suggest_questions ?? false

    useEffect(() => {
        if (!preferences) void load()
    }, [preferences, load])

    return (
        <Card>
            <CardHeader>
                <CardTitle id="suggest-questions-title">추천 질문 함께 받기</CardTitle>
                <CardDescription id="suggest-questions-description">
                    답변 끝에 이어서 물어볼 만한 질문 3개를 함께 만들어요. 답변 아래 수준 버튼(…)을 누르면 보이고, 고르면 바로 질문해요. 질문을 만드는 만큼
                    답변이 1~2초 늦어질 수 있어요.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                    <Switch
                        checked={enabled}
                        disabled={!preferences || isPending}
                        aria-labelledby="suggest-questions-title"
                        aria-describedby="suggest-questions-description"
                        onCheckedChange={(checked) =>
                            void run(async () => {
                                await setSuggestQuestions(checked)
                                return checked ? "켰어요. 다음 답변부터 추천 질문이 함께 나와요." : "껐어요. 다음 답변부터 추천 질문 없이 답해요."
                            }, "설정을 바꾸지 못했습니다.")
                        }
                    />
                    <span className="text-sm">{enabled ? "켜짐" : "꺼짐"}</span>
                </div>
                <FormStatus result={result} />
            </CardContent>
        </Card>
    )
}
