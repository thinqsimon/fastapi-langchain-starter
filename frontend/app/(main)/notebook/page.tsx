"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"

import { NotebookList } from "@/components/notebook/notebook-list"
import { TopicDetail } from "@/components/notebook/topic-detail"
import { PaneResizer } from "@/components/pane-resizer"
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
    const restorePreferences = useNotebookStore((state) => state.restorePreferences)
    const setListWidth = useNotebookStore((state) => state.setListWidth)
    const resetListWidth = useNotebookStore((state) => state.resetListWidth)
    const root = useRef<HTMLDivElement>(null)
    const container = useRef<HTMLDivElement>(null)
    const [dragging, setDragging] = useState(false)

    useEffect(() => {
        restorePreferences()
        void load()
    }, [restorePreferences, load])

    // 넓은 화면에서는 페이지를 "뷰포트 높이 - 페이지 상단 위치"로 묶어 목록과 본문이 각각 안에서 스크롤되게 한다.
    // 헤더 높이가 고정값이 아니라 실제 위치를 재서 CSS 변수로 넣는다(창 크기가 바뀌면 다시 잰다).
    useEffect(() => {
        const element = root.current
        if (!element) return
        const measure = () => element.style.setProperty("--notebook-top", `${element.getBoundingClientRect().top + window.scrollY}px`)
        measure()
        window.addEventListener("resize", measure)
        return () => window.removeEventListener("resize", measure)
    }, [])

    return (
        <div ref={root} className="flex min-h-0 flex-1 flex-col md:h-[calc(100dvh-var(--notebook-top,0px))] md:flex-none md:overflow-hidden">
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
                <PaneResizer
                    slot="notebook-resizer"
                    label="목록 너비 조절"
                    container={container}
                    width={listWidth}
                    limits={LIST_WIDTH}
                    minRest={MIN_DETAIL_WIDTH}
                    onResize={setListWidth}
                    onReset={resetListWidth}
                    onDraggingChange={setDragging}
                />
                <section data-slot="topic-detail" className={cn("min-w-0 flex-1 flex-col overflow-y-auto", showDetail ? "flex" : "hidden md:flex")}>
                    <TopicDetail />
                </section>
            </div>
        </div>
    )
}
