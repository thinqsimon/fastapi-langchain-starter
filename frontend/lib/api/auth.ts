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

export async function updateProfile(input: { display_name: string }): Promise<User> {
    const { data } = await httpClient.patch<User>("/api/auth/me", input)
    return data
}

/** 로그인 ID가 바뀌므로 현재 비밀번호를 함께 보낸다. */
export async function changeEmail(input: { email: string; current_password: string }): Promise<User> {
    const { data } = await httpClient.put<User>("/api/auth/me/email", input)
    return data
}

/** 다른 기기의 로그인은 모두 끊기고, 이 화면은 새로 받은 토큰으로 이어진다. */
export async function changePassword(input: { current_password: string; new_password: string }): Promise<void> {
    const { data } = await httpClient.put<TokenPair>("/api/auth/me/password", input)
    tokenStorage.save(data)
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
