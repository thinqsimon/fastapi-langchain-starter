import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "@/components/auth/auth-provider"

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
})

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
})

export const metadata: Metadata = {
    title: "AX Chat Starter",
    description: "FastAPI · PostgreSQL · Next.js · LangChain 챗봇형 AI 서비스 스타터킷",
}

// 아이폰의 노치·홈 인디케이터 영역까지 화면을 쓰고, 그 안전 영역(safe-area-inset-*)은 각 화면이 여백으로 비운다.
export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
    return (
        <html lang="ko" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
            <body className="flex min-h-full flex-col pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
                <AuthProvider>{children}</AuthProvider>
            </body>
        </html>
    )
}
