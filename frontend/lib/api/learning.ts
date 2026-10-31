import { httpClient, LLM_REQUEST_TIMEOUT_MS } from "./client"
import type { SavedWeeklyReview, StudyItem } from "./types"

export async function listReviews(): Promise<SavedWeeklyReview[]> {
    return (await httpClient.get<SavedWeeklyReview[]>("/api/diary/reviews")).data
}

export async function createReview(reference: string): Promise<SavedWeeklyReview> {
    return (await httpClient.post<SavedWeeklyReview>("/api/diary/reviews", { reference }, { timeout: LLM_REQUEST_TIMEOUT_MS })).data
}

export async function deleteReview(id: string): Promise<void> {
    await httpClient.delete(`/api/diary/reviews/${id}`)
}

export async function listStudy(): Promise<StudyItem[]> {
    return (await httpClient.get<StudyItem[]>("/api/diary/study")).data
}

export async function saveStudy(entryId: string, completed: boolean, note: string): Promise<StudyItem> {
    return (await httpClient.put<StudyItem>(`/api/diary/study/${entryId}`, { completed, note })).data
}
