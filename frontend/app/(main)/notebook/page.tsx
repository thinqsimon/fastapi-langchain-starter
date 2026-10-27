"use client"

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react"

import { NotebookList } from "@/components/notebook/notebook-list"
import { TopicDetail } from "@/components/notebook/topic-detail"
import { cn } from "@/lib/utils"
import { LIST_WIDTH, useNotebookStore } from "@/store/notebook"

/** 본문이 최소한 이만큼은 남도록 목록을 넓힐 때 상한을 둔다(px). */
const MIN_DETAIL_WIDTH = 320

/** 학습장: 왼쪽은 학습장(파일)별 주제 목록, 오른쪽은 고른 주제의 본문. 좁은 화면(<md)에서는 한 칸씩 보인다.
 *  넓은 화면에서는 두 칸 사이의 손잡이를 끌어(또는 화살표 키로) 목록 너비를 조절한다. */
export default function NotebookPage() {
    const load = useNotebookStore((state) => state.load)
    const error = useNotebookStore((state) => state.error)
    const notice = useNotebookStore((state) => state.notice)
    // 주제를 골랐거나 새 주제를 쓰는 중이면 좁은 화면에서 오른쪽 칸만 보인다.
    const showDetail = useNotebookStore((state) => state.selectedTopicId !== null || state.creatingIn !== null)
    const listWidth = useNotebookStore((state) => state.listWidth)
    const restoreListWidth = useNotebookStore((state) => state.restoreListWidth)
    const setListWidth = useNotebookStore((state) => state.setListWidth)
    const resetListWidth = useNotebookStore((state) => state.resetListWidth)
    const container = useRef<HTMLDivElement>(null)
    const [dragging, setDragging] = useState(false)

    useEffect(() => {
        restoreListWidth()
        void load()
    }, [restoreListWidth, load])

    /** 포인터 위치를 목록 너비로 바꾼다. 본문이 너무 좁아지지 않게 상한을 둔다. */
    const resizeTo = (clientX: number) => {
        const box = container.current?.getBoundingClientRect()
        if (!box) return
        setListWidth(Math.min(clientX - box.left, box.width - MIN_DETAIL_WIDTH))
    }

    const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return
        event.preventDefault() // 끄는 동안 글자가 선택되지 않게
        event.currentTarget.setPointerCapture(event.pointerId) // 손잡이 밖으로 나가도 move/up을 받는다
        setDragging(true)
    }

    const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
        if (dragging) resizeTo(event.clientX)
    }

    const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
        if (!dragging) return
        setDragging(false)
        event.currentTarget.releasePointerCapture(event.pointerId)
    }

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const keys: Record<string, number> = {
            ArrowLeft: listWidth - LIST_WIDTH.step,
            ArrowRight: listWidth + LIST_WIDTH.step,
            Home: LIST_WIDTH.min,
            End: LIST_WIDTH.max,
        }
        const next = keys[event.key]
        if (next === undefined) return
        event.preventDefault()
        setListWidth(next)
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            {(error || notice) && (
                <div className="flex flex-col gap-1 border-b px-4 py-2 sm:px-6">
                    {error && (
                        <p role="alert" className="text-sm text-destructive">
                            {error}
                        </p>
                    )}
                    {notice && (
                        <p role="status" className="text-sm text-sky-700 dark:text-sky-300">
                            {notice}
                        </p>
                    )}
                </div>
            )}
            <div
                ref={container}
                className={cn("flex min-h-0 flex-1", dragging && "cursor-col-resize select-none")}
                style={{ "--notebook-list-width": `${listWidth}px` } as CSSProperties}
            >
                <aside
                    data-slot="notebook-list"
                    className={cn("min-h-0 w-full shrink-0 flex-col md:flex md:w-[var(--notebook-list-width)]", showDetail ? "hidden" : "flex")}
                >
                    <NotebookList />
                </aside>
                <div
                    data-slot="notebook-resizer"
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="목록 너비 조절"
                    aria-valuemin={LIST_WIDTH.min}
                    aria-valuemax={LIST_WIDTH.max}
                    aria-valuenow={listWidth}
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
                    onDoubleClick={resetListWidth}
                    onKeyDown={onKeyDown}
                />
                <section data-slot="topic-detail" className={cn("min-w-0 flex-1 flex-col overflow-y-auto", showDetail ? "flex" : "hidden md:flex")}>
                    <TopicDetail />
                </section>
            </div>
        </div>
    )
}
