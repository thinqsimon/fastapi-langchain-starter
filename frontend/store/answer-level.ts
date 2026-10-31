import { create } from "zustand"

import { answerLevelApi, errorMessage, type AnswerLevelInfo } from "@/lib/api"

type AnswerLevelState = {
    levels: AnswerLevelInfo[]
    isLoaded: boolean
    error: string | null
    /** 한 번만 불러온다(force면 다시). 이름은 서버 전체에 하나라 계정이 바뀌어도 같다. */
    load: (force?: boolean) => Promise<void>
    /** 관리자: 이름 변경. 실패하면 예외를 던져 폼이 메시지를 보여주게 한다. */
    rename: (level: number, name: string) => Promise<AnswerLevelInfo>
    resetName: (level: number) => Promise<AnswerLevelInfo>
}

export const useAnswerLevelStore = create<AnswerLevelState>((set, get) => ({
    levels: [],
    isLoaded: false,
    error: null,

    load: async (force = false) => {
        if (get().isLoaded && !force) return
        try {
            set({ levels: await answerLevelApi.fetchAnswerLevels(), isLoaded: true, error: null })
        } catch (caught) {
            set({ error: errorMessage(caught, "답변 수준 목록을 불러오지 못했습니다.") })
        }
    },

    rename: async (level, name) => {
        const updated = await answerLevelApi.renameAnswerLevel(level, name)
        set((state) => ({ levels: state.levels.map((item) => (item.level === level ? updated : item)) }))
        return updated
    },

    resetName: async (level) => {
        const updated = await answerLevelApi.resetAnswerLevelName(level)
        set((state) => ({ levels: state.levels.map((item) => (item.level === level ? updated : item)) }))
        return updated
    },
}))
