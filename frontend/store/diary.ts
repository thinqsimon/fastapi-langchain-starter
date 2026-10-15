import { create } from "zustand"

import { chatApi, diaryApi, errorMessage, type DiaryDraft, type DiaryEntry } from "@/api"

const EMPTY_DRAFT: DiaryDraft = { learned: "", difficult: "", next_plan: "" }

type DiaryState = {
    entries: DiaryEntry[]
    draft: DiaryDraft
    /** 수정 중인 일기 id. null이면 새로 쓰는 중 */
    editingId: string | null
    isSaving: boolean
    isDrafting: boolean
    error: string | null

    loadEntries: () => Promise<void>
    setDraft: (draft: DiaryDraft) => void
    startEditing: (entry: DiaryEntry) => void
    cancelEditing: () => void
    /** 가장 최근 코칭 대화를 읽어 초안을 채운다. */
    fillFromLatestConversation: () => Promise<void>
    save: () => Promise<void>
    remove: (id: string) => Promise<void>
}

export const useDiaryStore = create<DiaryState>((set, get) => ({
    entries: [],
    draft: EMPTY_DRAFT,
    editingId: null,
    isSaving: false,
    isDrafting: false,
    error: null,

    loadEntries: async () => {
        set({ entries: await diaryApi.listEntries() })
    },

    setDraft: (draft) => set({ draft }),

    startEditing: (entry) =>
        set({
            editingId: entry.id,
            draft: {
                learned: entry.learned,
                difficult: entry.difficult,
                next_plan: entry.next_plan,
            },
            error: null,
        }),

    cancelEditing: () => set({ editingId: null, draft: EMPTY_DRAFT, error: null }),

    fillFromLatestConversation: async () => {
        set({ isDrafting: true, error: null })
        try {
            const conversations = await chatApi.listConversations()
            if (conversations.length === 0) {
                set({ error: "먼저 채팅에서 오늘 배운 것을 이야기해 보세요." })
                return
            }
            set({ draft: await diaryApi.draftFromConversation(conversations[0].id) })
        } catch (caught) {
            set({ error: errorMessage(caught, "초안을 만들지 못했습니다.") })
        } finally {
            set({ isDrafting: false })
        }
    },

    save: async () => {
        const { editingId, draft } = get()
        set({ isSaving: true, error: null })
        try {
            if (editingId) {
                await diaryApi.updateEntry(editingId, draft)
            } else {
                await diaryApi.createEntry(draft)
            }
            // 목록을 먼저 새로 읽고 나서 입력칸을 비운다.
            // 순서를 바꾸면 비우는 처리가 뒤늦게 도착해 사용자가 이어서 쓰던 내용을 지울 수 있다.
            await get().loadEntries()
            set({ draft: EMPTY_DRAFT, editingId: null })
        } catch (caught) {
            set({ error: errorMessage(caught, "저장하지 못했습니다.") })
        } finally {
            set({ isSaving: false })
        }
    },

    remove: async (id) => {
        await diaryApi.deleteEntry(id)
        await get().loadEntries()
    },
}))
