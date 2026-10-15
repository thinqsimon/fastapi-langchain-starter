"use client"

import { useAuthStore } from "@/store/auth"

export default function ChatPage() {
    const user = useAuthStore((state) => state.user)

    return (
        <div className="p-8">
            <h1 className="text-xl font-semibold">채팅</h1>
            <p className="mt-2 text-sm text-muted-foreground">{user?.display_name}님, 환영합니다. 대화 화면은 CHAT-02에서 구현합니다.</p>
        </div>
    )
}
