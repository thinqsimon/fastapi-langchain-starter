"use client"

import { useState, type FormEvent } from "react"
import { BookmarkCheck, CheckCircle2, Circle } from "lucide-react"

import type { Notebook } from "@/lib/api"
import { ConfirmDeleteDialog } from "@/components/notebook/confirm-delete-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { useNotebookStore, visibleTopics } from "@/store/notebook"

/** 선택 모드의 체크박스. 터치로도 누르기 쉽게 16px 이상으로 둔다. */
const CHECKBOX = "size-4 shrink-0 cursor-pointer accent-sky-600 disabled:cursor-default"

/** 학습장(파일) 하나와 그 안의 주제 목록. 보기·상태 필터는 주제에만 적용하고 머리글은 늘 보여 준다.
 *  선택 모드에서는 머리글에 '모두 선택', 주제 줄에 체크박스가 생기고 줄을 누르면 본문 대신 체크가 바뀐다. */
export function NotebookGroup({ notebook }: { notebook: Notebook }) {
    const selectedTopicId = useNotebookStore((state) => state.selectedTopicId)
    const view = useNotebookStore((state) => state.view)
    const filter = useNotebookStore((state) => state.filter)
    const selecting = useNotebookStore((state) => state.selecting)
    const selectedIds = useNotebookStore((state) => state.selectedIds)
    const busy = useNotebookStore((state) => state.isUploading || state.isSaving || state.isDeleting)
    const selectTopic = useNotebookStore((state) => state.selectTopic)
    const startNewTopic = useNotebookStore((state) => state.startNewTopic)
    const renameNotebook = useNotebookStore((state) => state.renameNotebook)
    const deleteNotebook = useNotebookStore((state) => state.deleteNotebook)
    const toggleSelected = useNotebookStore((state) => state.toggleSelected)
    const setSelected = useNotebookStore((state) => state.setSelected)
    const [renaming, setRenaming] = useState(false)
    const [name, setName] = useState(notebook.title)
    const [confirming, setConfirming] = useState(false)
    const completedCount = notebook.topics.filter((topic) => topic.completed).length
    const keptCount = notebook.topics.filter((topic) => topic.kept).length
    const visible = visibleTopics(notebook.topics, view, filter)
    // '모두 선택'은 지금 보이는 주제만 다룬다.
    const selectedCount = selecting ? visible.filter((topic) => selectedIds.includes(topic.id)).length : 0
    const allSelected = visible.length > 0 && selectedCount === visible.length
    const headingId = `notebook-${notebook.id}`
    const subtitle = [
        notebook.project,
        notebook.filename ?? "직접 만든 학습장",
        keptCount > 0 ? `보관 ${keptCount}` : null,
        `완료 ${completedCount}/${notebook.topics.length}`,
    ]
        .filter(Boolean)
        .join(" · ")

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
                        <div className="flex min-w-0 items-center gap-2">
                            {selecting && (
                                <input
                                    type="checkbox"
                                    aria-label={`${notebook.title} 모두 선택`}
                                    className={CHECKBOX}
                                    checked={allSelected}
                                    disabled={busy || visible.length === 0}
                                    ref={(element) => {
                                        // 일부만 골랐으면 '-' 표시. 속성이 아니라 DOM 속성이라 ref로 맞춘다.
                                        if (element) element.indeterminate = !allSelected && selectedCount > 0
                                    }}
                                    onChange={() =>
                                        setSelected(
                                            visible.map((topic) => topic.id),
                                            !allSelected
                                        )
                                    }
                                />
                            )}
                            <h2 id={headingId} title={notebook.title} className="min-w-0 flex-1 truncate text-sm font-semibold">
                                {notebook.title}
                            </h2>
                        </div>
                        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
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
                    const checked = selecting && selectedIds.includes(topic.id)
                    const label = `${topic.position}. ${topic.title}`
                    const body = (
                        <>
                            {topic.completed ? (
                                <CheckCircle2 className="size-4 shrink-0 text-sky-600" />
                            ) : (
                                <Circle className="size-4 shrink-0 text-muted-foreground/60" />
                            )}
                            <span className="min-w-0 flex-1 truncate">{label}</span>
                            {topic.kept && <BookmarkCheck className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />}
                        </>
                    )
                    return (
                        <li key={topic.id} data-slot="notebook-topic" data-completed={topic.completed} data-kept={topic.kept}>
                            {selecting ? (
                                <label
                                    className={cn(
                                        "flex min-h-10 w-full min-w-0 cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted",
                                        checked && "bg-muted"
                                    )}
                                >
                                    <input
                                        type="checkbox"
                                        aria-label={`${label} 선택`}
                                        className={CHECKBOX}
                                        checked={checked}
                                        disabled={busy}
                                        onChange={() => toggleSelected(topic.id)}
                                    />
                                    {body}
                                </label>
                            ) : (
                                <button
                                    type="button"
                                    aria-current={selected ? "true" : undefined}
                                    onClick={() => void selectTopic(topic.id)}
                                    className={cn(
                                        "flex w-full min-w-0 items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted",
                                        selected && "bg-muted font-medium"
                                    )}
                                >
                                    {body}
                                </button>
                            )}
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
