import { APP_NAME } from "@/components/brand-logo"

/** 비밀번호 길이 규칙. 가입·비밀번호 변경과 같다(백엔드 schemas의 8~72자). */
export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 72

/** 비밀번호를 초기화한 사용자에게 카카오톡 등으로 보낼 안내문(ADMIN-05). origin은 지금 사이트 주소. */
export function passwordResetShareText(password: string, origin: string): string {
    return [
        `[${APP_NAME}] 비밀번호를 초기화했습니다.`,
        `새 비밀번호: ${password}`,
        `로그인: ${origin}/sign-in`,
        "로그인한 뒤 설정 화면에서 비밀번호를 바꿔 주세요.",
    ].join("\n")
}
