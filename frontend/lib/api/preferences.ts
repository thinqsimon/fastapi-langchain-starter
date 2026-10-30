import { httpClient } from "./client"
import type { Preferences } from "./types"

/** 저장한 적이 없으면 서버의 기본 문구가 온다. */
export async function fetchPreferences(): Promise<Preferences> {
    const { data } = await httpClient.get<Preferences>("/api/me/preferences")
    return data
}

export async function updatePreferences(input: Preferences): Promise<Preferences> {
    const { data } = await httpClient.put<Preferences>("/api/me/preferences", input)
    return data
}

/** 저장한 값을 지우고 기본값을 돌려받는다. */
export async function resetPreferences(): Promise<Preferences> {
    const { data } = await httpClient.delete<Preferences>("/api/me/preferences")
    return data
}
