import { httpClient } from "./client"
import type { ActingToken, AdminUser, LlmProviderKey, LlmProviderName, LlmRoute, LlmRoutePatch, PlanName } from "./types"

/** 관리자 전용. 세 공급자(OpenAI/Claude/Gemini)의 키 상태를 항상 돌려준다. 관리자가 아니면 403. */
export async function fetchProviders(): Promise<LlmProviderKey[]> {
    const { data } = await httpClient.get<LlmProviderKey[]>("/api/admin/llm-providers")
    return data
}

/** 키를 저장한다. 빈 문자열이면 지운다(그 공급자는 모든 요금제에서 빠진다). */
export async function updateProviderKey(provider: LlmProviderName, apiKey: string): Promise<LlmProviderKey> {
    const { data } = await httpClient.patch<LlmProviderKey>(`/api/admin/llm-providers/${provider}`, { api_key: apiKey })
    return data
}

/** 요금제별 라우트 전체(요금제·순서 순). */
export async function fetchRoutes(): Promise<LlmRoute[]> {
    const { data } = await httpClient.get<LlmRoute[]>("/api/admin/llm-routes")
    return data
}

export async function createRoute(plan: PlanName, provider: LlmProviderName, model: string): Promise<LlmRoute> {
    const { data } = await httpClient.post<LlmRoute>("/api/admin/llm-routes", { plan, provider, model })
    return data
}

export async function updateRoute(routeId: string, patch: LlmRoutePatch): Promise<LlmRoute> {
    const { data } = await httpClient.patch<LlmRoute>(`/api/admin/llm-routes/${routeId}`, patch)
    return data
}

export async function deleteRoute(routeId: string): Promise<void> {
    await httpClient.delete(`/api/admin/llm-routes/${routeId}`)
}

/** 라우트가 없는 요금제에 기본 모델 사다리를 넣는다. 이미 있으면 409. */
export async function seedDefaultRoutes(plan: PlanName): Promise<LlmRoute[]> {
    const { data } = await httpClient.post<LlmRoute[]>("/api/admin/llm-routes/defaults", { plan })
    return data
}

/** 이메일이나 이름 일부로 사용자를 찾는다(최근 가입순, 최대 20명). */
export async function searchUsers(query: string): Promise<AdminUser[]> {
    const { data } = await httpClient.get<AdminUser[]>("/api/admin/users", { params: { q: query } })
    return data
}

/** 사용자 요금제를 바꾼다(ADMIN-03). 다음 요청부터 그 요금제의 라우팅을 탄다. */
export async function setUserPlan(userId: string, plan: PlanName): Promise<AdminUser> {
    const { data } = await httpClient.patch<AdminUser>(`/api/admin/users/${userId}/plan`, { plan })
    return data
}

/** 그 사용자 명의의 테스트 토큰을 받는다(ADMIN-02). 삭제·계정 변경은 서버가 막는다. */
export async function createActingToken(userId: string): Promise<ActingToken> {
    const { data } = await httpClient.post<ActingToken>(`/api/admin/users/${userId}/acting-token`)
    return data
}
