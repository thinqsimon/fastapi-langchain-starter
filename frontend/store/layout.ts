import { create } from "zustand"

import { clampPaneWidth, readPaneWidth, writePaneWidth } from "@/lib/pane-width"

/** 이 폭 이상이면 대화 목록을 화면 옆에 붙여 두고, 미만이면 서랍처럼 덮어 연다(Tailwind md). */
export const DESKTOP_QUERY = "(min-width: 768px)"

/** 넓은 화면에서 대화 목록 너비(px). 브라우저마다 따로 기억한다. */
export const CHAT_LIST_WIDTH = { default: 256, min: 200, max: 480, step: 16 } as const
const CHAT_LIST_WIDTH_KEY = "chat_list_width"

type LayoutState = {
    /** 넓은 화면: 대화 목록을 옆에 펼쳐 두는지(기본 펼침) */
    desktopSidebarOpen: boolean
    /** 모바일: 서랍이 열려 있는지(기본 닫힘) */
    mobileSidebarOpen: boolean
    /** 넓은 화면: 대화 목록 너비(px). 계정이 바뀌어도 유지한다. */
    listWidth: number
    /** 지금 화면 폭에 맞는 쪽을 열고 닫는다. */
    toggleSidebar: () => void
    setMobileSidebarOpen: (open: boolean) => void
    /** 브라우저에 기억한 목록 너비를 불러온다(서버 렌더와 맞추려고 화면이 뜬 뒤에 부른다). */
    restoreListWidth: () => void
    setListWidth: (width: number) => void
    resetListWidth: () => void
}

export const useLayoutStore = create<LayoutState>((set, get) => ({
    desktopSidebarOpen: true,
    mobileSidebarOpen: false,
    listWidth: CHAT_LIST_WIDTH.default,

    toggleSidebar: () => {
        if (window.matchMedia(DESKTOP_QUERY).matches) {
            set((state) => ({ desktopSidebarOpen: !state.desktopSidebarOpen }))
        } else {
            set((state) => ({ mobileSidebarOpen: !state.mobileSidebarOpen }))
        }
    },

    setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),

    restoreListWidth: () => {
        const width = readPaneWidth(CHAT_LIST_WIDTH_KEY, CHAT_LIST_WIDTH)
        if (width !== null && width !== get().listWidth) set({ listWidth: width })
    },

    setListWidth: (width) => {
        const next = clampPaneWidth(width, CHAT_LIST_WIDTH)
        if (next !== get().listWidth) set({ listWidth: next })
        writePaneWidth(CHAT_LIST_WIDTH_KEY, next)
    },

    resetListWidth: () => {
        set({ listWidth: CHAT_LIST_WIDTH.default })
        writePaneWidth(CHAT_LIST_WIDTH_KEY, null)
    },
}))
