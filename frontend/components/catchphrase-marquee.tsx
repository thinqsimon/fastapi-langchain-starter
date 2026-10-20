"use client"

import { cn } from "cn"
import { useEffect, useRef } from "react"

/** 흐르는 속도(px/초) */
const SPEED_PX_PER_SECOND = 60
/** 끝까지 흐른 뒤 비워 두는 시간 */
export const MARQUEE_PAUSE_MS = 10_000

type Motion = "static" | "scroll" | "reduced"

/**
 * 헤더 가운데의 캐치프레이즈.
 * - 공간에 다 들어가면 가운데에 멈춰 있다.
 * - 넘치면 전광판처럼 오른쪽 끝에서 들어와 왼쪽 끝으로 완전히 빠져나가고, 10초 동안 비워 둔 뒤 다시 흐른다.
 * - 동작 줄이기(prefers-reduced-motion) 설정이면 흐르지 않고 말줄임표로 자른다. 전체 문구는 title로 볼 수 있다.
 *
 * 크기가 바뀔 때 애니메이션만 다시 걸면 되므로 React 상태 없이 DOM과 Web Animations API로 다룬다.
 * 현재 모드는 data-motion 속성으로 드러낸다(E2E가 이 값으로 확인한다).
 */
export function CatchphraseMarquee({ text, className }: { text: string; className?: string }) {
    const viewportRef = useRef<HTMLDivElement>(null)
    const textRef = useRef<HTMLSpanElement>(null)

    useEffect(() => {
        const viewport = viewportRef.current
        const label = textRef.current
        if (!viewport || !label) return

        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
        let animation: Animation | null = null
        let applied = ""

        const update = () => {
            const available = viewport.clientWidth
            const needed = label.scrollWidth
            const motion: Motion = needed <= available ? "static" : reducedMotion.matches ? "reduced" : "scroll"

            // 조건이 같으면 흐르던 애니메이션을 처음부터 다시 시작하지 않는다.
            const key = `${motion}:${available}:${needed}`
            if (key === applied) return
            applied = key

            animation?.cancel()
            animation = null
            viewport.dataset.motion = motion
            if (motion !== "scroll") return

            // 오른쪽 끝 바깥에서 왼쪽 끝 바깥까지 흐른 뒤, 그 자리(화면 밖)에 머물러 비어 보이게 한다.
            const travelMs = ((available + needed) / SPEED_PX_PER_SECOND) * 1000
            const duration = travelMs + MARQUEE_PAUSE_MS
            animation = label.animate(
                [
                    { transform: `translateX(${available}px)` },
                    { transform: `translateX(${-needed}px)`, offset: travelMs / duration },
                    { transform: `translateX(${-needed}px)` },
                ],
                { duration, iterations: Infinity, easing: "linear" }
            )
        }

        update()
        const observer = new ResizeObserver(update)
        observer.observe(viewport)
        observer.observe(label)
        reducedMotion.addEventListener("change", update)

        return () => {
            observer.disconnect()
            reducedMotion.removeEventListener("change", update)
            animation?.cancel()
        }
    }, [text])

    // 문구를 비우면 자리만 차지해 좌우 메뉴 배치를 그대로 둔다.
    if (!text) return <div className={cn("min-w-0 flex-1", className)} />

    return (
        <div className={cn("flex min-w-0 flex-1 justify-center", className)}>
            <div
                ref={viewportRef}
                data-slot="catchphrase"
                title={text}
                className="group/marquee flex w-full max-w-3xl min-w-0 items-center justify-center overflow-hidden data-[motion=scroll]:justify-start data-[motion=scroll]:mask-x-from-90%"
            >
                <span
                    ref={textRef}
                    className="shrink-0 text-sm font-medium whitespace-pre group-data-[motion=reduced]/marquee:min-w-0 group-data-[motion=reduced]/marquee:shrink group-data-[motion=reduced]/marquee:truncate"
                >
                    {text}
                </span>
            </div>
        </div>
    )
}
