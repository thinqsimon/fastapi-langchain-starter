/** 두 칸 화면에서 왼쪽 목록 너비(px)의 기본값·범위와 키보드 한 번에 움직이는 양. */
export type PaneWidthLimits = { readonly default: number; readonly min: number; readonly max: number; readonly step: number }

export function clampPaneWidth(width: number, limits: PaneWidthLimits) {
    return Math.min(limits.max, Math.max(limits.min, Math.round(width)))
}

/** localStorage는 시크릿 창·차단 설정에서 실패할 수 있으므로 읽고 쓰기 모두 감싼다. */
export function readPaneWidth(key: string, limits: PaneWidthLimits): number | null {
    try {
        const raw = localStorage.getItem(key)
        const width = raw === null ? Number.NaN : Number(raw)
        return Number.isFinite(width) ? clampPaneWidth(width, limits) : null
    } catch {
        return null
    }
}

/** null이면 기억한 너비를 지운다(기본 너비로 돌아감). */
export function writePaneWidth(key: string, width: number | null) {
    try {
        if (width === null) localStorage.removeItem(key)
        else localStorage.setItem(key, String(width))
    } catch {
        // 저장하지 못해도 이번 화면에서는 동작한다.
    }
}
