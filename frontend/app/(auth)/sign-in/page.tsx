"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { errorMessage } from "@/api"
import { AuthFormCard } from "@/components/auth/auth-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuthStore } from "@/store/auth"

export default function SignInPage() {
    const router = useRouter()
    const login = useAuthStore((state) => state.login)
    const [error, setError] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setError(null)
        setIsSubmitting(true)

        const form = new FormData(event.currentTarget)
        try {
            await login(String(form.get("email")), String(form.get("password")))
            router.replace("/chat")
        } catch (caught) {
            setError(errorMessage(caught, "로그인하지 못했습니다."))
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <AuthFormCard
            title="로그인"
            description="AX Chat Starter 계정으로 로그인하세요."
            error={error}
            isSubmitting={isSubmitting}
            submitLabel="로그인"
            footer={{ text: "계정이 없으신가요?", linkLabel: "회원가입", href: "/sign-up" }}
            onSubmit={handleSubmit}
        >
            <div className="flex flex-col gap-2">
                <Label htmlFor="email">이메일</Label>
                <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="flex flex-col gap-2">
                <Label htmlFor="password">비밀번호</Label>
                <Input id="password" name="password" type="password" autoComplete="current-password" required />
            </div>
        </AuthFormCard>
    )
}
