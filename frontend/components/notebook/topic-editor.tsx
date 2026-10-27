"use client"

import { useState, type ChangeEvent } from "react"

import { DiaryDocument } from "@/components/diary/diary-document"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { TopicForm } from "@/store/notebook"

/** /study-notes 노트가 쓰는 유형. 자유 입력도 된다. */
const KINDS = ["개념", "문제해결", "도구·명령어", "설계결정", "워크플로"]
const DIFFICULTIES = [1, 2, 3, 4, 5]

/** 주제 입력칸. 새 주제와 수정이 함께 쓴다(diary-editor 구조). */
export function TopicEditor({
    value,
    isSaving,
    submitLabel,
    onChange,
    onSubmit,
    onCancel,
}: {
    value: TopicForm
    isSaving: boolean
    submitLabel: string
    onChange: (next: TopicForm) => void
    onSubmit: () => void
    onCancel: () => void
}) {
    const [isPreview, setIsPreview] = useState(false)

    const bind = (name: keyof TopicForm) => ({
        id: `topic-${name}`,
        value: value[name],
        disabled: isSaving,
        onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => onChange({ ...value, [name]: event.target.value }),
    })

    return (
        <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
                event.preventDefault()
                onSubmit()
            }}
        >
            <div className="flex flex-col gap-2">
                <Label htmlFor="topic-title">제목</Label>
                <Input {...bind("title")} required maxLength={200} />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex min-w-0 flex-col gap-2">
                    <Label htmlFor="topic-kind">유형</Label>
                    <Input {...bind("kind")} list="topic-kind-options" maxLength={30} placeholder="개념, 문제해결 …" />
                    <datalist id="topic-kind-options">
                        {KINDS.map((kind) => (
                            <option key={kind} value={kind} />
                        ))}
                    </datalist>
                </div>
                <div className="flex min-w-0 flex-col gap-2">
                    <Label htmlFor="topic-tags">태그</Label>
                    <Input {...bind("tags")} placeholder="쉼표로 구분" />
                </div>
                <div className="flex min-w-0 flex-col gap-2">
                    <Label htmlFor="topic-difficulty">난이도</Label>
                    <select
                        {...bind("difficulty")}
                        className="h-8 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 md:[@media(pointer:fine)]:text-sm"
                    >
                        <option value="">없음</option>
                        {DIFFICULTIES.map((level) => (
                            <option key={level} value={String(level)}>
                                {"★".repeat(level)}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <Label htmlFor="topic-content">내용</Label>
                    <div className="flex gap-1">
                        <Button
                            type="button"
                            size="xs"
                            variant={isPreview ? "ghost" : "secondary"}
                            aria-pressed={!isPreview}
                            onClick={() => setIsPreview(false)}
                        >
                            작성
                        </Button>
                        <Button type="button" size="xs" variant={isPreview ? "secondary" : "ghost"} aria-pressed={isPreview} onClick={() => setIsPreview(true)}>
                            미리보기
                        </Button>
                    </div>
                </div>
                <Textarea
                    {...bind("content")}
                    rows={16}
                    hidden={isPreview}
                    className="max-h-[60vh] overflow-y-auto font-mono text-base md:[@media(pointer:fine)]:text-xs"
                />
                {isPreview && (
                    <div className="max-h-[60vh] overflow-y-auto rounded-lg border px-3 py-2">
                        {value.content.trim() ? (
                            <DiaryDocument markdown={value.content} />
                        ) : (
                            <p className="text-sm text-muted-foreground">미리 볼 내용이 없습니다.</p>
                        )}
                    </div>
                )}
                <p className="text-xs text-muted-foreground">마크다운으로 씁니다. 소제목은 &apos;### 소제목&apos;으로 나눕니다.</p>
            </div>

            <div className="flex gap-2">
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? "저장 중…" : submitLabel}
                </Button>
                <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
                    취소
                </Button>
            </div>
        </form>
    )
}
