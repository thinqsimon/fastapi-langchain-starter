"use client"

import Link from "next/link"
import { useState, type ChangeEvent } from "react"

import type { DiaryForm } from "@/lib/api"
import { MarkdownView } from "@/components/markdown-view"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function DiaryEditor({
    value,
    footer,
    isSaving,
    submitLabel,
    onChange,
    onSubmit,
    onCancel,
}: {
    value: DiaryForm
    /** 저장하면 맨 끝에 붙을 푸터. 수정할 때는 넘기지 않는다(이미 붙은 푸터는 그대로). */
    footer?: string
    isSaving: boolean
    submitLabel: string
    onChange: (next: DiaryForm) => void
    onSubmit: () => void
    onCancel?: () => void
}) {
    const [isPreview, setIsPreview] = useState(false)

    const bind = (name: keyof DiaryForm) => ({
        id: `diary-${name}`,
        value: value[name],
        disabled: isSaving,
        onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...value, [name]: event.target.value }),
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
                <Label htmlFor="diary-title">제목</Label>
                <Input {...bind("title")} required maxLength={200} />
                <p className="text-xs text-muted-foreground">날짜와 그날 배운 핵심 단어. 같은 날 두 번째 일기부터는 날짜 뒤에 (2), (3)이 붙습니다.</p>
            </div>

            <div className="flex flex-col gap-2">
                <Label htmlFor="diary-learned">오늘 배운 것</Label>
                <Textarea {...bind("learned")} rows={3} required />
            </div>

            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <Label htmlFor="diary-learned_detail">배운 내용 상세</Label>
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
                    {...bind("learned_detail")}
                    rows={10}
                    hidden={isPreview}
                    className="max-h-[60vh] overflow-y-auto font-mono text-base md:[@media(pointer:fine)]:text-xs"
                />
                {isPreview && (
                    <div className="max-h-[60vh] overflow-y-auto rounded-lg border px-3 py-2">
                        {value.learned_detail.trim() ? (
                            <MarkdownView>{value.learned_detail}</MarkdownView>
                        ) : (
                            <p className="text-sm text-muted-foreground">미리 볼 내용이 없습니다.</p>
                        )}
                    </div>
                )}
                <p className="text-xs text-muted-foreground">
                    주제마다 &apos;### 소제목&apos;으로 나눠 씁니다. 복습할 때 이것만 읽어도 이해되도록 자세히 적어 두세요.
                </p>
            </div>

            <div className="flex flex-col gap-2">
                <Label htmlFor="diary-difficult">어려웠던 것</Label>
                <Textarea {...bind("difficult")} rows={3} required />
            </div>

            <div className="flex flex-col gap-2">
                <Label htmlFor="diary-next_plan">내일 할 것</Label>
                <Textarea {...bind("next_plan")} rows={2} placeholder="대화에 없으면 비워 두세요." />
                <p className="text-xs text-muted-foreground">비워 두면 이 항목 없이 저장됩니다.</p>
            </div>

            {footer !== undefined && (
                <p className="text-xs text-muted-foreground">
                    {footer ? <>저장하면 맨 끝에 &ldquo;{footer}&rdquo; 문구가 붙습니다. </> : <>푸터가 비어 있어 아무것도 붙지 않습니다. </>}
                    <Link href="/settings" className="underline underline-offset-4">
                        설정에서 바꾸기
                    </Link>
                </p>
            )}

            <div className="flex gap-2">
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? "저장 중…" : submitLabel}
                </Button>
                {onCancel && (
                    <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
                        취소
                    </Button>
                )}
            </div>
        </form>
    )
}
