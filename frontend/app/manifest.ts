import type { MetadataRoute } from "next"

import { APP_NAME } from "@/components/brand-logo"

/** 홈 화면에 추가했을 때의 이름·아이콘(안드로이드·데스크톱 설치). 아이폰은 app/apple-icon.png를 쓴다. */
export default function manifest(): MetadataRoute.Manifest {
    return {
        name: APP_NAME,
        short_name: APP_NAME,
        description: "코치와 대화하며 오늘 배운 것을 정리하는 배움일기",
        start_url: "/chat",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#ffffff",
        icons: [
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
    }
}
