"use client"

import { useEffect } from "react"

import { ConversationPicker } from "@/components/diary/conversation-picker"
import { DiaryEditor } from "@/components/diary/diary-editor"
import { DiaryEntryCard } from "@/components/diary/diary-entry-card"
import { DiaryPreviewActions } from "@/components/diary/diary-preview-actions"
import { WeeklyReviewCard } from "@/components/diary/weekly-review"
import { Button } from "@/components/ui/button"
import { useDiaryStore } from "@/store/diary"
import { usePreferencesStore } from "@/store/preferences"

export default function DiaryPage() {
    const entries = useDiaryStore((state) => state.entries)
    const form = useDiaryStore((state) => state.form)
    const source = useDiaryStore((state) => state.source)
    const editingId = useDiaryStore((state) => state.editingId)
    const isSaving = useDiaryStore((state) => state.isSaving)
    const error = useDiaryStore((state) => state.error)
    const load = useDiaryStore((state) => state.load)
    const setForm = useDiaryStore((state) => state.setForm)
    const discardDraft = useDiaryStore((state) => state.discardDraft)
    const startEditing = useDiaryStore((state) => state.startEditing)
    const cancelEditing = useDiaryStore((state) => state.cancelEditing)
    const save = useDiaryStore((state) => state.save)
    const remove = useDiaryStore((state) => state.remove)
    const footer = usePreferencesStore((state) => state.preferences?.diary_footer)
    // 프리뷰에는 저장했을 때 붙을 푸터를 넣는다(수정 중이면 그 일기에 이미 붙은 푸터).
    const previewFooter = editingId ? (entries.find((entry) => entry.id === editingId)?.footer ?? null) : (footer ?? null)

    useEffect(() => {
        void load()
    }, [load])

    return (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 overflow-y-auto p-4 sm:p-6">
            <section className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h1 className="text-xl font-semibold">{editingId ? "일기 수정" : "새 배움일기"}</h1>
                    <DiaryPreviewActions name="작성 중인 일기" diary={{ ...form, footer: previewFooter }} />
                </div>

                {!editingId && <ConversationPicker />}

                {source && (
                    <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        &lsquo;{source.conversationTitle}&rsquo; 채팅으로 만든 초안입니다. 고쳐서 저장하세요.
                        <Button type="button" size="xs" variant="ghost" onClick={discardDraft}>
                            초안 버리기
                        </Button>
                    </p>
                )}

                {error && (
                    <p role="alert" className="text-sm text-destructive">
                        {error}
                    </p>
                )}

                <DiaryEditor
                    value={form}
                    footer={editingId ? undefined : footer}
                    isSaving={isSaving}
                    submitLabel={editingId ? "수정 저장" : "저장"}
                    onChange={setForm}
                    onSubmit={() => void save()}
                    onCancel={editingId ? cancelEditing : undefined}
                />
            </section>

            <WeeklyReviewCard />

            <section className="flex flex-col gap-3">
                <h2 className="text-lg font-semibold">지난 일기</h2>

                {entries.length === 0 && <p className="text-sm text-muted-foreground">아직 쓴 일기가 없습니다.</p>}

                {entries.map((entry) => (
                    <DiaryEntryCard key={entry.id} entry={entry} onEdit={() => startEditing(entry)} onDelete={() => void remove(entry.id)} />
                ))}
            </section>
        </div>
    )
}
