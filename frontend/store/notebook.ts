import { create } from "zustand"

import { errorMessage, notebookApi, type Notebook, type NotebookTopic, type NotebookTopicInput, type NotebookTopicSummary } from "@/api"

/** 주제 입력칸. 태그는 쉼표로 구분한 문자열, 난이도는 ""(없음) 또는 "1"~"5"다. */
export type TopicForm = {
    title: string
    kind: string
    tags: string
    difficulty: string
    content: string
}

/** 왼쪽 목록의 주제 필터: 전체 / 공부할 것(미완료) / 끝낸 것(완료) */
export type NotebookFilter = "all" | "todo" | "done"

/** 서버 NotebookUpload.content 상한. 넘기면 영어 422가 오므로 여기서 먼저 거른다. */
export const MAX_UPLOAD_CHARS = 500_000
const MAX_TAGS = 20
const MAX_TAG_LENGTH = 50

export function emptyForm(): TopicForm {
    return { title: "", kind: "", tags: "", difficulty: "", content: "" }
}

function formOf(topic: NotebookTopic): TopicForm {
    return {
        title: topic.title,
        kind: topic.kind ?? "",
        tags: topic.tags.join(", "),
        difficulty: topic.difficulty ? String(topic.difficulty) : "",
        content: topic.content,
    }
}

function inputOf(form: TopicForm): NotebookTopicInput {
    return {
        title: form.title.trim(),
        content: form.content,
        kind: form.kind.trim() || null,
        tags: form.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        difficulty: form.difficulty ? Number(form.difficulty) : null,
    }
}

/** 서버의 422는 영어 메시지라 자주 틀리는 입력은 한국어로 먼저 알린다. */
function validate(input: NotebookTopicInput): string | null {
    const tags = input.tags ?? []
    if (!input.title) return "제목을 입력해 주세요."
    if (tags.length > MAX_TAGS) return `태그는 ${MAX_TAGS}개까지 넣을 수 있습니다.`
    if (tags.some((tag) => tag.length > MAX_TAG_LENGTH)) return `태그 하나는 ${MAX_TAG_LENGTH}자 이하로 적어 주세요.`
    return null
}

/** 목록에는 본문 없이 요약만 둔다. */
function summaryOf(topic: NotebookTopic): NotebookTopicSummary {
    const { id, notebook_id, position, title, kind, tags, difficulty, completed, updated_at } = topic
    return { id, notebook_id, position, title, kind, tags, difficulty, completed, updated_at }
}

function replaceTopic(notebooks: Notebook[], topic: NotebookTopic): Notebook[] {
    return notebooks.map((notebook) =>
        notebook.id === topic.notebook_id ? { ...notebook, topics: notebook.topics.map((old) => (old.id === topic.id ? summaryOf(topic) : old)) } : notebook
    )
}

type NotebookData = {
    notebooks: Notebook[]
    selectedTopicId: string | null
    /** 고른 주제의 상세(본문 포함). 불러오는 중이면 null */
    topic: NotebookTopic | null
    /** 새 주제를 쓰는 중인 학습장 id */
    creatingIn: string | null
    /** 고른 주제를 수정하는 중인지 */
    editing: boolean
    form: TopicForm
    filter: NotebookFilter
    isLoading: boolean
    isUploading: boolean
    isSaving: boolean
    isDeleting: boolean
    error: string | null
    notice: string | null
}

type NotebookState = NotebookData & {
    /** 로그아웃·계정 전환 뒤 늦게 온 응답을 버리기 위한 세대 번호 */
    sessionVersion: number
    /** 목록을 다시 읽는 동안 먼저 보낸 요청의 응답을 버린다. */
    loadVersion: number
    /** 다른 주제를 고르면 이전 주제의 늦은 응답을 버린다. */
    topicVersion: number
    reset: () => void
    load: () => Promise<void>
    /** md 파일 내용을 올려 학습장을 만든다. 성공하면 목록을 다시 읽고 첫 주제를 연다. */
    upload: (filename: string, content: string) => Promise<void>
    /** 성공하면 true(입력 폼을 닫는 데 쓴다) */
    createNotebook: (title: string) => Promise<boolean>
    renameNotebook: (id: string, title: string) => Promise<boolean>
    deleteNotebook: (id: string) => Promise<void>
    /** null이면 선택을 풀고(좁은 화면에서는 목록으로) 수정·새 주제 상태도 버린다. */
    selectTopic: (id: string | null) => Promise<void>
    startNewTopic: (notebookId: string) => void
    startEditing: () => void
    cancelEditing: () => void
    setForm: (form: TopicForm) => void
    /** 새 주제면 생성, 수정 중이면 PATCH. 왼쪽 목록의 요약도 함께 갱신한다. */
    saveTopic: () => Promise<void>
    /** 고른 주제의 학습 완료를 켜고 끈다. */
    toggleCompleted: () => Promise<void>
    deleteTopic: (id: string) => Promise<void>
    setFilter: (filter: NotebookFilter) => void
}

const emptyState = (): NotebookData => ({
    notebooks: [],
    selectedTopicId: null,
    topic: null,
    creatingIn: null,
    editing: false,
    form: emptyForm(),
    filter: "all",
    isLoading: false,
    isUploading: false,
    isSaving: false,
    isDeleting: false,
    error: null,
    notice: null,
})

/** 선택을 풀 때 함께 비우는 상태. topicVersion을 올려 늦게 오는 주제 응답을 버린다. */
const clearSelection = (state: NotebookState) => ({
    selectedTopicId: null,
    topic: null,
    editing: false,
    form: emptyForm(),
    topicVersion: state.topicVersion + 1,
})

export const useNotebookStore = create<NotebookState>((set, get) => ({
    ...emptyState(),
    sessionVersion: 0,
    loadVersion: 0,
    topicVersion: 0,

    reset: () =>
        set((state) => ({
            ...emptyState(),
            sessionVersion: state.sessionVersion + 1,
            loadVersion: state.loadVersion + 1,
            topicVersion: state.topicVersion + 1,
        })),

    load: async () => {
        const sessionVersion = get().sessionVersion
        const loadVersion = get().loadVersion + 1
        set({ isLoading: true, loadVersion, error: null })
        try {
            const notebooks = await notebookApi.listNotebooks()
            if (get().sessionVersion !== sessionVersion || get().loadVersion !== loadVersion) return
            set((state) => {
                const patch: Partial<NotebookState> = { notebooks }
                // 고른 주제나 새 주제를 쓰던 학습장이 목록에서 사라졌으면(다른 창에서 지웠으면) 그 상태를 버린다.
                if (state.selectedTopicId !== null && !notebooks.some((notebook) => notebook.topics.some((topic) => topic.id === state.selectedTopicId))) {
                    Object.assign(patch, clearSelection(state))
                }
                if (state.creatingIn !== null && !notebooks.some((notebook) => notebook.id === state.creatingIn)) {
                    Object.assign(patch, { creatingIn: null, form: emptyForm() })
                }
                return patch
            })
        } catch (caught) {
            if (get().sessionVersion === sessionVersion && get().loadVersion === loadVersion)
                set({ error: errorMessage(caught, "학습장을 불러오지 못했습니다.") })
        } finally {
            if (get().sessionVersion === sessionVersion && get().loadVersion === loadVersion) set({ isLoading: false })
        }
    },

    upload: async (filename, content) => {
        const { sessionVersion, isUploading } = get()
        if (isUploading) return
        if (!content.trim()) {
            set({ error: "학습장에 저장할 내용이 없습니다.", notice: null })
            return
        }
        if (content.length > MAX_UPLOAD_CHARS) {
            set({ error: `파일이 너무 큽니다. ${MAX_UPLOAD_CHARS.toLocaleString("ko-KR")}자 이하의 md 파일만 올릴 수 있습니다.`, notice: null })
            return
        }
        set({ isUploading: true, error: null, notice: null })
        try {
            const notebook = await notebookApi.uploadNotebook(filename, content)
            if (get().sessionVersion !== sessionVersion) return
            await get().load()
            if (get().sessionVersion !== sessionVersion) return
            const first = notebook.topics[0]
            if (first) await get().selectTopic(first.id)
            if (get().sessionVersion !== sessionVersion) return
            set({ notice: `학습장을 올렸어요. 주제 ${notebook.topics.length}개` })
        } catch (caught) {
            if (get().sessionVersion === sessionVersion) set({ error: errorMessage(caught, "학습장을 올리지 못했습니다.") })
        } finally {
            if (get().sessionVersion === sessionVersion) set({ isUploading: false })
        }
    },

    createNotebook: async (title) => {
        const { sessionVersion, isSaving, isDeleting } = get()
        const trimmed = title.trim()
        if (!trimmed) {
            set({ error: "학습장 이름을 입력해 주세요." })
            return false
        }
        if (isSaving || isDeleting) return false
        set({ isSaving: true, error: null, notice: null })
        try {
            const notebook = await notebookApi.createNotebook(trimmed)
            if (get().sessionVersion !== sessionVersion) return false
            set((state) => ({ notebooks: [notebook, ...state.notebooks], notice: "학습장을 만들었어요." }))
            return true
        } catch (caught) {
            if (get().sessionVersion === sessionVersion) set({ error: errorMessage(caught, "학습장을 만들지 못했습니다.") })
            return false
        } finally {
            if (get().sessionVersion === sessionVersion) set({ isSaving: false })
        }
    },

    renameNotebook: async (id, title) => {
        const { sessionVersion, isSaving, isDeleting } = get()
        const trimmed = title.trim()
        if (!trimmed) {
            set({ error: "학습장 이름을 입력해 주세요." })
            return false
        }
        if (isSaving || isDeleting) return false
        set({ isSaving: true, error: null, notice: null })
        try {
            const notebook = await notebookApi.renameNotebook(id, trimmed)
            if (get().sessionVersion !== sessionVersion) return false
            set((state) => ({ notebooks: state.notebooks.map((old) => (old.id === id ? notebook : old)), notice: "학습장 이름을 바꿨어요." }))
            return true
        } catch (caught) {
            if (get().sessionVersion === sessionVersion) set({ error: errorMessage(caught, "학습장 이름을 바꾸지 못했습니다.") })
            return false
        } finally {
            if (get().sessionVersion === sessionVersion) set({ isSaving: false })
        }
    },

    deleteNotebook: async (id) => {
        const { sessionVersion, isDeleting } = get()
        if (isDeleting) return
        set({ isDeleting: true, error: null, notice: null })
        try {
            await notebookApi.deleteNotebook(id)
            if (get().sessionVersion !== sessionVersion) return
            set((state) => {
                const removed = state.notebooks.find((notebook) => notebook.id === id)
                const selectedInside = removed?.topics.some((topic) => topic.id === state.selectedTopicId) ?? false
                return {
                    notebooks: state.notebooks.filter((notebook) => notebook.id !== id),
                    notice: "학습장을 삭제했어요.",
                    // 지운 학습장의 주제를 보고 있었거나 거기에 새 주제를 쓰던 중이면 오른쪽 칸을 비운다.
                    ...(selectedInside ? clearSelection(state) : {}),
                    ...(state.creatingIn === id ? { creatingIn: null, form: emptyForm() } : {}),
                }
            })
        } catch (caught) {
            if (get().sessionVersion === sessionVersion) set({ error: errorMessage(caught, "학습장을 삭제하지 못했습니다.") })
        } finally {
            if (get().sessionVersion === sessionVersion) set({ isDeleting: false })
        }
    },

    selectTopic: async (id) => {
        const sessionVersion = get().sessionVersion
        const topicVersion = get().topicVersion + 1
        set({ selectedTopicId: id, topic: null, creatingIn: null, editing: false, form: emptyForm(), topicVersion, error: null, notice: null })
        if (id === null) return
        try {
            const topic = await notebookApi.getTopic(id)
            if (get().sessionVersion !== sessionVersion || get().topicVersion !== topicVersion) return
            set({ topic })
        } catch (caught) {
            if (get().sessionVersion === sessionVersion && get().topicVersion === topicVersion)
                set({ error: errorMessage(caught, "주제를 불러오지 못했습니다.") })
        }
    },

    startNewTopic: (notebookId) => set((state) => ({ ...clearSelection(state), creatingIn: notebookId, error: null, notice: null })),

    startEditing: () => {
        const { topic } = get()
        if (!topic) return
        set({ editing: true, creatingIn: null, form: formOf(topic), error: null, notice: null })
    },

    cancelEditing: () => set({ editing: false, creatingIn: null, form: emptyForm(), error: null }),

    setForm: (form) => set({ form }),

    saveTopic: async () => {
        const { sessionVersion, topicVersion, isSaving, isDeleting, form, creatingIn, editing, topic } = get()
        if (isSaving || isDeleting) return
        const editingId = !creatingIn && editing && topic ? topic.id : null
        if (!creatingIn && !editingId) return
        const input = inputOf(form)
        const problem = validate(input)
        if (problem) {
            set({ error: problem })
            return
        }
        set({ isSaving: true, error: null, notice: null })
        try {
            if (creatingIn) {
                const created = await notebookApi.createTopic(creatingIn, input)
                if (get().sessionVersion !== sessionVersion) return
                set((state) => ({
                    notebooks: state.notebooks.map((notebook) =>
                        notebook.id === created.notebook_id ? { ...notebook, topics: [...notebook.topics, summaryOf(created)] } : notebook
                    ),
                    // 기다리는 동안 다른 주제를 골랐다면 선택은 그대로 두고 목록만 갱신한다.
                    ...(state.topicVersion === topicVersion
                        ? {
                              selectedTopicId: created.id,
                              topic: created,
                              creatingIn: null,
                              editing: false,
                              form: emptyForm(),
                              topicVersion: state.topicVersion + 1,
                          }
                        : {}),
                    notice: "주제를 추가했어요.",
                }))
            } else if (editingId) {
                const updated = await notebookApi.updateTopic(editingId, input)
                if (get().sessionVersion !== sessionVersion) return
                set((state) => ({
                    notebooks: replaceTopic(state.notebooks, updated),
                    ...(state.topicVersion === topicVersion ? { topic: updated, editing: false, form: emptyForm() } : {}),
                    notice: "주제를 저장했어요.",
                }))
            }
        } catch (caught) {
            if (get().sessionVersion === sessionVersion) set({ error: errorMessage(caught, "주제를 저장하지 못했습니다.") })
        } finally {
            if (get().sessionVersion === sessionVersion) set({ isSaving: false })
        }
    },

    toggleCompleted: async () => {
        const { sessionVersion, topicVersion, topic, isSaving, isDeleting } = get()
        if (!topic || isSaving || isDeleting) return
        const completed = !topic.completed
        set({ isSaving: true, error: null, notice: null })
        try {
            const updated = await notebookApi.updateTopic(topic.id, { completed })
            if (get().sessionVersion !== sessionVersion) return
            set((state) => ({
                notebooks: replaceTopic(state.notebooks, updated),
                ...(state.topicVersion === topicVersion ? { topic: updated } : {}),
                notice: completed ? "학습 완료로 표시했어요." : "완료를 취소했어요.",
            }))
        } catch (caught) {
            if (get().sessionVersion === sessionVersion) set({ error: errorMessage(caught, "완료 상태를 저장하지 못했습니다.") })
        } finally {
            if (get().sessionVersion === sessionVersion) set({ isSaving: false })
        }
    },

    deleteTopic: async (id) => {
        const { sessionVersion, isDeleting } = get()
        if (isDeleting) return
        set({ isDeleting: true, error: null, notice: null })
        try {
            await notebookApi.deleteTopic(id)
            if (get().sessionVersion !== sessionVersion) return
            set((state) => ({
                notebooks: state.notebooks.map((notebook) => ({ ...notebook, topics: notebook.topics.filter((topic) => topic.id !== id) })),
                ...(state.selectedTopicId === id ? clearSelection(state) : {}),
                notice: "주제를 삭제했어요.",
            }))
        } catch (caught) {
            if (get().sessionVersion === sessionVersion) set({ error: errorMessage(caught, "주제를 삭제하지 못했습니다.") })
        } finally {
            if (get().sessionVersion === sessionVersion) set({ isDeleting: false })
        }
    },

    setFilter: (filter) => set({ filter }),
}))
