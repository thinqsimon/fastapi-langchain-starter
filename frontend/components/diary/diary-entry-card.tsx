"use client"

import type { DiaryEntry } from "@/api"
import { MarkdownView } from "@/components/markdown-view"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function Item({ label, children }: { label: string; children: string }) {
    return (
        <div className="flex flex-col gap-1">
            <span className="font-medium">{label}</span>
            <p className="whitespace-pre-wrap text-muted-foreground">{children}</p>
        </div>
    )
}

/** 저장한 일기 한 편. '내일 할 것'은 있을 때만, 푸터는 맨 끝에 보여준다. */
export function DiaryEntryCard({ entry, onEdit, onDelete }: { entry: DiaryEntry; onEdit: () => void; onDelete: () => void }) {
    return (
        <Card data-slot="diary-entry">
            <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                    <CardTitle className="text-base break-words">{entry.title}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                        {entry.entry_date}
                        {entry.conversation_id ? " · 채팅으로 작성" : ""}
                    </p>
                </div>
                <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="outline" onClick={onEdit}>
                        수정
                    </Button>
                    <Button size="sm" variant="outline" aria-label={`${entry.title} 삭제`} onClick={onDelete}>
                        삭제
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
                <Item label="배운 것">{entry.learned}</Item>
                {entry.learned_detail.trim() && (
                    <details className="rounded-lg border px-3 py-2">
                        <summary className="cursor-pointer font-medium">배운 내용 상세</summary>
                        <MarkdownView className="mt-3">{entry.learned_detail}</MarkdownView>
                    </details>
                )}
                <Item label="어려웠던 것">{entry.difficult}</Item>
                {entry.next_plan && <Item label="내일 할 것">{entry.next_plan}</Item>}
                {entry.footer && (
                    <p data-slot="diary-footer" className="border-t pt-3 whitespace-pre-wrap text-muted-foreground">
                        {entry.footer}
                    </p>
                )}
            </CardContent>
        </Card>
    )
}
