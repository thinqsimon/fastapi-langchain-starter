"use client"

import { CircleUserRound, LogOut, Settings, ShieldCheck } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { UsageBadge } from "@/components/usage-badge"
import { planPeriodLabel } from "@/lib/llm-labels"
import { useAuthStore } from "@/store/auth"
import { usePreferencesStore } from "@/store/preferences"

/** 우측 상단 계정 버튼. 누르면 오른쪽에서 계정 정보·설정·로그아웃 메뉴가 열린다. */
export function AccountMenu() {
    const router = useRouter()
    const user = useAuthStore((state) => state.user)
    const logout = useAuthStore((state) => state.logout)
    const clearPreferences = usePreferencesStore((state) => state.clear)
    const [open, setOpen] = useState(false)

    function goToSettings() {
        setOpen(false)
        router.push("/settings")
    }

    function goToServerSettings() {
        setOpen(false)
        router.push("/admin")
    }

    async function handleLogout() {
        setOpen(false)
        await logout()
        clearPreferences()
        router.replace("/sign-in")
    }

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
                render={<Button variant="ghost" size="sm" aria-label={`계정 메뉴 열기: ${user?.display_name ?? ""}`} className="max-w-40 shrink-0" />}
            >
                <CircleUserRound />
                {/* 좁은 화면에서는 아이콘만 보여 가운데 문구에 자리를 준다(이름은 메뉴 안에 있다). */}
                <span className="hidden truncate sm:inline">{user?.display_name}</span>
            </SheetTrigger>

            <SheetContent side="right" className="w-80 max-w-[85vw]">
                <SheetHeader>
                    <SheetTitle>계정</SheetTitle>
                    <SheetDescription>내 정보와 화면 설정</SheetDescription>
                </SheetHeader>

                <section aria-label="계정 정보" className="flex flex-col gap-2 px-4">
                    <h3 className="text-xs font-medium text-muted-foreground">계정 정보</h3>
                    <dl className="grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-2 text-sm">
                        <dt className="text-muted-foreground">이름</dt>
                        <dd className="truncate">{user?.display_name}</dd>
                        <dt className="text-muted-foreground">이메일</dt>
                        <dd className="truncate">{user?.email}</dd>
                        <dt className="text-muted-foreground">요금제</dt>
                        <dd data-slot="account-plan">{user ? planPeriodLabel(user.plan, user.plan_expires_at) : ""}</dd>
                        <dt className="text-muted-foreground">가입일</dt>
                        <dd>{user ? new Date(user.created_at).toLocaleDateString("ko-KR") : ""}</dd>
                        <dt className="text-muted-foreground">사용량</dt>
                        <dd>
                            <UsageBadge emptyText="아직 없음" />
                        </dd>
                    </dl>
                </section>

                <SheetFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
                    {/* 관리자(.env ADMIN_EMAILS)에게만 보인다. 사용자 계정 테스트와 LLM 공급자 설정. */}
                    {user?.is_admin && (
                        <Button variant="outline" onClick={goToServerSettings}>
                            <ShieldCheck />
                            관리자
                        </Button>
                    )}
                    <Button variant="outline" onClick={goToSettings}>
                        <Settings />
                        설정
                    </Button>
                    <Button variant="ghost" onClick={() => void handleLogout()}>
                        <LogOut />
                        로그아웃
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
}
