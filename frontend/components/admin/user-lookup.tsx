"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { adminApi, errorMessage, type AdminUser, type PlanName } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DeleteUserDialog, PasswordResetDialog } from "@/components/admin/user-account-dialogs"
import { copyToClipboard } from "@/lib/coupon-text"
import { passwordResetShareText } from "@/lib/password-reset-text"
import { PLANS, planLabel } from "@/lib/llm-labels"
import { useAuthStore } from "@/store/auth"

/**
 * 사용자를 찾아 요금제를 바꾸고(ADMIN-03), 그 계정으로 테스트하고(ADMIN-02),
 * 비밀번호를 초기화하거나 삭제하는(ADMIN-05) 카드. 관리자가 아니면 아무것도 그리지 않는다.
 */
export function UserLookup() {
    const router = useRouter()
    const user = useAuthStore((state) => state.user)
    const acting = useAuthStore((state) => state.acting)
    const startActing = useAuthStore((state) => state.startActing)
    const [query, setQuery] = useState("")
    const [results, setResults] = useState<AdminUser[] | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isBusy, setIsBusy] = useState(false)
    const [resetTarget, setResetTarget] = useState<AdminUser | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)
    const [defaultPassword, setDefaultPassword] = useState<string | null>(null)
    const [defaultError, setDefaultError] = useState<string | null>(null)
    // 초기화·삭제가 끝난 뒤의 안내. 초기화면 사용자에게 알려 줄 새 비밀번호를 함께 보여 준다.
    const [notice, setNotice] = useState<{ text: string; password?: string } | null>(null)
    const [copied, setCopied] = useState(false)
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

    /** 대화상자를 열면서 서버의 기본 암호를 받아 온다. 못 받으면 직접 입력으로만 초기화한다. */
    async function openReset(target: AdminUser) {
        setNotice(null)
        setDefaultError(null)
        setResetTarget(target)
        try {
            setDefaultPassword(await adminApi.fetchPasswordResetDefault())
        } catch (caught) {
            setDefaultPassword(null)
            setDefaultError(errorMessage(caught, "기본 암호를 불러오지 못했습니다. 직접 입력해 주세요."))
        }
    }

    async function resetPassword(target: AdminUser, password: string | undefined) {
        const result = await adminApi.resetUserPassword(target.id, password)
        setResults((current) => current?.map((found) => (found.id === result.user.id ? result.user : found)) ?? null)
        setResetTarget(null)
        setCopied(false)
        setNotice({
            text: `${target.email}의 비밀번호를 초기화했습니다. 이 계정으로 로그인해 있던 다른 기기는 로그아웃됐습니다.`,
            password: password ?? defaultPassword ?? undefined,
        })
    }

    async function removeUser(target: AdminUser) {
        await adminApi.deleteUser(target.id)
        setResults((current) => current?.filter((found) => found.id !== target.id) ?? null)
        setDeleteTarget(null)
        setNotice({ text: `${target.email} 계정을 삭제했습니다.` })
    }

    async function copyResetNotice(password: string) {
        try {
            await copyToClipboard(passwordResetShareText(password, window.location.origin))
            setCopied(true)
        } catch {
            setError("복사하지 못했습니다. 새 비밀번호를 직접 알려 주세요.")
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>사용자</CardTitle>
                <CardDescription>
                    요금제를 바꾸면 다음 요청부터 그 요금제의 LLM 라우팅을 탑니다. &quot;이 계정으로 테스트&quot;는 신고된 오류를 그 계정 그대로
                    재현합니다(메시지·일기 생성 가능, 삭제·계정 변경은 차단, 시작과 쓰기 요청은 서버 로그에 기록). 비밀번호 초기화는 기본 암호나 입력한 암호로
                    바꾸고, 삭제는 그 계정의 기록까지 지웁니다. 관리자 계정은 초기화·삭제 대상이 아닙니다.
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

                {notice && (
                    <div
                        role="status"
                        data-slot="admin-user-notice"
                        className="flex flex-col gap-2 rounded-md border border-sky-200 bg-sky-50/60 px-3 py-2 text-sm"
                    >
                        <p>{notice.text}</p>
                        {notice.password && (
                            <ResetPasswordLine password={notice.password} copied={copied} onCopy={(password) => void copyResetNotice(password)} />
                        )}
                    </div>
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
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        aria-label={`${found.email} 비밀번호 초기화`}
                                        title={found.is_admin ? ADMIN_ACCOUNT_LOCKED : undefined}
                                        disabled={isBusy || found.is_admin}
                                        onClick={() => void openReset(found)}
                                    >
                                        비밀번호 초기화
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        aria-label={`${found.email} 삭제`}
                                        title={found.is_admin ? ADMIN_ACCOUNT_LOCKED : undefined}
                                        disabled={isBusy || found.is_admin}
                                        onClick={() => {
                                            setNotice(null)
                                            setDeleteTarget(found)
                                        }}
                                    >
                                        삭제
                                    </Button>
                                </li>
                            )
                        })}
                    </ul>
                )}
            </CardContent>
            <PasswordResetDialog
                key={`reset-${resetTarget?.id ?? "none"}`}
                target={resetTarget}
                defaultPassword={defaultPassword}
                defaultError={defaultError}
                onClose={() => setResetTarget(null)}
                onReset={resetPassword}
            />
            <DeleteUserDialog key={`delete-${deleteTarget?.id ?? "none"}`} target={deleteTarget} onClose={() => setDeleteTarget(null)} onDelete={removeUser} />
        </Card>
    )
}

const ADMIN_ACCOUNT_LOCKED = "관리자 계정은 여기서 초기화·삭제할 수 없습니다"

/** 초기화한 새 비밀번호와, 사용자에게 보낼 안내문 복사 버튼. */
function ResetPasswordLine({ password, copied, onCopy }: { password: string; copied: boolean; onCopy: (password: string) => void }) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <span>새 비밀번호</span>
            <code data-slot="reset-new-password" className="rounded bg-background px-1.5 py-0.5 font-mono">
                {password}
            </code>
            <Button size="sm" variant="outline" onClick={() => onCopy(password)}>
                {copied ? "복사했습니다" : "안내문 복사"}
            </Button>
        </div>
    )
}
