"use client"

import { useState } from "react"

import { errorMessage, type AdminUser } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/password-reset-text"

type ResetMode = "default" | "custom"

/**
 * 비밀번호 초기화(ADMIN-05). 서버의 기본 암호나 관리자가 입력한 암호로 바꾼다.
 * 부모가 대상이 바뀔 때마다 key로 새로 만들어 입력값이 남지 않게 한다.
 */
export function PasswordResetDialog({
    target,
    defaultPassword,
    defaultError,
    onClose,
    onReset,
}: {
    target: AdminUser | null
    /** 서버가 알려 준 기본 암호. 불러오는 중이면 null */
    defaultPassword: string | null
    defaultError: string | null
    onClose: () => void
    /** 실패하면 예외를 던진다. 성공하면 부모가 대화상자를 닫는다. */
    onReset: (target: AdminUser, password: string | undefined) => Promise<void>
}) {
    const [mode, setMode] = useState<ResetMode>("default")
    const [custom, setCustom] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    const customValid = custom.length >= PASSWORD_MIN_LENGTH && custom.length <= PASSWORD_MAX_LENGTH
    const canSubmit = !busy && (mode === "default" ? defaultPassword !== null : customValid)

    async function submit() {
        if (!target || !canSubmit) return
        setBusy(true)
        setError(null)
        try {
            await onReset(target, mode === "custom" ? custom : undefined)
        } catch (caught) {
            setError(errorMessage(caught, "비밀번호를 초기화하지 못했습니다."))
            setBusy(false)
        }
    }

    return (
        <Dialog
            open={target !== null}
            onOpenChange={(open) => {
                if (!open && !busy) onClose()
            }}
        >
            <DialogContent>
                <form
                    aria-label="비밀번호 초기화"
                    className="flex flex-col gap-4"
                    onSubmit={(event) => {
                        event.preventDefault()
                        void submit()
                    }}
                >
                    <DialogHeader>
                        <DialogTitle>비밀번호 초기화</DialogTitle>
                        <DialogDescription>{target?.email}의 비밀번호를 바꿉니다. 이 계정으로 로그인해 있던 다른 기기는 모두 로그아웃됩니다.</DialogDescription>
                    </DialogHeader>

                    <fieldset aria-label="초기화 방식" className="flex flex-col gap-2">
                        <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
                            <input
                                type="radio"
                                name="reset-mode"
                                value="default"
                                checked={mode === "default"}
                                onChange={() => setMode("default")}
                                className="mt-1 size-4 shrink-0 text-base accent-sky-600"
                            />
                            <span className="flex min-w-0 flex-col gap-0.5">
                                <span className="text-sm font-medium">기본 암호</span>
                                <span className="text-xs text-muted-foreground" data-slot="reset-default-password">
                                    {defaultError ??
                                        (defaultPassword === null ? (
                                            "불러오는 중…"
                                        ) : (
                                            <>
                                                서버 설정값 <code className="font-mono text-foreground">{defaultPassword}</code>
                                            </>
                                        ))}
                                </span>
                            </span>
                        </label>
                        <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
                            <input
                                type="radio"
                                name="reset-mode"
                                value="custom"
                                checked={mode === "custom"}
                                onChange={() => setMode("custom")}
                                className="mt-1 size-4 shrink-0 text-base accent-sky-600"
                            />
                            <span className="flex min-w-0 flex-col gap-0.5">
                                <span className="text-sm font-medium">직접 입력</span>
                                <span className="text-xs text-muted-foreground">이 사용자에게만 쓸 비밀번호를 정합니다.</span>
                            </span>
                        </label>
                        {mode === "custom" && (
                            <div className="flex flex-col gap-1">
                                <Label htmlFor="reset-custom-password">새 비밀번호</Label>
                                <Input
                                    id="reset-custom-password"
                                    value={custom}
                                    onChange={(event) => setCustom(event.target.value)}
                                    autoComplete="off"
                                    spellCheck={false}
                                    maxLength={PASSWORD_MAX_LENGTH}
                                />
                                <p className="text-xs text-muted-foreground">
                                    {PASSWORD_MIN_LENGTH}~{PASSWORD_MAX_LENGTH}자. 사용자에게 그대로 알려 줄 값이라 화면에 보이게 둡니다.
                                </p>
                            </div>
                        )}
                    </fieldset>

                    {error && (
                        <p role="alert" className="text-sm text-destructive">
                            {error}
                        </p>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
                            취소
                        </Button>
                        <Button type="submit" disabled={!canSubmit}>
                            {busy ? "초기화 중…" : "초기화"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

/** 사용자 삭제(ADMIN-05). 그 계정의 기록까지 지워 되돌릴 수 없으므로 무엇이 사라지는지 먼저 보여 준다. */
export function DeleteUserDialog({
    target,
    onClose,
    onDelete,
}: {
    target: AdminUser | null
    onClose: () => void
    /** 실패하면 예외를 던진다. 성공하면 부모가 대화상자를 닫는다. */
    onDelete: (target: AdminUser) => Promise<void>
}) {
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    async function confirm() {
        if (!target) return
        setBusy(true)
        setError(null)
        try {
            await onDelete(target)
        } catch (caught) {
            setError(errorMessage(caught, "사용자를 삭제하지 못했습니다."))
            setBusy(false)
        }
    }

    return (
        <Dialog
            open={target !== null}
            onOpenChange={(open) => {
                if (!open && !busy) onClose()
            }}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>사용자 삭제</DialogTitle>
                    <DialogDescription>{target?.email} 계정을 삭제합니다. 되돌릴 수 없습니다.</DialogDescription>
                </DialogHeader>
                <ul data-slot="delete-user-effects" className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    <li>대화, 일기, 주간 회고, 학습장 등 이 계정의 기록이 모두 지워집니다.</li>
                    <li>이 계정이 쓴 쿠폰은 발급 기록만 남고 사용자 칸이 비워집니다.</li>
                    <li>같은 이메일로 다시 가입할 수 있습니다.</li>
                </ul>
                {error && (
                    <p role="alert" className="text-sm text-destructive">
                        {error}
                    </p>
                )}
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={busy}>
                        취소
                    </Button>
                    <Button variant="destructive" onClick={() => void confirm()} disabled={busy}>
                        {busy ? "삭제 중…" : "삭제"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
