"use client"

import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
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
            <span className="font-semibold">AX Chat Starter</span>
            <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">{user?.display_name}</span>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                    로그아웃
                </Button>
            </div>
        </header>
    )
}
