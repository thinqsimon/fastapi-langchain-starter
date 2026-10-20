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
    // 계정 정보 수정. 실패하면 예외를 그대로 던져 화면이 메시지를 보여주게 한다.
    updateProfile: (displayName: string) => Promise<void>
    changeEmail: (email: string, currentPassword: string) => Promise<void>
    changePassword: (currentPassword: string, newPassword: string) => Promise<void>
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

    updateProfile: async (displayName) => {
        set({ user: await authApi.updateProfile({ display_name: displayName }) })
    },

    changeEmail: async (email, currentPassword) => {
        set({ user: await authApi.changeEmail({ email, current_password: currentPassword }) })
    },

    changePassword: async (currentPassword, newPassword) => {
        // 새 토큰은 api 계층이 저장한다. 사용자 정보는 바뀌지 않는다.
        await authApi.changePassword({ current_password: currentPassword, new_password: newPassword })
    },
}))
