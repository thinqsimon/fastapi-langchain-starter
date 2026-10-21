"use client"

import { useEffect } from "react"

import { EmailForm, PasswordForm, ProfileForm } from "@/components/settings/account-forms"
import { PreferencesForm } from "@/components/settings/preferences-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { usePreferencesStore } from "@/store/preferences"

export default function SettingsPage() {
    const preferences = usePreferencesStore((state) => state.preferences)
    const loadPreferences = usePreferencesStore((state) => state.load)

    // 헤더가 이미 불러왔으면 다시 부르지 않는다.
    useEffect(() => {
        if (!preferences) void loadPreferences()
    }, [preferences, loadPreferences])

    return (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6 sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <h1 className="text-xl font-semibold">설정</h1>

            <Card>
                <CardHeader>
                    <CardTitle>계정 정보</CardTitle>
                    <CardDescription>이름, 이메일, 비밀번호를 바꿉니다.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-6">
                    <ProfileForm />
                    <EmailForm />
                    <PasswordForm />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>화면 설정</CardTitle>
                    <CardDescription>상단 캐치프레이즈와 일기 끝에 붙는 문구입니다.</CardDescription>
                </CardHeader>
                <CardContent>
                    {preferences ? <PreferencesForm initial={preferences} /> : <p className="text-sm text-muted-foreground">불러오는 중…</p>}
                </CardContent>
            </Card>
        </div>
    )
}
