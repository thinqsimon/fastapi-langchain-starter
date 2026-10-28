"use client"

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react"
import { Bookmark, BookmarkX, ListChecks, Plus, Upload, X } from "lucide-react"

import { NotebookGroup } from "@/components/notebook/notebook-group"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useNotebookStore, type NotebookFilter, type NotebookView } from "@/store/notebook"

/** 보기 세그먼트. 신규·보관함 버튼에는 해당 주제 수를 붙인다("신규 6", "보관함 12"). */
const VIEWS: { value: NotebookView; label: string }[] = [
    { value: "new", label: "신규" },
    { value: "all", label: "전체" },
    { value: "kept", label: "보관함" },
]

/** 상태 칩. 눌린 칩을 다시 누르면 꺼져서 모두 보인다('전체' 칩은 보기의 '전체'와 헷갈려 두지 않는다). */
const FILTERS: { value: Exclude<NotebookFilter, "all">; label: string }[] = [
    { value: "todo", label: "공부할 것" },
    { value: "done", label: "끝낸 것" },
]

/** 왼쪽 칸: 학습장 올리기·새 학습장·보기/상태 필터·선택 모드와 학습장(파일)별 주제 목록. */
export function NotebookList() {
    const notebooks = useNotebookStore((state) => state.notebooks)
    const view = useNotebookStore((state) => state.view)
    const filter = useNotebookStore((state) => state.filter)
    const selecting = useNotebookStore((state) => state.selecting)
    const selectedCount = useNotebookStore((state) => state.selectedIds.length)
    const keptCount = useNotebookStore((state) => state.notebooks.reduce((count, notebook) => count + notebook.topics.filter((topic) => topic.kept).length, 0))
    const newCount = useNotebookStore((state) => state.notebooks.reduce((count, notebook) => count + notebook.topics.filter((topic) => !topic.kept).length, 0))
    const isLoading = useNotebookStore((state) => state.isLoading)
    const isUploading = useNotebookStore((state) => state.isUploading)
    const busy = useNotebookStore((state) => state.isUploading || state.isSaving || state.isDeleting)
    const upload = useNotebookStore((state) => state.upload)
    const createNotebook = useNotebookStore((state) => state.createNotebook)
    const setFilter = useNotebookStore((state) => state.setFilter)
    const setView = useNotebookStore((state) => state.setView)
    const startSelecting = useNotebookStore((state) => state.startSelecting)
    const cancelSelecting = useNotebookStore((state) => state.cancelSelecting)
    const keepSelected = useNotebookStore((state) => state.keepSelected)
    const fileInput = useRef<HTMLInputElement>(null)
    const [creating, setCreating] = useState(false)
    const [name, setName] = useState("")

    // Esc로 선택 모드를 끝낸다. 열린 대화상자가 먼저 처리한 Esc는 건드리지 않는다.
    useEffect(() => {
        if (!selecting) return
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && !event.defaultPrevented) cancelSelecting()
        }
        window.addEventListener("keydown", onKeyDown)
        return () => window.removeEventListener("keydown", onKeyDown)
    }, [selecting, cancelSelecting])

    // 신규/보관함 보기에서는 해당 주제가 있는 학습장만 보인다.
    const shown = view === "all" ? notebooks : notebooks.filter((notebook) => notebook.topics.some((topic) => (view === "kept") === topic.kept))

    const onFile = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        // 같은 파일을 다시 골라도 change가 나도록 먼저 비운다.
        event.target.value = ""
        if (!file) return
        void file.text().then((content) => upload(file.name, content))
    }

    const onCreate = async (event: FormEvent) => {
        event.preventDefault()
        if (await createNotebook(name)) {
            setName("")
            setCreating(false)
        }
    }

    return (
        <>
            <div className="flex flex-col gap-3 border-b p-3">
                <h1 className="text-lg font-semibold">학습장</h1>
                <div className="flex flex-wrap items-center gap-2">
                    <input
                        ref={fileInput}
                        type="file"
                        accept=".md,.markdown,text/markdown"
                        aria-label="학습장 파일"
                        data-slot="notebook-file-input"
                        className="hidden"
                        onChange={onFile}
                    />
                    <Button size="sm" disabled={busy} onClick={() => fileInput.current?.click()}>
                        <Upload />
                        {isUploading ? "올리는 중…" : "학습장 올리기"}
                    </Button>
                    {!creating && (
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => setCreating(true)}>
                            <Plus />새 학습장
                        </Button>
                    )}
                    <Button
                        size="sm"
                        variant={selecting ? "secondary" : "outline"}
                        disabled={!selecting && (busy || shown.length === 0)}
                        className="ml-auto"
                        onClick={selecting ? cancelSelecting : startSelecting}
                    >
                        {selecting ? <X /> : <ListChecks />}
                        {selecting ? "선택 취소" : "선택"}
                    </Button>
                </div>
                {creating && (
                    <form className="flex flex-col gap-2" onSubmit={(event) => void onCreate(event)}>
                        <Label htmlFor="notebook-name">학습장 이름</Label>
                        <Input id="notebook-name" value={name} required maxLength={200} disabled={busy} onChange={(event) => setName(event.target.value)} />
                        <div className="flex gap-2">
                            <Button type="submit" size="sm" disabled={busy}>
                                만들기
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => {
                                    setCreating(false)
                                    setName("")
                                }}
                            >
                                취소
                            </Button>
                        </div>
                    </form>
                )}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <div role="group" aria-label="보기" className="flex items-center gap-1">
                        <span aria-hidden="true" className="text-xs text-muted-foreground">
                            보기
                        </span>
                        {VIEWS.map((item) => (
                            <Button
                                key={item.value}
                                size="xs"
                                variant={view === item.value ? "secondary" : "outline"}
                                aria-pressed={view === item.value}
                                onClick={() => setView(item.value)}
                            >
                                {item.value === "kept" && keptCount > 0
                                    ? `${item.label} ${keptCount}`
                                    : item.value === "new" && newCount > 0
                                      ? `${item.label} ${newCount}`
                                      : item.label}
                            </Button>
                        ))}
                    </div>
                    <div role="group" aria-label="진행 상태" className="flex items-center gap-1">
                        <span aria-hidden="true" className="text-xs text-muted-foreground">
                            상태
                        </span>
                        {FILTERS.map((item) => (
                            <Button
                                key={item.value}
                                size="xs"
                                variant={filter === item.value ? "secondary" : "outline"}
                                aria-pressed={filter === item.value}
                                onClick={() => setFilter(filter === item.value ? "all" : item.value)}
                            >
                                {item.label}
                            </Button>
                        ))}
                    </div>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
                {isLoading && notebooks.length === 0 && <p className="px-2 py-4 text-sm text-muted-foreground">학습장을 불러오는 중…</p>}
                {!isLoading && notebooks.length === 0 && (
                    <p className="px-2 py-4 text-sm leading-6 text-muted-foreground">아직 올린 학습장이 없습니다. /study-notes로 만든 md 파일을 올려 보세요.</p>
                )}
                {!isLoading && notebooks.length > 0 && shown.length === 0 && (
                    <p className="px-2 py-4 text-sm leading-6 text-muted-foreground">
                        {view === "kept" ? "보관한 주제가 없어요. 전체 보기에서 주제를 골라 보관하세요." : "새 주제가 없어요. 올린 주제를 모두 보관했어요."}
                    </p>
                )}
                {shown.map((notebook) => (
                    <NotebookGroup key={notebook.id} notebook={notebook} />
                ))}
            </div>
            {selecting && (
                <div
                    data-slot="notebook-select-bar"
                    className="flex shrink-0 flex-wrap items-center gap-2 border-t bg-background px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
                >
                    <span aria-live="polite" className="text-sm font-medium tabular-nums">
                        {selectedCount}개 선택
                    </span>
                    <div className="ml-auto flex flex-wrap gap-1">
                        <Button size="sm" disabled={busy || selectedCount === 0} onClick={() => void keepSelected(true)}>
                            <Bookmark />
                            보관
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy || selectedCount === 0} onClick={() => void keepSelected(false)}>
                            <BookmarkX />
                            보관 해제
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelSelecting}>
                            취소
                        </Button>
                    </div>
                </div>
            )}
        </>
    )
}
