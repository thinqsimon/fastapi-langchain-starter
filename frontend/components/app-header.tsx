"use client"

import { PanelLeft } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect } from "react"

import { AccountMenu } from "@/components/account-menu"
import { CatchphraseMarquee } from "@/components/catchphrase-marquee"
import { Button } from "@/components/ui/button"
import { useMediaQuery } from "@/lib/use-media-query"
import { useAuthStore } from "@/store/auth"
import { DESKTOP_QUERY, useLayoutStore } from "@/store/layout"
import { usePreferencesStore } from "@/store/preferences"

export function AppHeader() {
    const userId = useAuthStore((state) => state.user?.id)
    const catchphrase = usePreferencesStore((state) => state.preferences?.catchphrase ?? "")
    const loadPreferences = usePreferencesStore((state) => state.load)
    const isChat = usePathname().startsWith("/chat")

    // 로그인한 사람이 바뀌면 그 사람의 캐치프레이즈를 다시 읽는다.
    useEffect(() => {
        if (userId) void loadPreferences()
    }, [userId, loadPreferences])

    return (
        // 좌우 칸을 같은 비율(1fr)로 두어 가운데 칸이 헤더의 정중앙에 오게 한다.
        // 가운데 칸은 문구 길이만큼만 차지하고, 자리가 모자라면 줄어들며 전광판으로 흐른다.
        <header className="grid grid-cols-[1fr_minmax(0,auto)_1fr] items-center gap-2 border-b px-3 py-2 sm:px-6 sm:py-3">
            <div className="flex items-center gap-3 justify-self-start whitespace-nowrap sm:gap-6">
                {isChat && <SidebarToggle />}
                {/* 좁은 화면에서는 서비스 이름을 줄여 가운데 문구에 자리를 준다. */}
                <span className="hidden font-semibold sm:inline">배움일기 코치</span>
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

/** 대화 목록을 감추고 여는 버튼(채팅 화면 좌측 상단). */
function SidebarToggle() {
    const toggleSidebar = useLayoutStore((state) => state.toggleSidebar)
    const desktopOpen = useLayoutStore((state) => state.desktopSidebarOpen)
    const mobileOpen = useLayoutStore((state) => state.mobileSidebarOpen)
    const isDesktop = useMediaQuery(DESKTOP_QUERY)

    return (
        <Button
            variant="ghost"
            size="icon-sm"
            aria-label="대화 목록 열고 닫기"
            // 화면 폭에 따라 옆 목록 또는 서랍의 열림 상태를 보조기기에 알린다.
            aria-expanded={isDesktop ? desktopOpen : mobileOpen}
            onClick={toggleSidebar}
        >
            <PanelLeft />
        </Button>
    )
}
