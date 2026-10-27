"use client"

import { useState, type FormEvent } from "react"
import { CheckCircle2, Circle } from "lucide-react"

import type { Notebook } from "@/api"
import { ConfirmDeleteDialog } from "@/components/notebook/confirm-delete-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { useNotebookStore } from "@/store/notebook"

/** 학습장(파일) 하나와 그 안의 주제 목록. 필터는 주제에만 적용하고 머리글은 늘 보여 준다. */
export function NotebookGroup({ notebook }: { notebook: Notebook }) {
    const selectedTopicId = useNotebookStore((state) => state.selectedTopicId)
    const filter = useNotebookStore((state) => state.filter)
    const busy = useNotebookStore((state) => state.isUploading || state.isSaving || state.isDeleting)
    const selectTopic = useNotebookStore((state) => state.selectTopic)
    const startNewTopic = useNotebookStore((state) => state.startNewTopic)
    const renameNotebook = useNotebookStore((state) => state.renameNotebook)
    const deleteNotebook = useNotebookStore((state) => state.deleteNotebook)
    const [renaming, setRenaming] = useState(false)
    const [name, setName] = useState(notebook.title)
    const [confirming, setConfirming] = useState(false)
    const completedCount = notebook.topics.filter((topic) => topic.completed).length
    const visible = notebook.topics.filter((topic) => filter === "all" || (filter === "done") === topic.completed)
    const headingId = `notebook-${notebook.id}`

    const onRename = async (event: FormEvent) => {
        event.preventDefault()
        if (await renameNotebook(notebook.id, name)) setRenaming(false)
    }

    return (
        <section data-slot="notebook-group" aria-labelledby={headingId} className="flex flex-col gap-1 py-2">
            <div className="flex flex-col gap-1 px-2">
                {renaming ? (
                    <form className="flex flex-col gap-2" onSubmit={(event) => void onRename(event)}>
                        <Label htmlFor={`${headingId}-name`}>학습장 이름</Label>
                        <Input
                            id={`${headingId}-name`}
                            value={name}
                            required
                            maxLength={200}
                            disabled={busy}
                            onChange={(event) => setName(event.target.value)}
                        />
                        <div className="flex gap-2">
                            <Button type="submit" size="xs" disabled={busy}>
                                저장
                            </Button>
                            <Button type="button" size="xs" variant="outline" disabled={busy} onClick={() => setRenaming(false)}>
                                취소
                            </Button>
                        </div>
                    </form>
                ) : (
                    <>
                        <h2 id={headingId} title={notebook.title} className="min-w-0 truncate text-sm font-semibold">
                            {notebook.title}
                        </h2>
                        <p className="truncate text-xs text-muted-foreground">
                            {notebook.filename ?? "직접 만든 학습장"} · 완료 {completedCount}/{notebook.topics.length}
                        </p>
                    </>
                )}
                <div className="flex flex-wrap gap-1">
                    <Button size="xs" variant="ghost" disabled={busy} onClick={() => startNewTopic(notebook.id)}>
                        새 주제
                    </Button>
                    <Button
                        size="xs"
                        variant="ghost"
                        disabled={busy || renaming}
                        onClick={() => {
                            setName(notebook.title)
                            setRenaming(true)
                        }}
                    >
                        이름 바꾸기
                    </Button>
                    <Button
                        size="xs"
                        variant="ghost"
                        aria-label={`${notebook.title} 삭제`}
                        disabled={busy}
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setConfirming(true)}
                    >
                        삭제
                    </Button>
                </div>
            </div>
            <ul className="flex flex-col gap-0.5">
                {visible.length === 0 && <li className="px-3 py-2 text-xs text-muted-foreground">주제가 없습니다.</li>}
                {visible.map((topic) => {
                    const selected = topic.id === selectedTopicId
                    return (
                        <li key={topic.id} data-slot="notebook-topic" data-completed={topic.completed}>
                            <button
                                type="button"
                                aria-current={selected ? "true" : undefined}
                                onClick={() => void selectTopic(topic.id)}
                                className={cn(
                                    "flex w-full min-w-0 items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted",
                                    selected && "bg-muted font-medium"
                                )}
                            >
                                {topic.completed ? (
                                    <CheckCircle2 className="size-4 shrink-0 text-sky-600" />
                                ) : (
                                    <Circle className="size-4 shrink-0 text-muted-foreground/60" />
                                )}
                                <span className="min-w-0 flex-1 truncate">
                                    {topic.position}. {topic.title}
                                </span>
                            </button>
                        </li>
                    )
                })}
            </ul>
            <ConfirmDeleteDialog
                open={confirming}
                kind="notebook"
                name={notebook.title}
                onOpenChange={setConfirming}
                onConfirm={() => void deleteNotebook(notebook.id)}
            />
        </section>
    )
}
