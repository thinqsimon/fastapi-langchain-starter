import { create } from "zustand"

import { chatApi, errorMessage, type Conversation, type Message } from "@/lib/api"

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
    /** 목록에 바로 보여 주고 저장한다. 비우거나 그대로면 저장하지 않는다. */
    renameConversation: (id: string, title: string) => Promise<void>
    removeConversation: (id: string) => Promise<void>
    /** answerLevel: 이번 질문에만 쓸 답변 수준(CHAT-04, 다른 수준으로 다시 묻기). 설정은 바뀌지 않는다. */
    sendMessage: (content: string, options?: { answerLevel?: number }) => Promise<void>
}

/** 준비 중인 '새 대화'. 연달아 눌러도 이 준비를 함께 기다려 대화가 하나만 생긴다. */
let preparing: { sessionVersion: number; promise: Promise<string> } | null = null

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

    startNewConversation: () => {
        const sessionVersion = get().sessionVersion
        if (preparing?.sessionVersion === sessionVersion) return preparing.promise

        const prepare = async () => {
            const { activeId, messages, conversations } = get()
            // 보고 있는 대화가 아직 비어 있으면 그 대화를 그대로 쓴다.
            if (activeId && messages.length === 0) {
                set({ error: null })
                return activeId
            }
            // 맨 위(가장 최근) 대화가 비어 있으면 새로 만들지 않고 그 대화를 연다.
            // 확인하지 못하면(다른 기기에서 지운 대화 등) 새로 만든다.
            const latest = conversations[0]
            if (latest && latest.id !== activeId) {
                const isEmpty = await chatApi.getConversation(latest.id).then(
                    (detail) => detail.messages.length === 0,
                    () => false
                )
                if (isEmpty) {
                    if (get().sessionVersion === sessionVersion) set({ activeId: latest.id, messages: [], streamingAnswer: "", error: null })
                    return latest.id
                }
            }
            const conversation = await chatApi.createConversation()
            if (get().sessionVersion === sessionVersion)
                set((state) => ({
                    conversations: [conversation, ...state.conversations],
                    activeId: conversation.id,
                    messages: [],
                    streamingAnswer: "",
                    error: null,
                }))
            return conversation.id
        }

        const promise = prepare().finally(() => {
            if (preparing?.promise === promise) preparing = null
        })
        preparing = { sessionVersion, promise }
        return promise
    },

    renameConversation: async (id, title) => {
        const trimmed = title.trim()
        const before = get().conversations.find((item) => item.id === id)
        if (!before || !trimmed || trimmed === before.title) return
        const sessionVersion = get().sessionVersion
        const show = (value: string) =>
            set((state) => ({ conversations: state.conversations.map((item) => (item.id === id ? { ...item, title: value } : item)) }))
        show(trimmed)
        try {
            const saved = await chatApi.renameConversation(id, trimmed)
            // 기다리는 동안 목록을 다시 읽어 예전 제목이 왔을 수 있으니 저장된 제목으로 한 번 더 맞춘다.
            if (get().sessionVersion === sessionVersion) show(saved.title)
        } catch (caught) {
            if (get().sessionVersion !== sessionVersion) return
            show(before.title)
            set({ error: errorMessage(caught, "대화 제목을 바꾸지 못했습니다.") })
        }
    },

    removeConversation: async (id) => {
        await chatApi.deleteConversation(id)
        set((state) => ({
            conversations: state.conversations.filter((item) => item.id !== id),
            ...(state.activeId === id ? { activeId: null, messages: [] } : {}),
        }))
    },

    sendMessage: async (content, options) => {
        if (get().isStreaming) return
        const sessionVersion = get().sessionVersion
        set({ isStreaming: true, streamingAnswer: "", error: null })
        let conversationId = get().activeId
        try {
            // '새 대화'를 누르고 준비가 끝나기 전에 보낸 메시지는 그 새 대화로 보낸다.
            if (preparing?.sessionVersion === sessionVersion) conversationId = await preparing.promise
            conversationId ??= await get().startNewConversation()
            if (get().sessionVersion !== sessionVersion) return
            // 보낸 메시지를 먼저 보여준다. 연속 클릭은 대화 생성 전부터 막는다.
            const pending: Message = {
                id: `pending-${Date.now()}`,
                role: "user",
                content,
                created_at: new Date().toISOString(),
                provider: null,
                model: null,
                answer_level: null,
                suggested_questions: [],
            }
            set((state) => ({ messages: [...state.messages, pending] }))
            await chatApi.streamMessage(
                conversationId,
                content,
                (token) => {
                    if (get().sessionVersion === sessionVersion && get().activeId === conversationId)
                        set((state) => ({ streamingAnswer: state.streamingAnswer + token }))
                },
                { answerLevel: options?.answerLevel }
            )
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
