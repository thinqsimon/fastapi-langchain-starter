"use client"

import { useEffect } from "react"

import { useAuthStore } from "@/store/auth"

/** 앱이 뜰 때 저장된 토큰으로 로그인 상태를 한 번 복원한다. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
    const restore = useAuthStore((state) => state.restore)

    useEffect(() => {
        void restore()
    }, [restore])

    return <>{children}</>
}
