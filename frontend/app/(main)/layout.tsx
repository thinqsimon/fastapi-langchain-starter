import { RequireAuth } from "@/components/auth/require-auth"
import { AppHeader } from "@/components/app-header"

/** 로그인이 필요한 화면들의 공통 레이아웃. */
export default function MainLayout({ children }: LayoutProps<"/">) {
    return (
        <RequireAuth>
            <AppHeader />
            <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
        </RequireAuth>
    )
}
