import { httpClient } from "./client"
import type { ActingToken, AdminUser, LlmProviderName, LlmProviderPatch, LlmProviderSetting } from "./types"

/** 관리자 전용. 세 공급자(OpenAI/Claude/Gemini)를 항상 돌려준다. 관리자가 아니면 403. */
export async function fetchProviders(): Promise<LlmProviderSetting[]> {
    const { data } = await httpClient.get<LlmProviderSetting[]>("/api/admin/llm-providers")
    return data
}

export async function updateProvider(provider: LlmProviderName, patch: LlmProviderPatch): Promise<LlmProviderSetting> {
    const { data } = await httpClient.patch<LlmProviderSetting>(`/api/admin/llm-providers/${provider}`, patch)
    return data
}

/** 이메일이나 이름 일부로 사용자를 찾는다(최근 가입순, 최대 20명). */
export async function searchUsers(query: string): Promise<AdminUser[]> {
    const { data } = await httpClient.get<AdminUser[]>("/api/admin/users", { params: { q: query } })
    return data
}

/** 그 사용자 명의의 테스트 토큰을 받는다(ADMIN-02). 삭제·계정 변경은 서버가 막는다. */
export async function createActingToken(userId: string): Promise<ActingToken> {
    const { data } = await httpClient.post<ActingToken>(`/api/admin/users/${userId}/acting-token`)
    return data
}
