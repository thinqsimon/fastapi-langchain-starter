import Link from "next/link"

export default function Home() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
            <h1 className="text-2xl font-bold">AX Chat Starter</h1>
            <nav className="flex gap-4 underline">
                <Link href="/sign-in">로그인</Link>
                <Link href="/sign-up">회원가입</Link>
                <Link href="/chat">채팅</Link>
            </nav>
        </main>
    )
}
