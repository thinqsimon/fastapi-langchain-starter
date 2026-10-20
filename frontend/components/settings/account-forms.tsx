"use client"

import { useState, type FormEvent } from "react"

import { FormStatus, useFormAction } from "@/components/settings/form-status"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuthStore } from "@/store/auth"

function submit(handler: () => void) {
    return (event: FormEvent) => {
        event.preventDefault()
        handler()
    }
}

export function ProfileForm() {
    const user = useAuthStore((state) => state.user)
    const updateProfile = useAuthStore((state) => state.updateProfile)
    const [displayName, setDisplayName] = useState(user?.display_name ?? "")
    const { result, isPending, run } = useFormAction()

    return (
        <form
            aria-label="이름 변경"
            className="flex flex-col gap-2"
            onSubmit={submit(
                () =>
                    void run(async () => {
                        await updateProfile(displayName)
                        return "이름을 바꿨습니다."
                    }, "이름을 바꾸지 못했습니다.")
            )}
        >
            <Label htmlFor="settings-display-name">이름</Label>
            <div className="flex gap-2">
                <Input id="settings-display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required maxLength={50} />
                <Button type="submit" disabled={isPending}>
                    {isPending ? "저장 중…" : "이름 저장"}
                </Button>
            </div>
            <FormStatus result={result} />
        </form>
    )
}

export function EmailForm() {
    const user = useAuthStore((state) => state.user)
    const changeEmail = useAuthStore((state) => state.changeEmail)
    const [email, setEmail] = useState(user?.email ?? "")
    const [password, setPassword] = useState("")
    const { result, isPending, run } = useFormAction()

    return (
        <form
            aria-label="이메일 변경"
            className="flex flex-col gap-2"
            onSubmit={submit(
                () =>
                    void run(async () => {
                        await changeEmail(email, password)
                        setPassword("")
                        return "이메일을 바꿨습니다. 다음 로그인부터 새 이메일을 쓰세요."
                    }, "이메일을 바꾸지 못했습니다.")
            )}
        >
            <Label htmlFor="settings-email">이메일</Label>
            <Input id="settings-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            <Label htmlFor="settings-email-password">현재 비밀번호</Label>
            <Input
                id="settings-email-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
            />
            <p className="text-xs text-muted-foreground">로그인 아이디가 바뀌므로 현재 비밀번호를 한 번 더 확인합니다.</p>
            <div>
                <Button type="submit" disabled={isPending}>
                    {isPending ? "저장 중…" : "이메일 변경"}
                </Button>
            </div>
            <FormStatus result={result} />
        </form>
    )
}

export function PasswordForm() {
    const changePassword = useAuthStore((state) => state.changePassword)
    const [current, setCurrent] = useState("")
    const [next, setNext] = useState("")
    const [confirm, setConfirm] = useState("")
    const { result, isPending, run, fail } = useFormAction()

    function handleSubmit() {
        if (next !== confirm) {
            fail("새 비밀번호가 서로 다릅니다.")
            return
        }
        void run(async () => {
            await changePassword(current, next)
            setCurrent("")
            setNext("")
            setConfirm("")
            return "비밀번호를 바꿨습니다. 다른 기기에서는 다시 로그인해야 합니다."
        }, "비밀번호를 바꾸지 못했습니다.")
    }

    return (
        <form aria-label="비밀번호 변경" className="flex flex-col gap-2" onSubmit={submit(handleSubmit)}>
            <Label htmlFor="settings-current-password">현재 비밀번호</Label>
            <Input
                id="settings-current-password"
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(event) => setCurrent(event.target.value)}
                required
            />
            <Label htmlFor="settings-new-password">새 비밀번호</Label>
            <Input
                id="settings-new-password"
                type="password"
                autoComplete="new-password"
                value={next}
                onChange={(event) => setNext(event.target.value)}
                required
                minLength={8}
                maxLength={72}
            />
            <Label htmlFor="settings-confirm-password">새 비밀번호 확인</Label>
            <Input
                id="settings-confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                required
            />
            <p className="text-xs text-muted-foreground">8자 이상. 바꾸면 다른 기기의 로그인은 모두 끊기고, 지금 화면은 그대로 유지됩니다.</p>
            <div>
                <Button type="submit" disabled={isPending}>
                    {isPending ? "저장 중…" : "비밀번호 변경"}
                </Button>
            </div>
            <FormStatus result={result} />
        </form>
    )
}
