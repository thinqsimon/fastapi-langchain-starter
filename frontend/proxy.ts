import { type NextRequest, NextResponse } from "next/server"

import { application } from "@/lib/application"

/**
 * 라우팅 전에 처리할 것들.
 * - `/`는 `/chat`으로 보낸다. 로그인 안 된 사용자는 `/chat`의 RequireAuth가 `/sign-in`으로 보낸다.
 *   (예전엔 `app/page.tsx`가 했지만, Vercel Hobby는 서버리스 함수가 12개까지라 페이지 하나를 줄였다 — ADMIN-01)
 * - 꺼진 기능은 스트리밍을 시작하기 전에 차단해 실제 HTTP 404를 보장한다.
 */
export function proxy(request: NextRequest) {
    if (request.nextUrl.pathname === "/") {
        return NextResponse.redirect(new URL("/chat", request.url))
    }
    if (!application.diaryEnabled) {
        return NextResponse.rewrite(new URL("/_not-found", request.url), { status: 404 })
    }
    return NextResponse.next()
}

export const config = { matcher: ["/", "/diary/:path*", "/notebook/:path*"] }
