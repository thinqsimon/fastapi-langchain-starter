import type { NextConfig } from "next"

const profile = process.env.NEXT_PUBLIC_APP_PROFILE ?? process.env.APP_PROFILE ?? "diary-coach"
if (!["starter", "diary-coach"].includes(profile)) {
    throw new Error(`지원하지 않는 앱 프로필입니다: ${profile}`)
}
if (process.env.APP_PROFILE && process.env.NEXT_PUBLIC_APP_PROFILE && process.env.APP_PROFILE !== process.env.NEXT_PUBLIC_APP_PROFILE) {
    throw new Error("APP_PROFILE과 NEXT_PUBLIC_APP_PROFILE을 같은 값으로 설정하세요.")
}

const nextConfig: NextConfig = {
    env: { NEXT_PUBLIC_APP_PROFILE: profile },
    // E2E는 전용 포트(3100)에서 돌기 때문에 dev 리소스 접근을 허용한다.
    allowedDevOrigins: ["127.0.0.1", "localhost"],
}

export default nextConfig
