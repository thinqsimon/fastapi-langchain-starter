import { httpClient } from "./client"
import type { Notebook, NotebookTopic, NotebookTopicInput, NotebookTopicPatch, NotebookTopicSummary } from "./types"

export async function listNotebooks(): Promise<Notebook[]> {
    return (await httpClient.get<Notebook[]>("/api/notebooks")).data
}

/** md 파일은 브라우저가 읽어 JSON으로 보낸다(multipart 없음). 같은 파일명이면 409. */
export async function uploadNotebook(filename: string, content: string): Promise<Notebook> {
    return (await httpClient.post<Notebook>("/api/notebooks/upload", { filename, content })).data
}

export async function createNotebook(title: string): Promise<Notebook> {
    return (await httpClient.post<Notebook>("/api/notebooks", { title })).data
}

export async function renameNotebook(id: string, title: string): Promise<Notebook> {
    return (await httpClient.patch<Notebook>(`/api/notebooks/${id}`, { title })).data
}

export async function deleteNotebook(id: string): Promise<void> {
    await httpClient.delete(`/api/notebooks/${id}`)
}

export async function createTopic(notebookId: string, input: NotebookTopicInput): Promise<NotebookTopic> {
    return (await httpClient.post<NotebookTopic>(`/api/notebooks/${notebookId}/topics`, input)).data
}

export async function getTopic(topicId: string): Promise<NotebookTopic> {
    return (await httpClient.get<NotebookTopic>(`/api/notebooks/topics/${topicId}`)).data
}

export async function updateTopic(topicId: string, patch: NotebookTopicPatch): Promise<NotebookTopic> {
    return (await httpClient.patch<NotebookTopic>(`/api/notebooks/topics/${topicId}`, patch)).data
}

export async function deleteTopic(topicId: string): Promise<void> {
    await httpClient.delete(`/api/notebooks/topics/${topicId}`)
}

/** 여러 주제를 한 번에 보관(true)·보관 해제(false)한다. 하나라도 내 주제가 아니면 404이고 아무것도 바뀌지 않는다. */
export async function keepTopics(topicIds: string[], kept: boolean): Promise<NotebookTopicSummary[]> {
    return (await httpClient.patch<NotebookTopicSummary[]>("/api/notebooks/topics/keep", { topic_ids: topicIds, kept })).data
}
