import { create } from "zustand"

import { authApi, tokenStorage, type User } from "@/api"

type AuthState = {
    user: User | null
    /** 앱 시작 시 저장된 토큰으로 로그인 상태를 복원하는 중인지 */
    isLoading: boolean
    isAuthenticated: boolean
    /** 새로고침 후 토큰으로 사용자 정보를 다시 불러온다. */
    restore: () => Promise<void>
    login: (email: string, password: string) => Promise<void>
    logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    isLoading: true,
    isAuthenticated: false,

    restore: async () => {
        if (!tokenStorage.access) {
            set({ user: null, isAuthenticated: false, isLoading: false })
            return
        }
        try {
            const user = await authApi.fetchMe()
            set({ user, isAuthenticated: true, isLoading: false })
        } catch {
            tokenStorage.clear()
            set({ user: null, isAuthenticated: false, isLoading: false })
        }
    },

    login: async (email, password) => {
        await authApi.login({ email, password })
        const user = await authApi.fetchMe()
        set({ user, isAuthenticated: true, isLoading: false })
    },

    logout: async () => {
        await authApi.logout()
        set({ user: null, isAuthenticated: false, isLoading: false })
    },
}))
