import { create } from "zustand"

/** 이 폭 이상이면 대화 목록을 화면 옆에 붙여 두고, 미만이면 서랍처럼 덮어 연다(Tailwind md). */
export const DESKTOP_QUERY = "(min-width: 768px)"

type LayoutState = {
    /** 넓은 화면: 대화 목록을 옆에 펼쳐 두는지(기본 펼침) */
    desktopSidebarOpen: boolean
    /** 모바일: 서랍이 열려 있는지(기본 닫힘) */
    mobileSidebarOpen: boolean
    /** 지금 화면 폭에 맞는 쪽을 열고 닫는다. */
    toggleSidebar: () => void
    setMobileSidebarOpen: (open: boolean) => void
}

export const useLayoutStore = create<LayoutState>((set) => ({
    desktopSidebarOpen: true,
    mobileSidebarOpen: false,

    toggleSidebar: () => {
        if (window.matchMedia(DESKTOP_QUERY).matches) {
            set((state) => ({ desktopSidebarOpen: !state.desktopSidebarOpen }))
        } else {
            set((state) => ({ mobileSidebarOpen: !state.mobileSidebarOpen }))
        }
    },

    setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
}))
