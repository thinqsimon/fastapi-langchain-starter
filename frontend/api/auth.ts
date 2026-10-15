import { httpClient, tokenStorage } from "./client"
import type { TokenPair, User } from "./types"

export async function signup(input: { email: string; password: string; display_name: string }): Promise<User> {
    const { data } = await httpClient.post<User>("/api/auth/signup", input)
    return data
}

export async function login(input: { email: string; password: string }): Promise<TokenPair> {
    const { data } = await httpClient.post<TokenPair>("/api/auth/login", input)
    tokenStorage.save(data)
    return data
}

export async function fetchMe(): Promise<User> {
    const { data } = await httpClient.get<User>("/api/auth/me")
    return data
}

export async function logout(): Promise<void> {
    const refreshToken = tokenStorage.refresh
    try {
        if (refreshToken) {
            await httpClient.post("/api/auth/logout", { refresh_token: refreshToken })
        }
    } finally {
        // 서버 호출이 실패해도 로컬 세션은 반드시 비운다.
        tokenStorage.clear()
    }
}
