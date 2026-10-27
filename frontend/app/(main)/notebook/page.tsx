"use client"

import { useEffect } from "react"

import { NotebookList } from "@/components/notebook/notebook-list"
import { TopicDetail } from "@/components/notebook/topic-detail"
import { cn } from "@/lib/utils"
import { useNotebookStore } from "@/store/notebook"

/** 학습장: 왼쪽은 학습장(파일)별 주제 목록, 오른쪽은 고른 주제의 본문. 좁은 화면(<md)에서는 한 칸씩 보인다. */
export default function NotebookPage() {
    const load = useNotebookStore((state) => state.load)
    const error = useNotebookStore((state) => state.error)
    const notice = useNotebookStore((state) => state.notice)
    // 주제를 골랐거나 새 주제를 쓰는 중이면 좁은 화면에서 오른쪽 칸만 보인다.
    const showDetail = useNotebookStore((state) => state.selectedTopicId !== null || state.creatingIn !== null)

    useEffect(() => {
        void load()
    }, [load])

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
            <div className="flex min-h-0 flex-1">
                <aside data-slot="notebook-list" className={cn("min-h-0 w-full shrink-0 flex-col border-r md:flex md:w-80", showDetail ? "hidden" : "flex")}>
                    <NotebookList />
                </aside>
                <section data-slot="topic-detail" className={cn("min-w-0 flex-1 flex-col overflow-y-auto", showDetail ? "flex" : "hidden md:flex")}>
                    <TopicDetail />
                </section>
            </div>
        </div>
    )
}
