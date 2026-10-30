import { httpClient } from "./client"
import type { LlmProviderName, LlmProviderPatch, LlmProviderSetting } from "./types"

/** 관리자 전용. 세 공급자(OpenAI/Claude/Gemini)를 항상 돌려준다. 관리자가 아니면 403. */
export async function fetchProviders(): Promise<LlmProviderSetting[]> {
    const { data } = await httpClient.get<LlmProviderSetting[]>("/api/admin/llm-providers")
    return data
}

export async function updateProvider(provider: LlmProviderName, patch: LlmProviderPatch): Promise<LlmProviderSetting> {
    const { data } = await httpClient.patch<LlmProviderSetting>(`/api/admin/llm-providers/${provider}`, patch)
    return data
}
