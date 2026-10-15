import axios from "axios"

// Next.js 클라이언트 환경 변수 규칙 (NEXT_PUBLIC_ 필수)
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000"

export const httpClient = axios.create({
    baseURL: BASE_URL,
    timeout: 10000,
    headers: { "Content-Type": "application/json" },
})

// 요청 인터셉터: access token 자동 주입
httpClient.interceptors.request.use((config) => {
    if (typeof window !== "undefined") {
        const accessToken = localStorage.getItem("access_token")
        if (accessToken) {
            config.headers.Authorization = `Bearer ${accessToken}`
        }
    }
    return config
})

// 응답 인터셉터: 401 시 refresh token 재발급 (구현 예정: feature FE-02)
httpClient.interceptors.response.use(
    (response) => response,
    (error) => Promise.reject(error)
)
