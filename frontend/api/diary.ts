import { httpClient } from "./client"
import type { DiaryDraft, DiaryEntry, WeeklyReview } from "./types"

export async function listEntries(): Promise<DiaryEntry[]> {
    const { data } = await httpClient.get<DiaryEntry[]>("/api/diary")
    return data
}

/** 코칭 대화를 읽어 일기 초안을 만든다(저장은 하지 않는다). */
export async function draftFromConversation(conversationId: string): Promise<DiaryDraft> {
    const { data } = await httpClient.post<DiaryDraft>("/api/diary/draft", {
        conversation_id: conversationId,
    })
    return data
}

export async function createEntry(input: DiaryDraft & { conversation_id?: string }): Promise<DiaryEntry> {
    const { data } = await httpClient.post<DiaryEntry>("/api/diary", input)
    return data
}

export async function updateEntry(id: string, input: DiaryDraft): Promise<DiaryEntry> {
    const { data } = await httpClient.patch<DiaryEntry>(`/api/diary/${id}`, input)
    return data
}

export async function deleteEntry(id: string): Promise<void> {
    await httpClient.delete(`/api/diary/${id}`)
}

export async function fetchWeeklyReview(): Promise<WeeklyReview> {
    const { data } = await httpClient.get<WeeklyReview>("/api/diary/weekly")
    return data
}
