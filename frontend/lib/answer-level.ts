import type { AnswerLevelInfo } from "@/lib/api"

/** 아직 고르지 않은 사용자는 서버가 이 단계로 답한다(backend app/core/answer_levels.py와 같은 값). */
export const DEFAULT_ANSWER_LEVEL = 2

/** 목록을 불러오기 전에도 보이도록 기본 이름을 둔다. 관리자가 바꾼 이름은 서버 목록이 우선한다. */
const FALLBACK_NAMES: Record<number, string> = { 1: "왕초보", 2: "입문", 3: "기초", 4: "실전", 5: "심화" }

/** "3단계 기초" 같은 표기. */
export function answerLevelLabel(level: number, levels: AnswerLevelInfo[]): string {
    const name = levels.find((item) => item.level === level)?.name ?? FALLBACK_NAMES[level] ?? ""
    return `${level}단계 ${name}`.trim()
}

/**
 * '로/으로' 조사. 이름을 관리자가 바꿀 수 있어 받침을 보고 고른다.
 * 받침이 없거나 ㄹ 받침이면 '로'(왕초보로, 서울로), 그 밖의 받침이면 '으로'(입문으로).
 * 한글로 끝나지 않으면(영문·숫자) '(으)로'.
 */
export function josaRo(word: string): string {
    const last = word.trim().slice(-1)
    const code = last.charCodeAt(0)
    if (!last || code < 0xac00 || code > 0xd7a3) return "(으)로"
    const finalConsonant = (code - 0xac00) % 28
    return finalConsonant === 0 || finalConsonant === 8 ? "로" : "으로"
}
