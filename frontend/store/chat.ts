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
    sessionVersion: number
    reset: () => void

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
    sessionVersion: 0,
    reset: () =>
        set((state) => ({
            conversations: [],
            activeId: null,
            messages: [],
            streamingAnswer: "",
            isStreaming: false,
            error: null,
            sessionVersion: state.sessionVersion + 1,
        })),

    loadConversations: async () => {
        const sessionVersion = get().sessionVersion
        const conversations = await chatApi.listConversations()
        if (get().sessionVersion === sessionVersion) set({ conversations })
    },

    openConversation: async (id) => {
        const sessionVersion = get().sessionVersion
        const detail = await chatApi.getConversation(id)
        if (get().sessionVersion !== sessionVersion) return
        set({ activeId: id, messages: detail.messages, streamingAnswer: "", error: null })
    },

    startNewConversation: async () => {
        const sessionVersion = get().sessionVersion
        const conversation = await chatApi.createConversation()
        if (get().sessionVersion !== sessionVersion) return conversation.id
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
        if (get().isStreaming) return
        const sessionVersion = get().sessionVersion
        set({ isStreaming: true, streamingAnswer: "", error: null })
        let conversationId = get().activeId
        try {
            conversationId ??= await get().startNewConversation()
            if (get().sessionVersion !== sessionVersion) return
            // 보낸 메시지를 먼저 보여준다. 연속 클릭은 대화 생성 전부터 막는다.
            const pending: Message = { id: `pending-${Date.now()}`, role: "user", content, created_at: new Date().toISOString() }
            set((state) => ({ messages: [...state.messages, pending] }))
            await chatApi.streamMessage(conversationId, content, (token) => {
                if (get().sessionVersion === sessionVersion && get().activeId === conversationId)
                    set((state) => ({ streamingAnswer: state.streamingAnswer + token }))
            })
            // 서버가 저장한 내용으로 맞춰 임시 메시지를 대체한다.
            const messages = await chatApi.listMessages(conversationId)
            if (get().sessionVersion !== sessionVersion) return
            if (get().activeId === conversationId) set({ messages, streamingAnswer: "" })
            set({ isStreaming: false })
            await get().loadConversations()
        } catch (caught) {
            if (get().sessionVersion !== sessionVersion) return
            set({
                isStreaming: false,
                ...(get().activeId === conversationId ? { error: caught instanceof Error ? caught.message : "응답을 받지 못했습니다." } : {}),
            })
        }
    },
}))
