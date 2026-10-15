"use client"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import type { DiaryDraft } from "@/api"

const FIELDS = [
    { name: "learned", label: "오늘 배운 것" },
    { name: "difficult", label: "어려웠던 것" },
    { name: "next_plan", label: "내일 할 것" },
] as const

export function DiaryEditor({
    value,
    isSaving,
    submitLabel,
    onChange,
    onSubmit,
    onCancel,
}: {
    value: DiaryDraft
    isSaving: boolean
    submitLabel: string
    onChange: (next: DiaryDraft) => void
    onSubmit: () => void
    onCancel?: () => void
}) {
    return (
        <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
                event.preventDefault()
                onSubmit()
            }}
        >
            {FIELDS.map((field) => (
                <div key={field.name} className="flex flex-col gap-2">
                    <Label htmlFor={field.name}>{field.label}</Label>
                    <textarea
                        id={field.name}
                        value={value[field.name]}
                        onChange={(event) => onChange({ ...value, [field.name]: event.target.value })}
                        rows={3}
                        required
                        className="resize-y rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                    />
                </div>
            ))}

            <div className="flex gap-2">
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? "저장 중…" : submitLabel}
                </Button>
                {onCancel && (
                    <Button type="button" variant="outline" onClick={onCancel}>
                        취소
                    </Button>
                )}
            </div>
        </form>
    )
}
