"use client"

import { useRef, useState, type ChangeEvent, type FormEvent } from "react"
import { Plus, Upload } from "lucide-react"

import { NotebookGroup } from "@/components/notebook/notebook-group"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useNotebookStore, type NotebookFilter } from "@/store/notebook"

const FILTERS: { value: NotebookFilter; label: string }[] = [
    { value: "all", label: "전체" },
    { value: "todo", label: "공부할 것" },
    { value: "done", label: "끝낸 것" },
]

/** 왼쪽 칸: 학습장 올리기·새 학습장·필터와 학습장(파일)별 주제 목록. */
export function NotebookList() {
    const notebooks = useNotebookStore((state) => state.notebooks)
    const filter = useNotebookStore((state) => state.filter)
    const isLoading = useNotebookStore((state) => state.isLoading)
    const isUploading = useNotebookStore((state) => state.isUploading)
    const busy = useNotebookStore((state) => state.isUploading || state.isSaving || state.isDeleting)
    const upload = useNotebookStore((state) => state.upload)
    const createNotebook = useNotebookStore((state) => state.createNotebook)
    const setFilter = useNotebookStore((state) => state.setFilter)
    const fileInput = useRef<HTMLInputElement>(null)
    const [creating, setCreating] = useState(false)
    const [name, setName] = useState("")

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
                <div className="flex flex-wrap gap-2">
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
                <div role="group" aria-label="주제 필터" className="flex flex-wrap gap-1">
                    {FILTERS.map((item) => (
                        <Button
                            key={item.value}
                            size="xs"
                            variant={filter === item.value ? "secondary" : "outline"}
                            aria-pressed={filter === item.value}
                            onClick={() => setFilter(item.value)}
                        >
                            {item.label}
                        </Button>
                    ))}
                </div>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
                {isLoading && notebooks.length === 0 && <p className="px-2 py-4 text-sm text-muted-foreground">학습장을 불러오는 중…</p>}
                {!isLoading && notebooks.length === 0 && (
                    <p className="px-2 py-4 text-sm leading-6 text-muted-foreground">아직 올린 학습장이 없습니다. /study-notes로 만든 md 파일을 올려 보세요.</p>
                )}
                {notebooks.map((notebook) => (
                    <NotebookGroup key={notebook.id} notebook={notebook} />
                ))}
            </div>
        </>
    )
}
