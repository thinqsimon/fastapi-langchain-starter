"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

import { useAuthStore } from "@/store/auth"

/** 로그인하지 않은 사용자를 로그인 화면으로 보낸다. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
    const router = useRouter()
    const isLoading = useAuthStore((state) => state.isLoading)
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.replace("/sign-in")
        }
    }, [isLoading, isAuthenticated, router])

    if (isLoading) {
        return <p className="p-8 text-sm text-muted-foreground">불러오는 중…</p>
    }

    if (!isAuthenticated) {
        return null
    }

    return <>{children}</>
}
