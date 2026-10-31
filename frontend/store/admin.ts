import { create } from "zustand"

import { adminApi, errorMessage, type LlmProviderKey, type LlmProviderName, type LlmRoute, type LlmRoutePatch, type PlanName } from "@/lib/api"

type AdminState = {
    providers: LlmProviderKey[]
    routes: LlmRoute[]
    isLoading: boolean
    /** 불러오기 실패 메시지. 저장 실패는 각 폼이 보여준다. */
    error: string | null
    load: () => Promise<void>
    /** 키 저장. 빈 문자열이면 삭제. 실패하면 예외를 던져 폼이 메시지를 보여주게 한다. */
    saveKey: (provider: LlmProviderName, apiKey: string) => Promise<LlmProviderKey>
    addRoute: (plan: PlanName, provider: LlmProviderName, model: string) => Promise<LlmRoute>
    updateRoute: (routeId: string, patch: LlmRoutePatch) => Promise<LlmRoute>
    removeRoute: (routeId: string) => Promise<void>
    /** 같은 요금제 안에서 한 칸 위/아래로. 두 라우트의 순서 값을 맞바꾼다. */
    moveRoute: (routeId: string, direction: -1 | 1) => Promise<void>
    /** 라우트가 없는 요금제에 기본 모델 사다리를 넣는다. */
    seedDefaults: (plan: PlanName) => Promise<LlmRoute[]>
    reset: () => void
}

/** 요금제 안 순서대로. 서버도 같은 순서(priority, created_at)로 돌려준다. */
export function routesOf(routes: LlmRoute[], plan: PlanName): LlmRoute[] {
    return routes.filter((route) => route.plan === plan).sort((a, b) => a.priority - b.priority)
}

export const useAdminStore = create<AdminState>((set, get) => ({
    providers: [],
    routes: [],
    isLoading: false,
    error: null,

    load: async () => {
        set({ isLoading: true, error: null })
        try {
            const [providers, routes] = await Promise.all([adminApi.fetchProviders(), adminApi.fetchRoutes()])
            set({ providers, routes, isLoading: false })
        } catch (caught) {
            set({ isLoading: false, error: errorMessage(caught, "관리자 설정을 불러오지 못했습니다.") })
        }
    },

    saveKey: async (provider, apiKey) => {
        const updated = await adminApi.updateProviderKey(provider, apiKey)
        set((state) => ({
            providers: state.providers.map((row) => (row.provider === provider ? updated : row)),
            // 라우트의 '키 있음' 표시도 같이 맞춘다.
            routes: state.routes.map((route) => (route.provider === provider ? { ...route, has_api_key: updated.has_api_key } : route)),
        }))
        return updated
    },

    addRoute: async (plan, provider, model) => {
        const created = await adminApi.createRoute(plan, provider, model)
        set((state) => ({ routes: [...state.routes, created] }))
        return created
    },

    updateRoute: async (routeId, patch) => {
        const updated = await adminApi.updateRoute(routeId, patch)
        set((state) => ({
            routes: state.routes.map((route) => {
                if (route.id === routeId) return updated
                // 강제 사용은 요금제당 하나. 서버가 같은 요금제의 다른 강제를 껐으니 화면도 맞춘다.
                return updated.forced && route.plan === updated.plan ? { ...route, forced: false } : route
            }),
        }))
        return updated
    },

    removeRoute: async (routeId) => {
        await adminApi.deleteRoute(routeId)
        set((state) => ({ routes: state.routes.filter((route) => route.id !== routeId) }))
    },

    moveRoute: async (routeId, direction) => {
        const current = get().routes.find((route) => route.id === routeId)
        if (!current) return
        const siblings = routesOf(get().routes, current.plan)
        const index = siblings.findIndex((route) => route.id === routeId)
        const neighbor = siblings[index + direction]
        if (!neighbor) return
        // 순서 값이 같으면(예: 둘 다 1) 바꿔도 티가 안 나므로 자리 번호로 다시 매긴다.
        const mine = index + 1 + direction
        const theirs = index + 1
        const [a, b] = await Promise.all([adminApi.updateRoute(current.id, { priority: mine }), adminApi.updateRoute(neighbor.id, { priority: theirs })])
        set((state) => ({ routes: state.routes.map((route) => (route.id === a.id ? a : route.id === b.id ? b : route)) }))
    },

    seedDefaults: async (plan) => {
        const created = await adminApi.seedDefaultRoutes(plan)
        set((state) => ({ routes: [...state.routes, ...created] }))
        return created
    },

    reset: () => set({ providers: [], routes: [], isLoading: false, error: null }),
}))
