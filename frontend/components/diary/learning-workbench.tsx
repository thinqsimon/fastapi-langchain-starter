"use client"

import { useEffect, useState } from "react"
import { BookOpen, CheckCircle2, History, RotateCcw } from "lucide-react"

import type { StudyItem } from "@/api"
import { MarkdownView } from "@/components/markdown-view"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { formatDateTime } from "@/lib/date"
import { useDiaryStore } from "@/store/diary"
import { useLearningStore, weekStart } from "@/store/learning"

export function LearningWorkbench() {
    const entries = useDiaryStore((state) => state.entries)
    const load = useLearningStore((state) => state.load)
    const error = useLearningStore((state) => state.error)
    const notice = useLearningStore((state) => state.notice)
    const isLoading = useLearningStore((state) => state.isLoading)

    useEffect(() => {
        void load()
    }, [load, entries])

    return (
        <section id="learning-workbench" aria-label="회고와 복습" className="flex min-w-0 scroll-mt-4 flex-col gap-5">
            {error && (
                <div className="flex flex-wrap items-center gap-2">
                    <p role="alert" className="text-sm text-destructive">
                        {error}
                    </p>
                    <Button size="sm" variant="outline" disabled={isLoading} onClick={() => void load()}>
                        다시 불러오기
                    </Button>
                </div>
            )}
            {notice && (
                <p role="status" className="text-sm text-sky-700 dark:text-sky-300">
                    {notice}
                </p>
            )}
            <WeeklyReviewCard />
            <StudyReviewCard />
        </section>
    )
}

export function WeeklyReviewCard() {
    const reviews = useLearningStore((state) => state.reviews)
    const reference = useLearningStore((state) => state.reference)
    const selectedId = useLearningStore((state) => state.selectedReviewId)
    const isLoading = useLearningStore((state) => state.isLoading)
    const isGenerating = useLearningStore((state) => state.isGenerating)
    const isDeleting = useLearningStore((state) => state.isDeleting)
    const setReference = useLearningStore((state) => state.setReference)
    const selectReview = useLearningStore((state) => state.selectReview)
    const generate = useLearningStore((state) => state.generateReview)
    const remove = useLearningStore((state) => state.deleteReview)
    const [deleteId, setDeleteId] = useState<string | null>(null)
    const selected = reviews.find((review) => review.id === selectedId)
    const existing = reviews.some((review) => review.week_start === weekStart(reference))
    const busy = isGenerating || isDeleting || isLoading

    return (
        <Card data-slot="weekly-reviews">
            <CardHeader>
                <CardTitle>
                    <h2 className="flex items-center gap-2">
                        <History className="size-4 text-sky-600" />
                        주간 회고
                    </h2>
                </CardTitle>
                <CardDescription>한 주의 배움을 정리해 보관하세요. 회고를 만들면 바로 저장됩니다.</CardDescription>
            </CardHeader>
            <CardContent className="flex min-w-0 flex-col gap-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <Label htmlFor="review-reference">회고 기준 날짜</Label>
                        <Input
                            id="review-reference"
                            type="date"
                            value={reference}
                            disabled={busy}
                            onChange={(event) => setReference(event.target.value)}
                            className="text-base"
                        />
                    </div>
                    <Button variant="outline" onClick={() => void generate()} disabled={busy || !reference} aria-busy={isGenerating}>
                        {isGenerating ? "정리하고 저장 중…" : existing ? "저장된 회고 열기" : "회고 만들기"}
                    </Button>
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                    선택한 날짜가 속한 월요일부터 일요일까지의 일기를 사용합니다. 한 주에 한 편을 보관합니다.
                </p>
                <div className="flex flex-col gap-2">
                    <Label htmlFor="saved-review">저장된 회고</Label>
                    <select
                        id="saved-review"
                        value={selectedId ?? ""}
                        onChange={(event) => selectReview(event.target.value)}
                        disabled={busy || reviews.length === 0}
                        className="h-10 w-full min-w-0 rounded-lg border bg-background px-3 text-base"
                    >
                        <option value="">{reviews.length ? "회고를 선택하세요" : "아직 저장한 회고가 없습니다"}</option>
                        {reviews.map((review) => (
                            <option key={review.id} value={review.id}>
                                {review.week_start} ~ {review.week_end} · 일기 {review.entry_count}편
                            </option>
                        ))}
                    </select>
                </div>
                {selected && (
                    <div data-slot="saved-review" className="flex flex-col gap-4 rounded-xl border bg-sky-50/40 p-4 dark:bg-sky-950/10">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs text-muted-foreground">
                                {selected.week_start} ~ {selected.week_end} · 일기 {selected.entry_count}편
                            </p>
                            <Button size="xs" variant="ghost" disabled={busy} onClick={() => setDeleteId(selected.id)}>
                                회고 삭제
                            </Button>
                        </div>
                        <dl className="flex flex-col gap-4 text-sm">
                            {[
                                ["성장한 점", selected.grown],
                                ["반복된 어려움", selected.repeated_difficulty],
                                ["다음 주 제안", selected.suggestion],
                            ].map(([term, description]) => (
                                <div key={term}>
                                    <dt className="mb-1 font-medium">{term}</dt>
                                    <dd className="leading-6 wrap-anywhere whitespace-pre-wrap text-muted-foreground">{description}</dd>
                                </div>
                            ))}
                        </dl>
                        <p className="border-t pt-3 text-xs leading-5 text-muted-foreground">
                            저장 당시의 일기를 바탕으로 한 회고예요. 새 내용으로 다시 만들려면 이 회고를 삭제한 뒤 생성해 주세요.
                        </p>
                    </div>
                )}
            </CardContent>
            <Dialog
                open={!!deleteId}
                onOpenChange={(open) => {
                    if (!open) setDeleteId(null)
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>저장한 회고를 삭제할까요?</DialogTitle>
                        <DialogDescription>이 회고가 삭제됩니다. 작성한 일기와 복습 메모는 유지됩니다.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteId(null)}>
                            취소
                        </Button>
                        <Button
                            onClick={() => {
                                if (deleteId) void remove(deleteId)
                                setDeleteId(null)
                            }}
                        >
                            삭제하기
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    )
}

function StudyReviewCard() {
    const items = useLearningStore((state) => state.items)
    const completed = useLearningStore((state) => state.completedFilter)
    const setFilter = useLearningStore((state) => state.setCompletedFilter)
    const isLoading = useLearningStore((state) => state.isLoading)
    const pendingCount = items.filter((item) => !item.completed).length
    const completedCount = items.length - pendingCount
    const visible = items.filter((item) => item.completed === completed)

    return (
        <Card data-slot="study-review">
            <CardHeader>
                <CardTitle>
                    <h2 className="flex items-center gap-2">
                        <BookOpen className="size-4 text-sky-600" />
                        어려웠던 내용 복습
                    </h2>
                </CardTitle>
                <CardDescription>일기에서 어려웠던 내용을 다시 설명하고, 나만의 이해를 메모해 보세요.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2" aria-label="복습 상태 필터">
                    <Button variant={completed ? "outline" : "secondary"} aria-pressed={!completed} onClick={() => setFilter(false)}>
                        복습할 내용 ({pendingCount})
                    </Button>
                    <Button variant={completed ? "secondary" : "outline"} aria-pressed={completed} onClick={() => setFilter(true)}>
                        완료한 내용 ({completedCount})
                    </Button>
                </div>
                {isLoading && !items.length && <p className="text-sm text-muted-foreground">복습 내용을 불러오는 중…</p>}
                {!isLoading && !visible.length && (
                    <p className="text-sm text-muted-foreground">
                        {completed ? "완료한 복습이 아직 없어요." : "복습할 내용이 없어요. 일기의 어려웠던 내용을 기록해 주세요."}
                    </p>
                )}
                {visible.map((item) => (
                    <StudyCard key={item.entry_id} item={item} />
                ))}
                <p className="text-xs leading-5 text-muted-foreground">
                    일기의 어려웠던 내용을 바꾸면 완료 상태가 해제되고 메모는 유지됩니다. 일기를 삭제하면 해당 복습도 삭제됩니다.
                </p>
            </CardContent>
        </Card>
    )
}

function StudyCard({ item }: { item: StudyItem }) {
    const note = useLearningStore((state) => state.noteDrafts[item.entry_id] ?? item.note)
    const saving = useLearningStore((state) => state.savingIds.includes(item.entry_id))
    const setNote = useLearningStore((state) => state.setNote)
    const save = useLearningStore((state) => state.saveStudy)

    return (
        <article data-slot="study-item" aria-label={item.title} className="flex min-w-0 flex-col gap-3 rounded-xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="min-w-0 text-sm font-medium wrap-anywhere">{item.title}</h3>
                <span className="text-xs text-muted-foreground">{item.entry_date}</span>
            </div>
            <p className="text-sm leading-6 wrap-anywhere whitespace-pre-wrap">{item.difficult}</p>
            <details className="rounded-lg bg-muted/50 p-3">
                <summary className="cursor-pointer text-sm font-medium">학습 내용 다시 보기</summary>
                <MarkdownView className="mt-3">{[item.learned, item.learned_detail].filter(Boolean).join("\n\n")}</MarkdownView>
            </details>
            <form
                className="flex flex-col gap-2"
                onSubmit={(event) => {
                    event.preventDefault()
                    void save(item.entry_id, item.completed)
                }}
            >
                <Label htmlFor={`study-note-${item.entry_id}`}>복습 메모</Label>
                <Textarea
                    id={`study-note-${item.entry_id}`}
                    value={note}
                    disabled={saving}
                    maxLength={10000}
                    rows={3}
                    className="text-base"
                    placeholder="어떻게 이해했는지, 다시 확인할 점을 내 말로 적어보세요."
                    onChange={(event) => setNote(item.entry_id, event.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                    <Button type="submit" size="sm" variant="outline" disabled={saving}>
                        {saving ? "저장 중…" : "메모 저장"}
                    </Button>
                    <Button type="button" size="sm" disabled={saving} onClick={() => void save(item.entry_id, !item.completed)}>
                        {item.completed ? <RotateCcw className="size-4" /> : <CheckCircle2 className="size-4" />}
                        {item.completed ? "다시 복습" : "복습 완료"}
                    </Button>
                </div>
            </form>
            {item.reviewed_at && <p className="text-xs text-muted-foreground">복습 완료 · {formatDateTime(item.reviewed_at)}</p>}
        </article>
    )
}
