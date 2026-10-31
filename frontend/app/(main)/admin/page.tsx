import { AnswerLevelAdmin } from "@/components/admin/answer-level-admin"
import { CouponAdmin } from "@/components/admin/coupon-admin"
import { ServerSettings } from "@/components/admin/server-settings"
import { UserLookup } from "@/components/admin/user-lookup"

/** 관리자 화면(ADMIN-01~04, COUPON-01, CHAT-03). 메뉴는 관리자에게만 보이지만 주소로 들어와도 각 구역이 한 번 더 막는다. */
export default function AdminPage() {
    return (
        <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-6 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] *:shrink-0 sm:p-6 sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <h1 className="text-xl font-semibold">관리자</h1>

            <UserLookup />

            <CouponAdmin />

            <AnswerLevelAdmin />

            <section aria-labelledby="admin-llm-heading" className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                    <h2 id="admin-llm-heading" className="text-lg font-semibold">
                        LLM 공급자
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        채팅·일기 생성에 쓰는 공급자를 정합니다. 우선순위 순으로 시도하고, 앞 공급자가 한도 초과 등으로 실패하면 다음으로 자동 전환합니다.
                    </p>
                </div>
                <ServerSettings />
            </section>
        </div>
    )
}
