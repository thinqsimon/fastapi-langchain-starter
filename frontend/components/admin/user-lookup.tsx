"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { adminApi, errorMessage, type AdminUser, type PlanName } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PLANS, planLabel } from "@/lib/llm-labels"
import { useAuthStore } from "@/store/auth"

/** 사용자를 찾아 요금제를 바꾸거나(ADMIN-03) 그 계정으로 테스트를 시작하는 카드(ADMIN-02). 관리자가 아니면 아무것도 그리지 않는다. */
export function UserLookup() {
    const router = useRouter()
    const user = useAuthStore((state) => state.user)
    const acting = useAuthStore((state) => state.acting)
    const startActing = useAuthStore((state) => state.startActing)
    const [query, setQuery] = useState("")
    const [results, setResults] = useState<AdminUser[] | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isBusy, setIsBusy] = useState(false)
    const selfId = acting?.admin.id ?? user?.id

    if (!user?.is_admin) return null

    async function search() {
        setIsBusy(true)
        setError(null)
        try {
            setResults(await adminApi.searchUsers(query.trim()))
        } catch (caught) {
            setError(errorMessage(caught, "사용자를 찾지 못했습니다."))
        } finally {
            setIsBusy(false)
        }
    }

    async function changePlan(target: AdminUser, plan: PlanName) {
        setIsBusy(true)
        setError(null)
        try {
            const updated = await adminApi.setUserPlan(target.id, plan)
            setResults((current) => current?.map((found) => (found.id === updated.id ? updated : found)) ?? null)
        } catch (caught) {
            setError(errorMessage(caught, "요금제를 바꾸지 못했습니다."))
        } finally {
            setIsBusy(false)
        }
    }

    async function actAs(target: AdminUser) {
        setIsBusy(true)
        setError(null)
        try {
            await startActing(target.id)
            router.push("/chat")
        } catch (caught) {
            setError(errorMessage(caught, "테스트를 시작하지 못했습니다."))
            setIsBusy(false)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>사용자</CardTitle>
                <CardDescription>
                    요금제를 바꾸면 다음 요청부터 그 요금제의 LLM 라우팅을 탑니다. &quot;이 계정으로 테스트&quot;는 신고된 오류를 그 계정 그대로
                    재현합니다(메시지·일기 생성 가능, 삭제·계정 변경은 차단, 시작과 쓰기 요청은 서버 로그에 기록).
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <form
                    aria-label="사용자 검색"
                    className="flex flex-col gap-2"
                    onSubmit={(event) => {
                        event.preventDefault()
                        if (query.trim()) void search()
                    }}
                >
                    <Label htmlFor="admin-user-query">이메일 또는 이름</Label>
                    <div className="flex gap-2">
                        <Input
                            id="admin-user-query"
                            className="min-w-0 flex-1"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="일부만 적어도 됩니다"
                            maxLength={100}
                        />
                        <Button type="submit" disabled={isBusy || !query.trim()}>
                            검색
                        </Button>
                    </div>
                </form>

                {error && (
                    <p role="alert" className="text-sm text-destructive">
                        {error}
                    </p>
                )}

                {results && results.length === 0 && <p className="text-sm text-muted-foreground">찾은 사용자가 없습니다.</p>}

                {results && results.length > 0 && (
                    <ul className="flex flex-col divide-y rounded-md border" aria-label="검색 결과">
                        {results.map((found) => {
                            const isSelf = found.id === selfId
                            return (
                                <li key={found.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-medium">{found.email}</p>
                                        <p className="truncate text-xs text-muted-foreground">
                                            {found.display_name} · 가입 {new Date(found.created_at).toLocaleDateString("ko-KR")}
                                            {found.plan_expires_at &&
                                                ` · ${planLabel(found.plan)} ${new Date(found.plan_expires_at).toLocaleDateString("ko-KR")}까지`}
                                            {!found.is_active && " · 비활성"}
                                        </p>
                                    </div>
                                    <select
                                        aria-label={`${found.email} 요금제`}
                                        value={found.plan}
                                        disabled={isBusy}
                                        onChange={(event) => void changePlan(found, event.target.value as PlanName)}
                                        className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
                                    >
                                        {PLANS.map((plan) => (
                                            <option key={plan} value={plan}>
                                                {planLabel(plan)}
                                            </option>
                                        ))}
                                    </select>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        aria-label={`${found.email} 계정으로 테스트`}
                                        disabled={isBusy || isSelf || !found.is_active}
                                        onClick={() => void actAs(found)}
                                    >
                                        {isSelf ? "내 계정" : "이 계정으로 테스트"}
                                    </Button>
                                </li>
                            )
                        })}
                    </ul>
                )}
            </CardContent>
        </Card>
    )
}
