import { create } from "zustand"

import { errorMessage, learningApi, type SavedWeeklyReview, type StudyItem } from "@/lib/api"
import { localToday } from "@/lib/date"

export function weekStart(reference: string): string {
    if (!reference) return ""
    const date = new Date(`${reference}T12:00:00`)
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
    return localToday(date)
}

type LearningState = {
    reviews: SavedWeeklyReview[]
    items: StudyItem[]
    noteDrafts: Record<string, string>
    reference: string
    selectedReviewId: string | null
    completedFilter: boolean
    isLoading: boolean
    isGenerating: boolean
    isDeleting: boolean
    savingIds: string[]
    error: string | null
    notice: string | null
    sessionVersion: number
    loadVersion: number
    reset: () => void
    load: () => Promise<void>
    setReference: (reference: string) => void
    selectReview: (id: string) => void
    setCompletedFilter: (completed: boolean) => void
    setNote: (id: string, value: string) => void
    generateReview: () => Promise<void>
    deleteReview: (id: string) => Promise<void>
    saveStudy: (id: string, completed: boolean) => Promise<void>
}

const emptyState = () => ({
    reviews: [],
    items: [],
    noteDrafts: {},
    reference: localToday(),
    selectedReviewId: null,
    completedFilter: false,
    isLoading: false,
    isGenerating: false,
    isDeleting: false,
    savingIds: [],
    error: null,
    notice: null,
})

export const useLearningStore = create<LearningState>((set, get) => ({
    ...emptyState(),
    sessionVersion: 0,
    loadVersion: 0,
    reset: () => set((state) => ({ ...emptyState(), sessionVersion: state.sessionVersion + 1, loadVersion: state.loadVersion + 1 })),

    load: async () => {
        const sessionVersion = get().sessionVersion
        const loadVersion = get().loadVersion + 1
        set({ isLoading: true, loadVersion, error: null })
        try {
            const [reviews, items] = await Promise.all([learningApi.listReviews(), learningApi.listStudy()])
            if (get().sessionVersion !== sessionVersion || get().loadVersion !== loadVersion) return
            set((state) => ({
                reviews,
                items,
                noteDrafts: Object.fromEntries(items.map((item) => [item.entry_id, state.noteDrafts[item.entry_id] ?? item.note])),
                selectedReviewId: reviews.some((review) => review.id === state.selectedReviewId)
                    ? state.selectedReviewId
                    : (reviews.find((review) => review.week_start === weekStart(state.reference))?.id ?? null),
            }))
        } catch (caught) {
            if (get().sessionVersion === sessionVersion && get().loadVersion === loadVersion)
                set({ error: errorMessage(caught, "회고와 복습 내용을 불러오지 못했습니다.") })
        } finally {
            if (get().sessionVersion === sessionVersion && get().loadVersion === loadVersion) set({ isLoading: false })
        }
    },

    setReference: (reference) =>
        set((state) => ({ reference, selectedReviewId: state.reviews.find((review) => review.week_start === weekStart(reference))?.id ?? null, notice: null })),
    selectReview: (id) =>
        set((state) => ({
            selectedReviewId: id || null,
            reference: state.reviews.find((review) => review.id === id)?.week_start ?? state.reference,
            notice: null,
        })),
    setCompletedFilter: (completedFilter) => set({ completedFilter }),
    setNote: (id, value) => set((state) => ({ noteDrafts: { ...state.noteDrafts, [id]: value }, notice: null })),

    generateReview: async () => {
        const { reference, sessionVersion, isGenerating, isDeleting } = get()
        if (!reference || isGenerating || isDeleting) return
        const existing = get().reviews.find((review) => review.week_start === weekStart(reference))
        if (existing) {
            set({ selectedReviewId: existing.id, notice: "저장된 회고를 열었어요.", error: null })
            return
        }
        set({ isGenerating: true, error: null, notice: null })
        try {
            const review = await learningApi.createReview(reference)
            if (get().sessionVersion !== sessionVersion) return
            set((state) => ({
                reviews: [review, ...state.reviews.filter((item) => item.id !== review.id)].sort((a, b) => b.week_start.localeCompare(a.week_start)),
                selectedReviewId: review.id,
                notice: "회고를 저장했어요. 다음에 다시 열어볼 수 있어요.",
                loadVersion: state.loadVersion + 1,
                isLoading: false,
            }))
        } catch (caught) {
            if (get().sessionVersion === sessionVersion) set({ error: errorMessage(caught, "회고를 저장하지 못했습니다.") })
        } finally {
            if (get().sessionVersion === sessionVersion) set({ isGenerating: false })
        }
    },

    deleteReview: async (id) => {
        const { sessionVersion, isDeleting, isGenerating } = get()
        if (isDeleting || isGenerating) return
        set({ isDeleting: true, error: null, notice: null })
        try {
            await learningApi.deleteReview(id)
            if (get().sessionVersion !== sessionVersion) return
            set((state) => ({
                reviews: state.reviews.filter((review) => review.id !== id),
                selectedReviewId: state.selectedReviewId === id ? null : state.selectedReviewId,
                notice: "회고를 삭제했어요.",
                loadVersion: state.loadVersion + 1,
                isLoading: false,
            }))
        } catch (caught) {
            if (get().sessionVersion === sessionVersion) set({ error: errorMessage(caught, "회고를 삭제하지 못했습니다.") })
        } finally {
            if (get().sessionVersion === sessionVersion) set({ isDeleting: false })
        }
    },

    saveStudy: async (id, completed) => {
        const { sessionVersion, savingIds, noteDrafts, loadVersion } = get()
        if (savingIds.includes(id)) return
        const note = noteDrafts[id] ?? ""
        set({ savingIds: [...savingIds, id], error: null, notice: null })
        try {
            const item = await learningApi.saveStudy(id, completed, note)
            if (get().sessionVersion !== sessionVersion) return
            // 기다리는 동안 원본 일기/목록을 다시 읽었다면 예전 응답 대신 서버의 현재 상태를 쓴다.
            if (get().loadVersion !== loadVersion) {
                await get().load()
                if (get().sessionVersion === sessionVersion && get().items.some((current) => current.entry_id === id))
                    set({ notice: "최신 복습 내용을 확인했어요." })
                return
            }
            set((state) => ({
                items: state.items.map((old) => (old.entry_id === id ? item : old)),
                noteDrafts: { ...state.noteDrafts, [id]: item.note },
                notice: completed ? "복습을 완료했어요." : "복습 메모와 진행 상태를 저장했어요.",
                loadVersion: state.loadVersion + 1,
                isLoading: false,
            }))
        } catch (caught) {
            if (get().sessionVersion === sessionVersion) set({ error: errorMessage(caught, "복습 내용을 저장하지 못했습니다.") })
        } finally {
            if (get().sessionVersion === sessionVersion) set((state) => ({ savingIds: state.savingIds.filter((item) => item !== id) }))
        }
    },
}))
