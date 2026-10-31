import { httpClient } from "./client"
import type { AnswerLevelInfo } from "./types"

/** 1~5단계 이름(관리자가 바꾼 이름 포함)·대상·답변 방식·예시. 내 단계는 /api/auth/me의 answer_level. */
export async function fetchAnswerLevels(): Promise<AnswerLevelInfo[]> {
    const { data } = await httpClient.get<AnswerLevelInfo[]>("/api/answer-levels")
    return data
}

/** 관리자: 단계 이름을 바꾼다. 답변 방식은 단계 번호로 정해져 그대로다. */
export async function renameAnswerLevel(level: number, name: string): Promise<AnswerLevelInfo> {
    const { data } = await httpClient.patch<AnswerLevelInfo>(`/api/admin/answer-levels/${level}`, { name })
    return data
}

/** 관리자: 단계 이름을 기본 이름으로 되돌린다. */
export async function resetAnswerLevelName(level: number): Promise<AnswerLevelInfo> {
    const { data } = await httpClient.delete<AnswerLevelInfo>(`/api/admin/answer-levels/${level}/name`)
    return data
}
