import { create } from "zustand"

import { errorMessage, notebookApi, type Notebook, type NotebookTopic, type NotebookTopicInput, type NotebookTopicSummary } from "@/lib/api"

/** 주제 입력칸. 태그는 쉼표로 구분한 문자열, 난이도는 ""(없음) 또는 "1"~"5"다. */
export type TopicForm = {
    title: string
    kind: string
    tags: string
    difficulty: string
    content: string
}

/** 왼쪽 목록의 상태 필터: 전체 / 공부할 것(미완료) / 끝낸 것(완료).
 *  화면에는 공부할 것·끝낸 것 두 칩만 있고, 눌린 칩을 다시 누르면 "all"(모두)로 돌아간다. */
export type NotebookFilter = "all" | "todo" | "done"
/** 왼쪽 목록의 보기: 전체 / 보관함(보관한 주제만). 상태 필터와 독립된 축이다. */
/** 보기: 신규(아직 보관하지 않은 주제) / 전체 / 보관함(보관한 주제) */
export type NotebookView = "new" | "all" | "kept"

/** 서버 NotebookUpload.content 상한. 넘기면 영어 422가 오므로 여기서 먼저 거른다. */
export const MAX_UPLOAD_CHARS = 500_000
/** 넓은 화면(md 이상)에서 왼쪽 목록의 너비(px). 브라우저마다 따로 기억한다. */
export const LIST_WIDTH = { default: 320, min: 220, max: 640, step: 16 } as const
const LIST_WIDTH_KEY = "notebook_list_width"
/** 마지막에 보던 보기(전체/보관함)도 브라우저에 기억한다. */
const VIEW_KEY = "notebook_view"

function clampListWidth(width: number) {
    return Math.min(LIST_WIDTH.max, Math.max(LIST_WIDTH.min, Math.round(width)))
}

/** localStorage는 시크릿 창·차단 설정에서 실패할 수 있으므로 읽고 쓰기 모두 감싼다. */
function readStoredListWidth(): number | null {
    try {
        const raw = localStorage.getItem(LIST_WIDTH_KEY)
        const width = raw === null ? Number.NaN : Number(raw)
        return Number.isFinite(width) ? clampListWidth(width) : null
    } catch {
        return null
    }
}

function writeStoredListWidth(width: number | null) {
    try {
        if (width === null) localStorage.removeItem(LIST_WIDTH_KEY)
        else localStorage.setItem(LIST_WIDTH_KEY, String(width))
    } catch {
        // 저장하지 못해도 이번 화면에서는 동작한다.
    }
}

function readStoredView(): NotebookView | null {
    try {
        const raw = localStorage.getItem(VIEW_KEY)
        return raw === "new" || raw === "all" || raw === "kept" ? raw : null
    } catch {
        return null
    }
}

function writeStoredView(view: NotebookView) {
    try {
        localStorage.setItem(VIEW_KEY, view)
    } catch {
        // 저장하지 못해도 이번 화면에서는 동작한다.
    }
}
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

/** 보기(전체/보관함)와 상태 칩을 함께 적용해 목록에 보일 주제만 고른다. 보관함 보기에서는 보관한 주제만 남긴다. */
export function visibleTopics(topics: NotebookTopicSummary[], view: NotebookView, filter: NotebookFilter): NotebookTopicSummary[] {
    // 신규 = 보관 안 함, 보관함 = 보관함. 전체는 둘 다.
    return topics.filter((topic) => (view === "all" || (view === "kept") === topic.kept) && (filter === "all" || (filter === "done") === topic.completed))
}

/** 목록에는 본문 없이 요약만 둔다. */
function summaryOf(topic: NotebookTopic): NotebookTopicSummary {
    const { id, notebook_id, position, title, kind, tags, difficulty, completed, kept, kept_at, updated_at } = topic
    return { id, notebook_id, position, title, kind, tags, difficulty, completed, kept, kept_at, updated_at }
}

/** 목록의 주제 요약을 같은 id의 새 요약으로 바꾼다(여러 학습장에 걸쳐도 된다). */
function mergeSummaries(notebooks: Notebook[], summaries: NotebookTopicSummary[]): Notebook[] {
    const byId = new Map<string, NotebookTopicSummary>(summaries.map((summary) => [summary.id, summary]))
    return notebooks.map((notebook) =>
        notebook.topics.some((topic) => byId.has(topic.id)) ? { ...notebook, topics: notebook.topics.map((old) => byId.get(old.id) ?? old) } : notebook
    )
}

function replaceTopic(notebooks: Notebook[], topic: NotebookTopic): Notebook[] {
    return mergeSummaries(notebooks, [summaryOf(topic)])
}

/** 목록에 남아 있는 주제만 선택에 남긴다(다른 창에서 지운 주제 등). 바뀐 게 없으면 같은 배열을 돌려준다. */
function pruneSelected(selectedIds: string[], notebooks: Notebook[]): string[] {
    if (selectedIds.length === 0) return selectedIds
    const existing = new Set(notebooks.flatMap((notebook) => notebook.topics.map((topic) => topic.id)))
    const remaining = selectedIds.filter((id) => existing.has(id))
    return remaining.length === selectedIds.length ? selectedIds : remaining
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
    /** '선택' 모드인지. 켜면 목록 줄이 체크박스가 되고 하단 막대가 나온다. */
    selecting: boolean
    /** 선택 모드에서 고른 주제 id(고른 순서). reset()·보기 전환·업로드 때 비운다. */
    selectedIds: string[]
    isLoading: boolean
    isUploading: boolean
    isSaving: boolean
    isDeleting: boolean
    error: string | null
    notice: string | null
}

type NotebookState = NotebookData & {
    /** 넓은 화면의 목록 너비(px). reset()에도 유지되는 브라우저 설정이다. */
    listWidth: number
    /** 목록 보기(전체/보관함). listWidth처럼 reset()에도 유지된다. */
    view: NotebookView
    /** 로그아웃·계정 전환 뒤 늦게 온 응답을 버리기 위한 세대 번호 */
    sessionVersion: number
    /** 목록을 다시 읽는 동안 먼저 보낸 요청의 응답을 버린다. */
    loadVersion: number
    /** 다른 주제를 고르면 이전 주제의 늦은 응답을 버린다. */
    topicVersion: number
    reset: () => void
    load: () => Promise<void>
    /** md 파일 내용을 올려 학습장을 만든다. 성공하면 전체 보기로 돌아와 목록을 다시 읽고 첫 주제를 연다. */
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
    /** 고른 주제의 보관(보관함)을 켜고 끈다. */
    toggleKept: () => Promise<void>
    deleteTopic: (id: string) => Promise<void>
    setFilter: (filter: NotebookFilter) => void
    /** 보기를 바꾸고 브라우저에 기억한다. 보이는 주제가 달라지므로 선택은 비운다. */
    setView: (view: NotebookView) => void
    startSelecting: () => void
    cancelSelecting: () => void
    toggleSelected: (id: string) => void
    /** 여러 주제를 한 번에 고르거나(on) 푼다(학습장의 '모두 선택'). */
    setSelected: (ids: string[], on: boolean) => void
    /** 고른 주제를 한 번에 보관(true)·보관 해제(false)하고 선택 모드를 끝낸다. 하나라도 실패하면 아무것도 바뀌지 않는다. */
    keepSelected: (kept: boolean) => Promise<void>
    /** 저장된 목록 너비와 보기를 불러온다(화면이 뜰 때 한 번). */
    restorePreferences: () => void
    /** 범위를 벗어나면 잘라서 저장한다. */
    setListWidth: (width: number) => void
    resetListWidth: () => void
}

const emptyState = (): NotebookData => ({
    notebooks: [],
    selectedTopicId: null,
    topic: null,
    creatingIn: null,
    editing: false,
    form: emptyForm(),
    filter: "all",
    selecting: false,
    selectedIds: [],
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

/** 목록과 본문이 따로 놀지 않게: 열린 주제가 바뀐 보기·상태 칩·보관/완료 상태로는 목록에 안 보이면 오른쪽도 비운다. */
const reconcileSelection = (state: NotebookState, patch: Partial<NotebookState> = {}): Partial<NotebookState> => {
    const next = { ...state, ...patch }
    if (next.selectedTopicId === null) return patch
    const summary = next.notebooks.flatMap((notebook) => notebook.topics).find((topic) => topic.id === next.selectedTopicId)
    const visible = summary !== undefined && visibleTopics([summary], next.view, next.filter).length === 1
    return visible ? patch : { ...patch, ...clearSelection(state) }
}

export const useNotebookStore = create<NotebookState>((set, get) => ({
    ...emptyState(),
    listWidth: LIST_WIDTH.default,
    view: "all",
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
                const patch: Partial<NotebookState> = { notebooks, selectedIds: pruneSelected(state.selectedIds, notebooks) }
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
        if (!/\.(md|markdown)$/i.test(filename)) {
            set({ error: "md 파일(.md, .markdown)만 올릴 수 있습니다.", notice: null })
            return
        }
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
            // 보관함 보기에서는 새 주제가 안 보이므로 신규 보기로 바꾼다. 신규·전체 보기는 그대로 둔다. 선택 모드는 끝낸다.
            if (get().view === "kept") get().setView("new")
            set({ selecting: false })
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
                const notebooks = state.notebooks.filter((notebook) => notebook.id !== id)
                return {
                    notebooks,
                    selectedIds: pruneSelected(state.selectedIds, notebooks),
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
            set((state) =>
                reconcileSelection(state, {
                    notebooks: replaceTopic(state.notebooks, updated),
                    ...(state.topicVersion === topicVersion ? { topic: updated } : {}),
                    notice: completed ? "학습 완료로 표시했어요." : "완료를 취소했어요.",
                })
            )
        } catch (caught) {
            if (get().sessionVersion === sessionVersion) set({ error: errorMessage(caught, "완료 상태를 저장하지 못했습니다.") })
        } finally {
            if (get().sessionVersion === sessionVersion) set({ isSaving: false })
        }
    },

    toggleKept: async () => {
        const { sessionVersion, topicVersion, topic, isSaving, isDeleting } = get()
        if (!topic || isSaving || isDeleting) return
        const kept = !topic.kept
        set({ isSaving: true, error: null, notice: null })
        try {
            const updated = await notebookApi.updateTopic(topic.id, { kept })
            if (get().sessionVersion !== sessionVersion) return
            set((state) =>
                reconcileSelection(state, {
                    notebooks: replaceTopic(state.notebooks, updated),
                    ...(state.topicVersion === topicVersion ? { topic: updated } : {}),
                    notice: kept ? "보관함에 넣었어요." : "보관함에서 뺐어요.",
                })
            )
        } catch (caught) {
            if (get().sessionVersion === sessionVersion) set({ error: errorMessage(caught, "보관 상태를 저장하지 못했습니다.") })
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
                selectedIds: state.selectedIds.filter((old) => old !== id),
                ...(state.selectedTopicId === id ? clearSelection(state) : {}),
                notice: "주제를 삭제했어요.",
            }))
        } catch (caught) {
            if (get().sessionVersion === sessionVersion) set({ error: errorMessage(caught, "주제를 삭제하지 못했습니다.") })
        } finally {
            if (get().sessionVersion === sessionVersion) set({ isDeleting: false })
        }
    },

    setFilter: (filter) => set((state) => reconcileSelection(state, { filter })),

    setView: (view) => {
        writeStoredView(view)
        set((state) => reconcileSelection(state, { view, selectedIds: [] }))
    },

    startSelecting: () => set({ selecting: true, selectedIds: [] }),

    cancelSelecting: () => set({ selecting: false, selectedIds: [] }),

    toggleSelected: (id) =>
        set((state) => ({
            selectedIds: state.selectedIds.includes(id) ? state.selectedIds.filter((old) => old !== id) : [...state.selectedIds, id],
        })),

    setSelected: (ids, on) =>
        set((state) => {
            if (!on) return { selectedIds: state.selectedIds.filter((id) => !ids.includes(id)) }
            const added = ids.filter((id) => !state.selectedIds.includes(id))
            return added.length === 0 ? {} : { selectedIds: [...state.selectedIds, ...added] }
        }),

    keepSelected: async (kept) => {
        const { sessionVersion, selectedIds, isSaving, isDeleting } = get()
        if (selectedIds.length === 0 || isSaving || isDeleting) return
        set({ isSaving: true, error: null, notice: null })
        try {
            const updated = await notebookApi.keepTopics(selectedIds, kept)
            if (get().sessionVersion !== sessionVersion) return
            set((state) => {
                // 열어 둔 주제가 포함돼 있으면 본문 쪽 보관 표시도 맞춘다.
                const open = state.topic && updated.find((summary) => summary.id === state.topic?.id)
                return reconcileSelection(state, {
                    notebooks: mergeSummaries(state.notebooks, updated),
                    ...(state.topic && open ? { topic: { ...state.topic, ...open } } : {}),
                    selecting: false,
                    selectedIds: [],
                    notice: kept ? `주제 ${updated.length}개를 보관했어요.` : `주제 ${updated.length}개의 보관을 해제했어요.`,
                })
            })
        } catch (caught) {
            if (get().sessionVersion === sessionVersion)
                set({ error: errorMessage(caught, kept ? "주제를 보관하지 못했습니다." : "보관을 해제하지 못했습니다.") })
        } finally {
            if (get().sessionVersion === sessionVersion) set({ isSaving: false })
        }
    },

    restorePreferences: () => {
        const width = readStoredListWidth()
        const view = readStoredView()
        const patch: Partial<NotebookState> = {}
        if (width !== null && width !== get().listWidth) patch.listWidth = width
        if (view !== null && view !== get().view) patch.view = view
        if (Object.keys(patch).length > 0) set(patch)
    },

    setListWidth: (width) => {
        const next = clampListWidth(width)
        if (next !== get().listWidth) set({ listWidth: next })
        writeStoredListWidth(next)
    },

    resetListWidth: () => {
        set({ listWidth: LIST_WIDTH.default })
        writeStoredListWidth(null)
    },
}))
