import { httpClient } from "./client"
import type { DiaryDraft, DiaryEntry, DiaryEntryCreate, DiaryForm, EligibleConversation, WeeklyReview } from "./types"

export async function listEntries(): Promise<DiaryEntry[]> {
    const { data } = await httpClient.get<DiaryEntry[]>("/api/diary")
    return data
}

/** 일기로 만들 수 있는 채팅. 이미 쓴 채팅은 새 대화가 있을 때만 나온다. */
export async function listEligibleConversations(): Promise<EligibleConversation[]> {
    const { data } = await httpClient.get<EligibleConversation[]>("/api/diary/conversations")
    return data
}

/** 고른 채팅으로 일기 초안을 만든다(저장은 하지 않는다). 날짜는 사용자 기준 오늘이다. */
export async function draftFromConversation(conversationId: string, entryDate: string): Promise<DiaryDraft> {
    const { data } = await httpClient.post<DiaryDraft>("/api/diary/draft", {
        conversation_id: conversationId,
        entry_date: entryDate,
    })
    return data
}

export async function createEntry(input: DiaryEntryCreate): Promise<DiaryEntry> {
    const { data } = await httpClient.post<DiaryEntry>("/api/diary", input)
    return data
}

export async function updateEntry(id: string, input: DiaryForm): Promise<DiaryEntry> {
    const { data } = await httpClient.patch<DiaryEntry>(`/api/diary/${id}`, input)
    return data
}

export async function deleteEntry(id: string): Promise<void> {
    await httpClient.delete(`/api/diary/${id}`)
}

export async function fetchWeeklyReview(reference?: string): Promise<WeeklyReview> {
    const { data } = await httpClient.get<WeeklyReview>("/api/diary/weekly", { params: { reference } })
    return data
}
