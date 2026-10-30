import { create } from "zustand"

import { diaryApi, errorMessage, type DiaryDraft, type DiaryEntry, type DiaryForm, type EligibleConversation } from "@/lib/api"
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
    hasUnsavedChanges: boolean
    /** 늦게 도착한 응답이 새 입력이나 다른 계정의 상태를 덮지 않도록 구분한다. */
    revision: number
    draftVersion: number
    sessionVersion: number

    /** 지난 일기와 고를 수 있는 채팅을 함께 새로 읽는다. */
    load: () => Promise<void>
    selectConversation: (id: string) => void
    /** 고른 채팅으로 초안을 만든다. */
    generateDraft: () => Promise<void>
    generateDraftFromConversation: (id: string, title: string, replaceExisting?: boolean) => Promise<boolean>
    reset: () => void
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
    hasUnsavedChanges: false,
    revision: 0,
    draftVersion: 0,
    sessionVersion: 0,

    reset: () =>
        set((state) => ({
            entries: [],
            conversations: [],
            selectedConversationId: "",
            form: emptyForm(),
            source: null,
            editingId: null,
            isSaving: false,
            isDrafting: false,
            error: null,
            hasUnsavedChanges: false,
            revision: state.revision + 1,
            draftVersion: state.draftVersion + 1,
            sessionVersion: state.sessionVersion + 1,
        })),

    load: async () => {
        const sessionVersion = get().sessionVersion
        try {
            const [entries, conversations] = await Promise.all([diaryApi.listEntries(), diaryApi.listEligibleConversations()])
            if (get().sessionVersion !== sessionVersion) return
            const selected = get().selectedConversationId
            set({
                entries,
                conversations,
                // 고른 채팅이 목록에서 빠졌으면(일기를 썼으면) 가장 최근 채팅을 고른다.
                selectedConversationId: conversations.some((c) => c.id === selected) ? selected : (conversations[0]?.id ?? ""),
            })
        } catch (caught) {
            if (get().sessionVersion === sessionVersion) set({ error: errorMessage(caught, "일기를 불러오지 못했습니다.") })
        }
    },

    selectConversation: (id) => set({ selectedConversationId: id }),

    generateDraft: async () => {
        const { selectedConversationId, conversations } = get()
        if (!selectedConversationId) {
            set({ error: "일기로 만들 채팅을 고르세요." })
            return
        }
        await get().generateDraftFromConversation(selectedConversationId, conversations.find((c) => c.id === selectedConversationId)?.title ?? "")
    },

    generateDraftFromConversation: async (id, title, replaceExisting = false) => {
        const { isDrafting, isSaving, hasUnsavedChanges, revision } = get()
        if (isDrafting || isSaving) return false
        if (hasUnsavedChanges && !replaceExisting) {
            set({ error: "저장하지 않은 일기가 있습니다. 먼저 확인해 주세요." })
            return false
        }
        const draftVersion = get().draftVersion + 1
        set({ isDrafting: true, error: null, draftVersion })
        try {
            const draft = await diaryApi.draftFromConversation(id, localToday())
            if (get().draftVersion !== draftVersion) return false
            if (get().revision !== revision) {
                set({ error: "작성 중인 일기를 보호하기 위해 초안을 적용하지 않았습니다. 일기를 저장한 뒤 다시 시도해 주세요." })
                return false
            }
            const { conversation_id, source_last_message_at, entry_date, ...form } = draft
            set({
                form,
                source: { origin: { conversation_id, source_last_message_at, entry_date }, conversationTitle: title },
                selectedConversationId: id,
                editingId: null,
                hasUnsavedChanges: true,
                revision: revision + 1,
            })
            return true
        } catch (caught) {
            if (get().draftVersion === draftVersion) set({ error: errorMessage(caught, "초안을 만들지 못했습니다.") })
            return false
        } finally {
            if (get().draftVersion === draftVersion) set({ isDrafting: false })
        }
    },

    discardDraft: () => set((state) => ({ form: emptyForm(), source: null, error: null, hasUnsavedChanges: false, revision: state.revision + 1 })),

    setForm: (form) => set((state) => ({ form, hasUnsavedChanges: true, revision: state.revision + 1 })),

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
            hasUnsavedChanges: false,
            revision: get().revision + 1,
        }),

    cancelEditing: () => set((state) => ({ editingId: null, form: emptyForm(), error: null, hasUnsavedChanges: false, revision: state.revision + 1 })),

    save: async () => {
        const { editingId, form, source, revision, sessionVersion, isSaving, isDrafting } = get()
        if (isSaving || isDrafting) return
        set({ isSaving: true, error: null })
        try {
            if (editingId) {
                await diaryApi.updateEntry(editingId, form)
            } else if (source) {
                await diaryApi.createEntry({ ...form, ...source.origin })
            } else {
                await diaryApi.createEntry({ ...form, entry_date: localToday() })
            }
            if (get().sessionVersion !== sessionVersion) return
            await get().load()
            if (get().sessionVersion === sessionVersion && get().revision === revision) {
                set({ form: emptyForm(), source: null, editingId: null, hasUnsavedChanges: false, revision: revision + 1 })
            }
        } catch (caught) {
            if (get().sessionVersion === sessionVersion) set({ error: errorMessage(caught, "저장하지 못했습니다.") })
        } finally {
            if (get().sessionVersion === sessionVersion) set({ isSaving: false })
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
