import { create } from "zustand"

import { usageApi, type UsageSummary } from "@/api"

type UsageState = {
    usage: UsageSummary | null
    refresh: () => Promise<void>
}

export const useUsageStore = create<UsageState>((set) => ({
    usage: null,
    refresh: async () => {
        try {
            set({ usage: await usageApi.fetchMyUsage() })
        } catch {
            // 사용량 표시는 부가 기능이라 실패해도 화면을 막지 않는다.
            set({ usage: null })
        }
    },
}))
