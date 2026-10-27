import { httpClient } from "./client"
import type { Notebook, NotebookTopic, NotebookTopicInput, NotebookTopicPatch } from "./types"

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
