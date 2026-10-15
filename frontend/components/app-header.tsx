"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { UsageBadge } from "@/components/usage-badge"
import { useAuthStore } from "@/store/auth"

export function AppHeader() {
    const router = useRouter()
    const user = useAuthStore((state) => state.user)
    const logout = useAuthStore((state) => state.logout)

    async function handleLogout() {
        await logout()
        router.replace("/sign-in")
    }

    return (
        <header className="flex items-center justify-between border-b px-6 py-3">
            <div className="flex items-center gap-6">
                <span className="font-semibold">배움일기 코치</span>
                <nav className="flex gap-4 text-sm">
                    <Link href="/chat" className="hover:underline">
                        채팅
                    </Link>
                    <Link href="/diary" className="hover:underline">
                        일기
                    </Link>
                </nav>
            </div>
            <div className="flex items-center gap-3">
                <UsageBadge />
                <span className="text-sm text-muted-foreground">{user?.display_name}</span>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                    로그아웃
                </Button>
            </div>
        </header>
    )
}
