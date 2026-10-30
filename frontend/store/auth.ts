import { create } from "zustand"

import { adminApi, authApi, tokenStorage, type User } from "@/lib/api"
import { useChatStore } from "@/store/chat"
import { useDiaryStore } from "@/store/diary"
import { useLearningStore } from "@/store/learning"
import { useNotebookStore } from "@/store/notebook"
import { usePreferencesStore } from "@/store/preferences"

/** 관리자가 "이 계정으로 테스트" 중일 때(ADMIN-02). admin은 돌아갈 계정, target은 지금 보고 있는 계정. */
export type Acting = { admin: User; target: User }

type AuthState = {
    user: User | null
    /** 앱 시작 시 저장된 토큰으로 로그인 상태를 복원하는 중인지 */
    isLoading: boolean
    isAuthenticated: boolean
    acting: Acting | null
    /** 새로고침 후 토큰으로 사용자 정보를 다시 불러온다. */
    restore: () => Promise<void>
    login: (email: string, password: string) => Promise<void>
    logout: () => Promise<void>
    // 계정 정보 수정. 실패하면 예외를 그대로 던져 화면이 메시지를 보여주게 한다.
    updateProfile: (displayName: string) => Promise<void>
    changeEmail: (email: string, currentPassword: string) => Promise<void>
    changePassword: (currentPassword: string, newPassword: string) => Promise<void>
    /** 서버의 내 정보를 다시 읽는다(쿠폰 등록 뒤 요금제·만료일 갱신). */
    refreshUser: () => Promise<void>
    /** 관리자: 그 사용자 계정으로 테스트를 시작한다. 이후 모든 요청이 그 계정으로 나간다. */
    startActing: (userId: string) => Promise<void>
    /** 테스트를 끝내고 관리자 계정으로 돌아온다. 토큰이 이미 만료된 경우에도 쓴다. */
    stopActing: () => Promise<void>
}

/** 계정이 바뀔 때(로그인·로그아웃·테스트 시작/종료) 이전 계정의 화면 데이터를 비운다. */
function resetAccountStores() {
    useChatStore.getState().reset()
    useNotebookStore.getState().reset()
    useDiaryStore.getState().reset()
    useLearningStore.getState().reset()
    usePreferencesStore.getState().clear()
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    acting: null,

    restore: async () => {
        if (!tokenStorage.access) {
            tokenStorage.clearActing()
            set({ user: null, isAuthenticated: false, isLoading: false })
            return
        }
        // 테스트 중에 새로고침한 경우: 테스트 토큰이 살아 있으면 그 계정으로, 만료됐으면 관리자 계정으로 복원한다.
        const admin = tokenStorage.actingAdmin
        if (tokenStorage.acting && admin) {
            try {
                const target = await authApi.fetchMe()
                set({ user: target, acting: { admin, target }, isAuthenticated: true, isLoading: false })
                return
            } catch {
                tokenStorage.clearActing()
            }
        } else {
            tokenStorage.clearActing()
        }
        try {
            const user = await authApi.fetchMe()
            set({ user, acting: null, isAuthenticated: true, isLoading: false })
        } catch {
            tokenStorage.clear()
            set({ user: null, acting: null, isAuthenticated: false, isLoading: false })
        }
    },

    login: async (email, password) => {
        await authApi.login({ email, password })
        const user = await authApi.fetchMe()
        resetAccountStores()
        set({ user, acting: null, isAuthenticated: true, isLoading: false })
    },

    logout: async () => {
        // 테스트 중이면 그 토큰부터 버린다(관리자 토큰으로 로그아웃해야 한다).
        tokenStorage.clearActing()
        // API 계층은 실패해도 토큰을 비운다. 서버 장애가 로컬 로그아웃을 막아서는 안 된다.
        await authApi.logout().catch(() => undefined)
        resetAccountStores()
        set({ user: null, acting: null, isAuthenticated: false, isLoading: false })
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

    refreshUser: async () => {
        const user = await authApi.fetchMe()
        set((state) => ({ user, acting: state.acting ? { ...state.acting, target: user } : null }))
    },

    startActing: async (userId) => {
        const admin = get().acting?.admin ?? get().user
        if (!admin) return
        const { access_token } = await adminApi.createActingToken(userId)
        tokenStorage.saveActing(access_token, admin)
        resetAccountStores()
        const target = await authApi.fetchMe()
        set({ user: target, acting: { admin, target } })
    },

    stopActing: async () => {
        tokenStorage.clearActing()
        resetAccountStores()
        const user = await authApi.fetchMe()
        set({ user, acting: null })
    },
}))
