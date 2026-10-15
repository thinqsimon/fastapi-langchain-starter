"use client"

import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

/** 로그인·회원가입 화면이 함께 쓰는 껍데기. */
export function AuthFormCard({
    title,
    description,
    error,
    isSubmitting,
    submitLabel,
    footer,
    onSubmit,
    children,
}: {
    title: string
    description: string
    error: string | null
    isSubmitting: boolean
    submitLabel: string
    footer: { text: string; linkLabel: string; href: "/sign-in" | "/sign-up" }
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
    children: React.ReactNode
}) {
    return (
        <Card className="w-full max-w-sm">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
                    {children}

                    {error && (
                        <p role="alert" className="text-sm text-destructive">
                            {error}
                        </p>
                    )}

                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? "처리 중…" : submitLabel}
                    </Button>
                </form>

                <p className="mt-4 text-center text-sm text-muted-foreground">
                    {footer.text}{" "}
                    <Link href={footer.href} className="text-foreground underline">
                        {footer.linkLabel}
                    </Link>
                </p>
            </CardContent>
        </Card>
    )
}
