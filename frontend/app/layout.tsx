import type { Metadata } from "next"
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

export default function RootLayout({ children }: LayoutProps<"/">) {
    return (
        <html lang="ko" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
            <body className="flex min-h-full flex-col">
                <AuthProvider>{children}</AuthProvider>
            </body>
        </html>
    )
}
