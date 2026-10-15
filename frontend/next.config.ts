import type { NextConfig } from "next"

const nextConfig: NextConfig = {
    // E2E는 전용 포트(3100)에서 돌기 때문에 dev 리소스 접근을 허용한다.
    allowedDevOrigins: ["127.0.0.1", "localhost"],
}

export default nextConfig
