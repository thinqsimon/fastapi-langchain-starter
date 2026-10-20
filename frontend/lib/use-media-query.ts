import { useSyncExternalStore } from "react"

/** 미디어 쿼리 일치 여부를 따라간다. 서버 렌더링 때는 false(넓은 화면 기준 기본값은 호출하는 쪽이 정한다). */
export function useMediaQuery(query: string): boolean {
    return useSyncExternalStore(
        (onChange) => {
            const media = window.matchMedia(query)
            media.addEventListener("change", onChange)
            return () => media.removeEventListener("change", onChange)
        },
        () => window.matchMedia(query).matches,
        () => false
    )
}
