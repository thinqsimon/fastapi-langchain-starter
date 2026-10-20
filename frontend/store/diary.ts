import { create } from "zustand"

import { diaryApi, errorMessage, type DiaryDraft, type DiaryEntry, type DiaryForm, type EligibleConversation } from "@/api"
import { localToday } from "@/lib/date"

/** 새로 쓸 때의 빈 입력칸. 제목은 오늘 날짜로 시작한다(같은 날 두 번째부터는 서버가 (2)를 붙인다). */
function emptyForm(): DiaryForm {
    return { title: localToday(), learned: "", learned_detail: "", difficult: "", next_plan: "" }
}

/** 채팅으로 만든 초안의 출처. 저장할 때 함께 보내야 서버가 재발행 조건을 확인할 수 있다. */
type DraftSource = {
    origin: Pick<DiaryDraft, "conversation_id" | "source_last_message_at" | "entry_date">
    conversationTitle: string
}

type DiaryState = {
    entries: DiaryEntry[]
    /** 일기로 만들 수 있는 채팅(이미 쓴 채팅은 새 대화가 있을 때만) */
    conversations: EligibleConversation[]
    selectedConversationId: string
    form: DiaryForm
    source: DraftSource | null
    /** 수정 중인 일기 id. null이면 새로 쓰는 중 */
    editingId: string | null
    isSaving: boolean
    isDrafting: boolean
    error: string | null

    /** 지난 일기와 고를 수 있는 채팅을 함께 새로 읽는다. */
    load: () => Promise<void>
    selectConversation: (id: string) => void
    /** 고른 채팅으로 초안을 만든다. */
    generateDraft: () => Promise<void>
    /** 초안을 버리고 빈 입력칸으로 돌아간다. */
    discardDraft: () => void
    setForm: (form: DiaryForm) => void
    startEditing: (entry: DiaryEntry) => void
    cancelEditing: () => void
    save: () => Promise<void>
    remove: (id: string) => Promise<void>
}

export const useDiaryStore = create<DiaryState>((set, get) => ({
    entries: [],
    conversations: [],
    selectedConversationId: "",
    form: emptyForm(),
    source: null,
    editingId: null,
    isSaving: false,
    isDrafting: false,
    error: null,

    load: async () => {
        try {
            const [entries, conversations] = await Promise.all([diaryApi.listEntries(), diaryApi.listEligibleConversations()])
            const selected = get().selectedConversationId
            set({
                entries,
                conversations,
                // 고른 채팅이 목록에서 빠졌으면(일기를 썼으면) 가장 최근 채팅을 고른다.
                selectedConversationId: conversations.some((c) => c.id === selected) ? selected : (conversations[0]?.id ?? ""),
            })
        } catch (caught) {
            set({ error: errorMessage(caught, "일기를 불러오지 못했습니다.") })
        }
    },

    selectConversation: (id) => set({ selectedConversationId: id }),

    generateDraft: async () => {
        const { selectedConversationId, conversations } = get()
        if (!selectedConversationId) {
            set({ error: "일기로 만들 채팅을 고르세요." })
            return
        }
        set({ isDrafting: true, error: null })
        try {
            const draft = await diaryApi.draftFromConversation(selectedConversationId, localToday())
            const { conversation_id, source_last_message_at, entry_date, ...form } = draft
            const conversationTitle = conversations.find((c) => c.id === conversation_id)?.title ?? ""
            set({ form, source: { origin: { conversation_id, source_last_message_at, entry_date }, conversationTitle }, editingId: null })
        } catch (caught) {
            set({ error: errorMessage(caught, "초안을 만들지 못했습니다.") })
        } finally {
            set({ isDrafting: false })
        }
    },

    discardDraft: () => set({ form: emptyForm(), source: null, error: null }),

    setForm: (form) => set({ form }),

    startEditing: (entry) =>
        set({
            editingId: entry.id,
            source: null,
            form: {
                title: entry.title,
                learned: entry.learned,
                learned_detail: entry.learned_detail,
                difficult: entry.difficult,
                next_plan: entry.next_plan ?? "",
            },
            error: null,
        }),

    cancelEditing: () => set({ editingId: null, form: emptyForm(), error: null }),

    save: async () => {
        const { editingId, form, source } = get()
        set({ isSaving: true, error: null })
        try {
            if (editingId) {
                await diaryApi.updateEntry(editingId, form)
            } else if (source) {
                await diaryApi.createEntry({ ...form, ...source.origin })
            } else {
                await diaryApi.createEntry({ ...form, entry_date: localToday() })
            }
            // 목록을 먼저 새로 읽고 나서 입력칸을 비운다.
            // 순서를 바꾸면 비우는 처리가 뒤늦게 도착해 사용자가 이어서 쓰던 내용을 지울 수 있다.
            await get().load()
            set({ form: emptyForm(), source: null, editingId: null })
        } catch (caught) {
            set({ error: errorMessage(caught, "저장하지 못했습니다.") })
        } finally {
            set({ isSaving: false })
        }
    },

    remove: async (id) => {
        try {
            await diaryApi.deleteEntry(id)
            // 지운 일기의 채팅은 다시 고를 수 있게 되므로 채팅 목록도 함께 새로 읽는다.
            await get().load()
        } catch (caught) {
            set({ error: errorMessage(caught, "삭제하지 못했습니다.") })
        }
    },
}))
