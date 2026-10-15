import { create } from "zustand"

import { chatApi, type Conversation, type Message } from "@/api"

type ChatState = {
    conversations: Conversation[]
    activeId: string | null
    messages: Message[]
    /** 스트리밍 중 아직 저장되지 않은 응답 */
    streamingAnswer: string
    isStreaming: boolean
    error: string | null

    loadConversations: () => Promise<void>
    openConversation: (id: string) => Promise<void>
    startNewConversation: () => Promise<string>
    removeConversation: (id: string) => Promise<void>
    sendMessage: (content: string) => Promise<void>
}

export const useChatStore = create<ChatState>((set, get) => ({
    conversations: [],
    activeId: null,
    messages: [],
    streamingAnswer: "",
    isStreaming: false,
    error: null,

    loadConversations: async () => {
        set({ conversations: await chatApi.listConversations() })
    },

    openConversation: async (id) => {
        const detail = await chatApi.getConversation(id)
        set({ activeId: id, messages: detail.messages, streamingAnswer: "", error: null })
    },

    startNewConversation: async () => {
        const conversation = await chatApi.createConversation()
        set((state) => ({
            conversations: [conversation, ...state.conversations],
            activeId: conversation.id,
            messages: [],
            streamingAnswer: "",
            error: null,
        }))
        return conversation.id
    },

    removeConversation: async (id) => {
        await chatApi.deleteConversation(id)
        set((state) => ({
            conversations: state.conversations.filter((item) => item.id !== id),
            ...(state.activeId === id ? { activeId: null, messages: [] } : {}),
        }))
    },

    sendMessage: async (content) => {
        const conversationId = get().activeId ?? (await get().startNewConversation())

        // 보낸 메시지를 먼저 화면에 띄워 기다리는 느낌을 줄인다.
        const pending: Message = {
            id: `pending-${Date.now()}`,
            role: "user",
            content,
            created_at: new Date().toISOString(),
        }
        set((state) => ({
            messages: [...state.messages, pending],
            isStreaming: true,
            streamingAnswer: "",
            error: null,
        }))

        try {
            await chatApi.streamMessage(conversationId, content, (token) => set((state) => ({ streamingAnswer: state.streamingAnswer + token })))
            // 서버가 저장한 내용으로 맞춰 임시 메시지를 대체한다.
            const messages = await chatApi.listMessages(conversationId)
            set({ messages, streamingAnswer: "", isStreaming: false })
            await get().loadConversations()
        } catch (caught) {
            set({
                isStreaming: false,
                error: caught instanceof Error ? caught.message : "응답을 받지 못했습니다.",
            })
        }
    },
}))
