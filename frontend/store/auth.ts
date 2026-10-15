import { create } from "zustand"

type AuthState = {
    isAuthenticated: boolean
    setAuthenticated: (value: boolean) => void
}

// 로그인 상태 전역 저장소 (구현 예정: feature FE-01)
export const useAuthStore = create<AuthState>((set) => ({
    isAuthenticated: false,
    setAuthenticated: (value) => set({ isAuthenticated: value }),
}))
