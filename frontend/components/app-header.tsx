"use client"

import Link from "next/link"
import { useEffect } from "react"

import { AccountMenu } from "@/components/account-menu"
import { CatchphraseMarquee } from "@/components/catchphrase-marquee"
import { useAuthStore } from "@/store/auth"
import { usePreferencesStore } from "@/store/preferences"

export function AppHeader() {
    const userId = useAuthStore((state) => state.user?.id)
    const catchphrase = usePreferencesStore((state) => state.preferences?.catchphrase ?? "")
    const loadPreferences = usePreferencesStore((state) => state.load)

    // 로그인한 사람이 바뀌면 그 사람의 캐치프레이즈를 다시 읽는다.
    useEffect(() => {
        if (userId) void loadPreferences()
    }, [userId, loadPreferences])

    return (
        // 좌우 칸을 같은 비율(1fr)로 두어 가운데 칸이 헤더의 정중앙에 오게 한다.
        // 가운데 칸은 문구 길이만큼만 차지하고, 자리가 모자라면 줄어들며 전광판으로 흐른다.
        <header className="grid grid-cols-[1fr_minmax(0,auto)_1fr] items-center gap-2 border-b px-4 py-3 sm:px-6">
            <div className="flex items-center gap-4 justify-self-start whitespace-nowrap sm:gap-6">
                <span className="font-semibold">배움일기 코치</span>
                <nav className="flex gap-3 text-sm sm:gap-4">
                    <Link href="/chat" className="hover:underline">
                        채팅
                    </Link>
                    <Link href="/diary" className="hover:underline">
                        일기
                    </Link>
                </nav>
            </div>
            {/* 양옆에 여백을 둔다. */}
            <CatchphraseMarquee text={catchphrase} className="mx-3 sm:mx-10" />
            <div className="flex justify-end">
                <AccountMenu />
            </div>
        </header>
    )
}
