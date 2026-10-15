import { httpClient } from "./client"
import type { UsageSummary } from "./types"

export async function fetchMyUsage(): Promise<UsageSummary> {
    const { data } = await httpClient.get<UsageSummary>("/api/usage/me")
    return data
}
