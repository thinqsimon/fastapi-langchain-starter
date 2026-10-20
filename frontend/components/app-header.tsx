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
        <header className="flex items-center gap-2 border-b px-4 py-3 sm:px-6">
            <div className="flex shrink-0 items-center gap-4 sm:gap-6">
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
            {/* 좌우 메뉴 사이의 빈 공간 가운데. 양옆에 여백을 둔다. */}
            <CatchphraseMarquee text={catchphrase} className="mx-3 sm:mx-10" />
            <AccountMenu />
        </header>
    )
}
