"use client"

import { useEffect } from "react"

import { DiaryEditor } from "@/components/diary/diary-editor"
import { WeeklyReviewCard } from "@/components/diary/weekly-review"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useDiaryStore } from "@/store/diary"

export default function DiaryPage() {
    const entries = useDiaryStore((state) => state.entries)
    const draft = useDiaryStore((state) => state.draft)
    const editingId = useDiaryStore((state) => state.editingId)
    const isSaving = useDiaryStore((state) => state.isSaving)
    const isDrafting = useDiaryStore((state) => state.isDrafting)
    const error = useDiaryStore((state) => state.error)
    const loadEntries = useDiaryStore((state) => state.loadEntries)
    const setDraft = useDiaryStore((state) => state.setDraft)
    const startEditing = useDiaryStore((state) => state.startEditing)
    const cancelEditing = useDiaryStore((state) => state.cancelEditing)
    const fillFromLatestConversation = useDiaryStore((state) => state.fillFromLatestConversation)
    const save = useDiaryStore((state) => state.save)
    const remove = useDiaryStore((state) => state.remove)

    useEffect(() => {
        void loadEntries()
    }, [loadEntries])

    return (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 overflow-y-auto p-6">
            <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-semibold">{editingId ? "일기 수정" : "오늘의 배움일기"}</h1>
                    {!editingId && (
                        <Button variant="outline" size="sm" onClick={() => void fillFromLatestConversation()} disabled={isDrafting}>
                            {isDrafting ? "정리 중…" : "대화에서 초안 만들기"}
                        </Button>
                    )}
                </div>

                {error && (
                    <p role="alert" className="text-sm text-destructive">
                        {error}
                    </p>
                )}

                <DiaryEditor
                    value={draft}
                    isSaving={isSaving}
                    submitLabel={editingId ? "수정 저장" : "저장"}
                    onChange={setDraft}
                    onSubmit={() => void save()}
                    onCancel={editingId ? cancelEditing : undefined}
                />
            </section>

            <WeeklyReviewCard />

            <section className="flex flex-col gap-3">
                <h2 className="text-lg font-semibold">지난 일기</h2>

                {entries.length === 0 && <p className="text-sm text-muted-foreground">아직 쓴 일기가 없습니다.</p>}

                {entries.map((entry) => (
                    <Card key={entry.id}>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-base">{entry.entry_date}</CardTitle>
                            <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => startEditing(entry)}>
                                    수정
                                </Button>
                                <Button size="sm" variant="outline" aria-label={`${entry.entry_date} 삭제`} onClick={() => void remove(entry.id)}>
                                    삭제
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-2 text-sm">
                            <p>
                                <span className="font-medium">배운 것</span> · {entry.learned}
                            </p>
                            <p>
                                <span className="font-medium">어려웠던 것</span> · {entry.difficult}
                            </p>
                            <p>
                                <span className="font-medium">내일 할 것</span> · {entry.next_plan}
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </section>
        </div>
    )
}
