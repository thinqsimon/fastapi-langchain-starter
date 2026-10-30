"use client"

import { ShieldAlert } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { ACTING_ENDED_EVENT } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/store/auth"

/**
 * 관리자가 다른 계정으로 테스트 중일 때 헤더 아래에 보이는 띠(ADMIN-02).
 * 어느 화면에 있든 "지금 누구 계정인지"와 돌아가는 버튼이 보여야 한다.
 */
export function ActingBanner() {
    const router = useRouter()
    const acting = useAuthStore((state) => state.acting)
    const stopActing = useAuthStore((state) => state.stopActing)
    const [notice, setNotice] = useState<string | null>(null)
    const [isLeaving, setIsLeaving] = useState(false)

    // 테스트 토큰이 만료돼 요청이 401로 끝나면 api 계층이 이 이벤트를 보낸다.
    useEffect(() => {
        function onEnded() {
            void stopActing().then(() => {
                setNotice("테스트 세션이 끝나 내 계정으로 돌아왔습니다.")
                router.push("/admin")
            })
        }
        window.addEventListener(ACTING_ENDED_EVENT, onEnded)
        return () => window.removeEventListener(ACTING_ENDED_EVENT, onEnded)
    }, [router, stopActing])

    if (!acting) {
        if (!notice) return null
        return (
            <p role="status" data-slot="acting-notice" className="shrink-0 bg-muted px-4 py-2 text-center text-sm text-muted-foreground">
                {notice}
            </p>
        )
    }

    async function leave() {
        setIsLeaving(true)
        try {
            await stopActing()
            setNotice(null)
            router.push("/admin")
        } finally {
            setIsLeaving(false)
        }
    }

    return (
        <div
            role="status"
            data-slot="acting-banner"
            className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-amber-300 bg-amber-100 px-4 py-2 text-sm text-amber-950"
        >
            <ShieldAlert className="size-4 shrink-0" aria-hidden />
            <p className="min-w-0 flex-1">
                <b>{acting.target.display_name}</b>({acting.target.email}) 계정으로 테스트 중입니다. 여기서 만든 대화·일기는 그 계정에 남고, 삭제와 계정 변경은
                막혀 있습니다.
            </p>
            <Button size="sm" variant="outline" disabled={isLeaving} onClick={() => void leave()}>
                {isLeaving ? "돌아가는 중…" : "내 계정으로 돌아가기"}
            </Button>
        </div>
    )
}
