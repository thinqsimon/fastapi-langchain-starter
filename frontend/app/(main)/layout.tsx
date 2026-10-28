import { RequireAuth } from "@/components/auth/require-auth"
import { AppHeader } from "@/components/app-header"

/** 로그인이 필요한 화면들의 공통 레이아웃. */
export default function MainLayout({ children }: LayoutProps<"/">) {
    return (
        <RequireAuth>
            {/* 화면 높이에 고정한다. 대화가 길어져도 헤더는 그대로 있고 내용 영역만 스크롤된다. */}
            <div className="flex h-dvh flex-col">
                <AppHeader />
                <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>
            </div>
        </RequireAuth>
    )
}
