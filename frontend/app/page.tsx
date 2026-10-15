"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

import { useAuthStore } from "@/store/auth"

/** 로그인 상태에 따라 채팅 또는 로그인 화면으로 보낸다. */
export default function Home() {
    const router = useRouter()
    const isLoading = useAuthStore((state) => state.isLoading)
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

    useEffect(() => {
        if (isLoading) return
        router.replace(isAuthenticated ? "/chat" : "/sign-in")
    }, [isLoading, isAuthenticated, router])

    return <p className="p-8 text-sm text-muted-foreground">불러오는 중…</p>
}
