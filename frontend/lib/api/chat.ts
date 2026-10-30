import { httpClient, tokenStorage } from "./client"
import type { Conversation, ConversationDetail, Message } from "./types"

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000"

export async function listConversations(): Promise<Conversation[]> {
    const { data } = await httpClient.get<Conversation[]>("/api/conversations")
    return data
}

export async function createConversation(title = "새 대화"): Promise<Conversation> {
    const { data } = await httpClient.post<Conversation>("/api/conversations", { title })
    return data
}

export async function getConversation(id: string): Promise<ConversationDetail> {
    const { data } = await httpClient.get<ConversationDetail>(`/api/conversations/${id}`)
    return data
}

export async function deleteConversation(id: string): Promise<void> {
    await httpClient.delete(`/api/conversations/${id}`)
}

export async function listMessages(id: string): Promise<Message[]> {
    const { data } = await httpClient.get<Message[]>(`/api/conversations/${id}/messages`)
    return data
}

/**
 * SSE로 응답 토큰을 받는다.
 *
 * axios는 스트리밍 응답을 다루지 못하고 EventSource는 헤더를 못 붙이므로 fetch를 쓴다.
 * 401이면 토큰을 한 번 재발급해 다시 시도한다(client.ts의 인터셉터와 같은 정책).
 */
export async function streamMessage(conversationId: string, content: string, onToken: (token: string) => void, signal?: AbortSignal): Promise<void> {
    const send = (accessToken: string | null) =>
        fetch(`${BASE_URL}/api/conversations/${conversationId}/stream`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            },
            body: JSON.stringify({ content }),
            signal,
        })

    let response = await send(tokenStorage.current)

    if (response.status === 401) {
        // httpClient의 인터셉터를 태워 토큰을 새로 받는다.
        await httpClient.get("/api/auth/me")
        response = await send(tokenStorage.current)
    }

    if (!response.ok || !response.body) {
        throw new Error(`스트리밍에 실패했습니다 (${response.status})`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // SSE는 빈 줄로 이벤트를 구분한다.
        const blocks = buffer.split("\n\n")
        buffer = blocks.pop() ?? ""

        for (const block of blocks) {
            let eventName = "message"
            const dataLines: string[] = []

            for (const line of block.split("\n")) {
                if (line.startsWith("event:")) eventName = line.slice(6).trim()
                else if (line.startsWith("data:")) dataLines.push(line.slice(5).replace(/^ /, ""))
            }

            const data = dataLines.join("\n")
            if (eventName === "token") onToken(data)
            else if (eventName === "error") throw new Error(data || "응답 생성에 실패했습니다.")
        }
    }
}
