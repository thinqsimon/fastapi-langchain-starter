import { type NextRequest, NextResponse } from "next/server"

import { application } from "@/lib/application"

/** 스트리밍을 시작하기 전에 꺼진 기능을 차단해 실제 HTTP 404를 보장한다. */
export function proxy(request: NextRequest) {
    if (!application.diaryEnabled) {
        return NextResponse.rewrite(new URL("/_not-found", request.url), { status: 404 })
    }
    return NextResponse.next()
}

export const config = { matcher: ["/diary/:path*", "/notebook/:path*"] }
