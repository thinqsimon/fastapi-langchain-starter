"use client"

import { useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react"

import type { PaneWidthLimits } from "@/lib/pane-width"
import { cn } from "@/lib/utils"

/**
 * 두 칸 사이의 손잡이. 끌거나(또는 화살표·Home·End 키로) 왼쪽 칸 너비를 바꾸고, 두 번 누르면 기본 너비로 돌아간다.
 * 넓은 화면(md 이상)에서만 보인다. 학습장과 채팅이 함께 쓴다.
 */
export function PaneResizer({
    slot,
    label,
    container,
    width,
    limits,
    minRest,
    onResize,
    onReset,
    onDraggingChange,
}: {
    /** E2E가 찾는 data-slot 값 */
    slot: string
    label: string
    /** 왼쪽 칸·손잡이·오른쪽 칸을 담은 줄. 왼쪽 칸은 이 줄의 왼쪽 끝에서 시작한다. */
    container: RefObject<HTMLElement | null>
    width: number
    limits: PaneWidthLimits
    /** 오른쪽 칸이 최소한 이만큼은 남도록 끌 때 상한을 둔다(px). */
    minRest: number
    onResize: (width: number) => void
    onReset: () => void
    /** 끄는 동안 줄 전체에 '좌우 조절' 커서를 보여 주고 글자 선택을 막는 데 쓴다. */
    onDraggingChange?: (dragging: boolean) => void
}) {
    const [dragging, setDragging] = useState(false)

    const changeDragging = (next: boolean) => {
        setDragging(next)
        onDraggingChange?.(next)
    }

    /** 포인터 위치를 왼쪽 칸 너비로 바꾼다. 오른쪽 칸이 너무 좁아지지 않게 상한을 둔다. */
    const resizeTo = (clientX: number) => {
        const box = container.current?.getBoundingClientRect()
        if (!box) return
        onResize(Math.min(clientX - box.left, box.width - minRest))
    }

    const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return
        event.preventDefault() // 끄는 동안 글자가 선택되지 않게
        event.currentTarget.setPointerCapture(event.pointerId) // 손잡이 밖으로 나가도 move/up을 받는다
        changeDragging(true)
    }

    const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
        if (dragging) resizeTo(event.clientX)
    }

    const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
        if (!dragging) return
        changeDragging(false)
        event.currentTarget.releasePointerCapture(event.pointerId)
    }

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const keys: Record<string, number> = {
            ArrowLeft: width - limits.step,
            ArrowRight: width + limits.step,
            Home: limits.min,
            End: limits.max,
        }
        const next = keys[event.key]
        if (next === undefined) return
        event.preventDefault()
        onResize(next)
    }

    return (
        <div
            data-slot={slot}
            role="separator"
            aria-orientation="vertical"
            aria-label={label}
            aria-valuemin={limits.min}
            aria-valuemax={limits.max}
            aria-valuenow={width}
            tabIndex={0}
            title="끌어서 너비 조절, 두 번 누르면 기본 너비"
            className={cn(
                "hidden w-2 shrink-0 cursor-col-resize touch-none border-l bg-transparent transition-colors md:block",
                "hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
                dragging && "bg-muted"
            )}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onDoubleClick={onReset}
            onKeyDown={onKeyDown}
        />
    )
}
