import { create } from "zustand"

import { preferencesApi, type Preferences } from "@/lib/api"

type PreferencesState = {
    /** 아직 불러오지 않았으면 null */
    preferences: Preferences | null
    load: () => Promise<void>
    save: (input: Preferences) => Promise<Preferences>
    /** 기본값으로 되돌리고, 되돌린 값을 돌려준다(입력칸을 채우는 데 쓴다). */
    reset: () => Promise<Preferences>
    /** 로그아웃할 때 비운다. 다음 사람이 이전 사람의 문구를 잠깐이라도 보지 않게 한다. */
    clear: () => void
}

export const usePreferencesStore = create<PreferencesState>((set) => ({
    preferences: null,

    load: async () => {
        try {
            set({ preferences: await preferencesApi.fetchPreferences() })
        } catch {
            // 캐치프레이즈는 부가 기능이라 실패해도 화면을 막지 않는다.
        }
    },

    save: async (input) => {
        const preferences = await preferencesApi.updatePreferences(input)
        set({ preferences })
        return preferences
    },

    reset: async () => {
        const preferences = await preferencesApi.resetPreferences()
        set({ preferences })
        return preferences
    },

    clear: () => set({ preferences: null }),
}))
