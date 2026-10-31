import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios"

import type { ApiErrorBody, TokenPair, User } from "./types"

// Next.js 클라이언트 환경 변수 규칙 (NEXT_PUBLIC_ 필수)
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000"

const ACCESS_TOKEN_KEY = "access_token"
const REFRESH_TOKEN_KEY = "refresh_token"
// 관리자가 "이 계정으로 테스트"(ADMIN-02) 중일 때만 있다. 관리자 자신의 토큰은 위 두 키에 그대로 남겨 둔다.
const ACTING_TOKEN_KEY = "acting_access_token"
const ACTING_ADMIN_KEY = "acting_admin"

/** 테스트 토큰이 만료돼(401) 자동으로 끝났을 때 창에 알린다. 스토어가 듣고 관리자 계정으로 돌아간다. */
export const ACTING_ENDED_EVENT = "auth:acting-ended"

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
        this.clearActing()
    },

    /** 지금 요청에 붙일 토큰. 다른 계정으로 테스트 중이면 그 토큰, 아니면 내 토큰. fetch를 직접 쓰는 곳도 이걸 쓴다. */
    get current() {
        return this.acting ?? this.access
    },
    /** 다른 계정으로 테스트 중인 토큰. 있으면 모든 요청이 이것을 쓴다. */
    get acting() {
        if (typeof window === "undefined") return null
        return localStorage.getItem(ACTING_TOKEN_KEY)
    },
    /** 테스트를 시작한 관리자. 새로고침 뒤에도 띠에 "누가" 테스트 중인지 보여 주려고 저장한다. */
    get actingAdmin(): User | null {
        if (typeof window === "undefined") return null
        const raw = localStorage.getItem(ACTING_ADMIN_KEY)
        if (!raw) return null
        try {
            return JSON.parse(raw) as User
        } catch {
            return null
        }
    },
    saveActing(token: string, admin: User) {
        localStorage.setItem(ACTING_TOKEN_KEY, token)
        localStorage.setItem(ACTING_ADMIN_KEY, JSON.stringify(admin))
    },
    clearActing() {
        localStorage.removeItem(ACTING_TOKEN_KEY)
        localStorage.removeItem(ACTING_ADMIN_KEY)
    },
}

/**
 * AI가 결과를 한 번에 만들어 돌려주는 요청(일기 초안·주간 회고)의 제한 시간.
 * 첫 공급자가 실패해 다음 공급자로 넘어가면 30초를 넘길 수 있어 따로 길게 둔다.
 */
export const LLM_REQUEST_TIMEOUT_MS = 120_000

export const httpClient = axios.create({
    baseURL: BASE_URL,
    timeout: 30000,
    headers: { "Content-Type": "application/json" },
})

// 요청 인터셉터: access token 자동 주입(테스트 중이면 그 계정의 토큰)
httpClient.interceptors.request.use((config) => {
    const accessToken = tokenStorage.current
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

        // 테스트 토큰은 리프레시가 없다. 만료되면 테스트를 끝내고 관리자 계정으로 돌아간다(재발급하면 조용히 관리자 화면으로 바뀌어 헷갈린다).
        if (error.response?.status === 401 && tokenStorage.acting) {
            tokenStorage.clearActing()
            window.dispatchEvent(new Event(ACTING_ENDED_EVENT))
            return Promise.reject(error)
        }

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
