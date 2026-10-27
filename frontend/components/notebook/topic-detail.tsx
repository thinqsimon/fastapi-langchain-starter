"use client"

import { useState } from "react"
import { ArrowLeft, CheckCircle2, RotateCcw } from "lucide-react"

import { DiaryDocument } from "@/components/diary/diary-document"
import { ConfirmDeleteDialog } from "@/components/notebook/confirm-delete-dialog"
import { TopicEditor } from "@/components/notebook/topic-editor"
import { Button } from "@/components/ui/button"
import { useNotebookStore } from "@/store/notebook"

const PANE =
    "mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6 sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))]"

/** 오른쪽 칸: 고른 주제의 본문(보기·수정) 또는 새 주제 입력칸. */
export function TopicDetail() {
    const selectedTopicId = useNotebookStore((state) => state.selectedTopicId)
    const topic = useNotebookStore((state) => state.topic)
    const creatingIn = useNotebookStore((state) => state.creatingIn)
    const creatingTitle = useNotebookStore((state) => state.notebooks.find((notebook) => notebook.id === state.creatingIn)?.title)
    const editing = useNotebookStore((state) => state.editing)
    const form = useNotebookStore((state) => state.form)
    const error = useNotebookStore((state) => state.error)
    const isSaving = useNotebookStore((state) => state.isSaving)
    const busy = useNotebookStore((state) => state.isSaving || state.isDeleting)
    const selectTopic = useNotebookStore((state) => state.selectTopic)
    const startEditing = useNotebookStore((state) => state.startEditing)
    const cancelEditing = useNotebookStore((state) => state.cancelEditing)
    const setForm = useNotebookStore((state) => state.setForm)
    const saveTopic = useNotebookStore((state) => state.saveTopic)
    const toggleCompleted = useNotebookStore((state) => state.toggleCompleted)
    const deleteTopic = useNotebookStore((state) => state.deleteTopic)
    const [confirming, setConfirming] = useState(false)

    // 좁은 화면(<md)에서만 보이는 목록 복귀 버튼. 선택을 풀면 왼쪽 칸이 다시 나온다.
    const backButton = (
        <Button size="sm" variant="ghost" className="md:hidden" onClick={() => void selectTopic(null)}>
            <ArrowLeft />
            목록
        </Button>
    )

    if (creatingIn) {
        return (
            <div className={PANE}>
                <div className="flex flex-wrap items-center gap-2">
                    {backButton}
                    <h2 className="text-lg font-semibold">새 주제</h2>
                </div>
                {creatingTitle && <p className="text-xs text-muted-foreground">&lsquo;{creatingTitle}&rsquo; 학습장에 추가합니다.</p>}
                <TopicEditor
                    value={form}
                    isSaving={isSaving}
                    submitLabel="추가"
                    onChange={setForm}
                    onSubmit={() => void saveTopic()}
                    onCancel={cancelEditing}
                />
            </div>
        )
    }

    if (!selectedTopicId) {
        return (
            <div className={PANE}>
                <p className="text-sm text-muted-foreground">왼쪽에서 주제를 고르세요.</p>
            </div>
        )
    }

    if (!topic) {
        return (
            <div className={PANE}>
                <div className="flex items-center gap-2">{backButton}</div>
                {!error && <p className="text-sm text-muted-foreground">주제를 불러오는 중…</p>}
            </div>
        )
    }

    return (
        <div className={PANE}>
            <div className="flex flex-wrap items-center gap-2">
                {backButton}
                {!editing && (
                    <>
                        <Button size="sm" variant="outline" disabled={busy} onClick={startEditing}>
                            수정
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => void toggleCompleted()}>
                            {topic.completed ? <RotateCcw /> : <CheckCircle2 />}
                            {topic.completed ? "완료 취소" : "학습 완료"}
                        </Button>
                        <Button size="sm" variant="outline" aria-label={`${topic.title} 삭제`} disabled={busy} onClick={() => setConfirming(true)}>
                            삭제
                        </Button>
                    </>
                )}
            </div>
            {editing ? (
                <TopicEditor
                    value={form}
                    isSaving={isSaving}
                    submitLabel="저장"
                    onChange={setForm}
                    onSubmit={() => void saveTopic()}
                    onCancel={cancelEditing}
                />
            ) : (
                <>
                    <h2 className="text-xl font-semibold wrap-anywhere">{topic.title}</h2>
                    <p data-slot="topic-meta" className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {topic.kind && <span>유형 {topic.kind}</span>}
                        {topic.tags.length > 0 && <span>태그 {topic.tags.join(", ")}</span>}
                        {topic.difficulty ? <span>난이도 {"★".repeat(topic.difficulty)}</span> : null}
                        {topic.completed && <span className="text-sky-700 dark:text-sky-300">학습 완료</span>}
                    </p>
                    <DiaryDocument markdown={topic.content} />
                </>
            )}
            <ConfirmDeleteDialog open={confirming} kind="topic" name={topic.title} onOpenChange={setConfirming} onConfirm={() => void deleteTopic(topic.id)} />
        </div>
    )
}
