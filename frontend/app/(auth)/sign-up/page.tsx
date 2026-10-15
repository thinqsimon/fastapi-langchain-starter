"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { authApi, errorMessage } from "@/api"
import { AuthFormCard } from "@/components/auth/auth-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuthStore } from "@/store/auth"

export default function SignUpPage() {
    const router = useRouter()
    const login = useAuthStore((state) => state.login)
    const [error, setError] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setError(null)
        setIsSubmitting(true)

        const form = new FormData(event.currentTarget)
        const email = String(form.get("email"))
        const password = String(form.get("password"))

        try {
            await authApi.signup({
                email,
                password,
                display_name: String(form.get("display_name")),
            })
            // 가입 직후 바로 로그인시켜 한 단계를 줄인다.
            await login(email, password)
            router.replace("/chat")
        } catch (caught) {
            setError(errorMessage(caught, "회원가입하지 못했습니다."))
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <AuthFormCard
            title="회원가입"
            description="이메일로 새 계정을 만듭니다."
            error={error}
            isSubmitting={isSubmitting}
            submitLabel="가입하기"
            footer={{ text: "이미 계정이 있으신가요?", linkLabel: "로그인", href: "/sign-in" }}
            onSubmit={handleSubmit}
        >
            <div className="flex flex-col gap-2">
                <Label htmlFor="display_name">이름</Label>
                <Input id="display_name" name="display_name" maxLength={50} required />
            </div>
            <div className="flex flex-col gap-2">
                <Label htmlFor="email">이메일</Label>
                <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="flex flex-col gap-2">
                <Label htmlFor="password">비밀번호</Label>
                <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
                <p className="text-xs text-muted-foreground">8자 이상 입력하세요.</p>
            </div>
        </AuthFormCard>
    )
}
