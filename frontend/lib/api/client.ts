import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios"

import type { ApiErrorBody, TokenPair } from "./types"

// Next.js 클라이언트 환경 변수 규칙 (NEXT_PUBLIC_ 필수)
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000"

const ACCESS_TOKEN_KEY = "access_token"
const REFRESH_TOKEN_KEY = "refresh_token"

export const tokenStorage = {
    get access() {
        if (typeof window === "undefined") return null
        return localStorage.getItem(ACCESS_TOKEN_KEY)
    },
    get refresh() {
        if (typeof window === "undefined") return null
        return localStorage.getItem(REFRESH_TOKEN_KEY)
    },
    save(tokens: TokenPair) {
        localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token)
        localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token)
    },
    clear() {
        localStorage.removeItem(ACCESS_TOKEN_KEY)
        localStorage.removeItem(REFRESH_TOKEN_KEY)
    },
}

export const httpClient = axios.create({
    baseURL: BASE_URL,
    timeout: 30000,
    headers: { "Content-Type": "application/json" },
})

// 요청 인터셉터: access token 자동 주입
httpClient.interceptors.request.use((config) => {
    const accessToken = tokenStorage.access
    if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`
    }
    return config
})

/** 백엔드의 공통 에러 형식에서 사람이 읽을 메시지를 꺼낸다. */
export function errorMessage(error: unknown, fallback = "요청을 처리하지 못했습니다."): string {
    if (error instanceof AxiosError) {
        const body = error.response?.data as ApiErrorBody | undefined
        if (body?.error?.details?.length) return body.error.details[0].message
        if (body?.error?.message) return body.error.message
        if (!error.response) return "서버에 연결할 수 없습니다."
    }
    return fallback
}

type RetriableRequest = InternalAxiosRequestConfig & { _retried?: boolean }

// 동시에 여러 요청이 401을 받아도 리프레시는 한 번만 호출한다.
let refreshInFlight: Promise<string> | null = null

async function refreshAccessToken(): Promise<string> {
    const refreshToken = tokenStorage.refresh
    if (!refreshToken) throw new Error("no refresh token")

    // 인터셉터 재귀를 피하려고 기본 axios로 호출한다.
    const { data } = await axios.post<TokenPair>(
        `${BASE_URL}/api/auth/refresh`,
        { refresh_token: refreshToken },
        { headers: { "Content-Type": "application/json" } }
    )
    tokenStorage.save(data)
    return data.access_token
}

// 응답 인터셉터: 401이면 토큰을 한 번 재발급해 원래 요청을 다시 보낸다.
httpClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const request = error.config as RetriableRequest | undefined

        const canRetry =
            error.response?.status === 401 &&
            request &&
            !request._retried &&
            // 리프레시 자체가 실패한 경우엔 재시도하지 않는다(무한 루프 방지).
            !request.url?.includes("/api/auth/refresh") &&
            tokenStorage.refresh

        if (!canRetry) return Promise.reject(error)

        request._retried = true
        try {
            refreshInFlight ??= refreshAccessToken().finally(() => {
                refreshInFlight = null
            })
            const accessToken = await refreshInFlight
            request.headers.Authorization = `Bearer ${accessToken}`
            return httpClient(request)
        } catch {
            // 재발급도 실패하면 로그인 상태를 비운다.
            tokenStorage.clear()
            return Promise.reject(error)
        }
    }
)
