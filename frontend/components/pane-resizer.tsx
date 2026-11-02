"use client"

import { useEffect, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react"

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

    // 끄는 동안만 줄에 알린다. 끄는 중에 손잡이가 사라져도(대화 목록 접기) 줄에 커서가 남지 않는다.
    useEffect(() => {
        if (!dragging) return
        onDraggingChange?.(true)
        return () => onDraggingChange?.(false)
    }, [dragging, onDraggingChange])

    /** 포인터 위치를 왼쪽 칸 너비로 바꾼다. 오른쪽 칸이 너무 좁아지지 않게 상한을 둔다. */
    const resizeTo = (clientX: number) => {
        const box = container.current?.getBoundingClientRect()
        if (!box) return
        onResize(Math.min(clientX - box.left, box.width - minRest))
    }

    const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return
        event.preventDefault() // 끄는 동안 글자가 선택되지 않게
        event.currentTarget.setPointerCapture(event.pointerId) // 손잡이 밖으로 나가도 move를 받는다
        setDragging(true)
    }

    const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
        if (!dragging) return
        if (event.buttons & 1) {
            resizeTo(event.clientX)
        } else {
            // 버튼이 이미 풀렸는데 pointerup을 못 받았다(창 밖에서 놓기 등). 더 따라가지 않고 끌기를 끝낸다.
            setDragging(false)
            event.currentTarget.releasePointerCapture(event.pointerId)
        }
    }

    /** 끌기의 끝. 버튼을 놓거나 취소돼도, pointerup을 못 받아도 포인터 캡처는 풀리므로 이 이벤트 하나로 끝낸다. */
    const onLostPointerCapture = () => setDragging(false)

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
            onLostPointerCapture={onLostPointerCapture}
            onDoubleClick={onReset}
            onKeyDown={onKeyDown}
        />
    )
}
