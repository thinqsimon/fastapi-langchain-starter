import { create } from "zustand"

import { adminApi, errorMessage, type LlmProviderName, type LlmProviderPatch, type LlmProviderSetting } from "@/lib/api"

type AdminState = {
    providers: LlmProviderSetting[]
    isLoading: boolean
    /** 불러오기 실패 메시지. 저장 실패는 각 폼이 보여준다. */
    error: string | null
    load: () => Promise<void>
    /** 한 공급자를 바꾸고 목록을 갱신한다. 실패하면 예외를 던져 폼이 메시지를 보여주게 한다. */
    save: (provider: LlmProviderName, patch: LlmProviderPatch) => Promise<LlmProviderSetting>
    reset: () => void
}

export const useAdminStore = create<AdminState>((set) => ({
    providers: [],
    isLoading: false,
    error: null,

    load: async () => {
        set({ isLoading: true, error: null })
        try {
            set({ providers: await adminApi.fetchProviders(), isLoading: false })
        } catch (caught) {
            set({ isLoading: false, error: errorMessage(caught, "서버 설정을 불러오지 못했습니다.") })
        }
    },

    save: async (provider, patch) => {
        const updated = await adminApi.updateProvider(provider, patch)
        set((state) => ({
            providers: state.providers.map((row) => {
                if (row.provider === provider) return updated
                // 강제 사용은 하나만 가능하다. 서버가 다른 공급자의 강제를 껐으니 화면도 맞춘다.
                return updated.forced ? { ...row, forced: false } : row
            }),
        }))
        return updated
    },

    reset: () => set({ providers: [], isLoading: false, error: null }),
}))
