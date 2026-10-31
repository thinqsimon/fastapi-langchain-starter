/** 서비스 선택과 브랜드의 단일 진입점. NEXT_PUBLIC 값은 빌드 시 고정된다. */
export type AppProfile = "starter" | "diary-coach"

const definitions = {
    starter: {
        name: "AX Chat Starter",
        subtitle: "AI CHAT STARTER",
        description: "FastAPI · PostgreSQL · Next.js · LangChain 챗봇형 AI 서비스 스타터킷",
        diaryEnabled: false,
        demoVideoUrl: null,
    },
    "diary-coach": {
        name: "배움일기 코치",
        subtitle: "LEARNING DIARY COACH",
        description: "AI와 나눈 학습 대화를 배움일기로 정리하는 학습 코치",
        diaryEnabled: true,
        /** 로그인·가입 화면의 '사용법 시연' 버튼이 여는 시연 영상(최종 발표용, 3분 38초). */
        demoVideoUrl: "https://youtu.be/wCsDCMeg8WQ",
    },
} as const

const profile = process.env.NEXT_PUBLIC_APP_PROFILE ?? "diary-coach"
if (profile !== "starter" && profile !== "diary-coach") {
    throw new Error(`지원하지 않는 앱 프로필입니다: ${profile}`)
}

export const application = {
    ...definitions[profile],
    profile,
    name: process.env.NEXT_PUBLIC_APP_NAME?.trim() || definitions[profile].name,
    navigation: [
        { href: "/chat", label: "채팅" },
        ...(definitions[profile].diaryEnabled
            ? [
                  { href: "/notebook", label: "학습장" },
                  { href: "/diary", label: "일기" },
              ]
            : []),
    ],
}
