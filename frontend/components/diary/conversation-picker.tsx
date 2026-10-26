"use client"

import { useState } from "react"
import { DraftReplaceDialog } from "@/components/diary/draft-replace-dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { formatDateTime } from "@/lib/date"
import { useDiaryStore } from "@/store/diary"

/** 일기로 만들 채팅을 고른다. 이미 일기로 만든 채팅은 그 뒤에 새 대화가 있을 때만 나온다. */
export function ConversationPicker() {
    const conversations = useDiaryStore((state) => state.conversations)
    const selectedId = useDiaryStore((state) => state.selectedConversationId)
    const isDrafting = useDiaryStore((state) => state.isDrafting)
    const selectConversation = useDiaryStore((state) => state.selectConversation)
    const generateDraft = useDiaryStore((state) => state.generateDraftFromConversation)
    const isSaving = useDiaryStore((state) => state.isSaving)
    const [confirmSource, setConfirmSource] = useState<{ id: string; title: string } | null>(null)

    function requestDraft() {
        const source = { id: selectedId, title: conversations.find((c) => c.id === selectedId)?.title ?? "" }
        if (useDiaryStore.getState().hasUnsavedChanges) setConfirmSource(source)
        else void generateDraft(source.id, source.title)
    }

    const isEmpty = conversations.length === 0

    return (
        <div className="flex flex-col gap-2 rounded-lg border p-3">
            <Label htmlFor="diary-conversation">일기로 만들 채팅</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
                <select
                    id="diary-conversation"
                    value={selectedId}
                    disabled={isEmpty || isDrafting || isSaving}
                    onChange={(event) => selectConversation(event.target.value)}
                    className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 md:h-8 md:[@media(pointer:fine)]:text-sm"
                >
                    {isEmpty ? (
                        <option value="">새 대화가 있는 채팅이 없습니다</option>
                    ) : (
                        conversations.map((conversation) => (
                            <option key={conversation.id} value={conversation.id}>
                                {conversation.title} · 마지막 대화 {formatDateTime(conversation.last_message_at)}
                                {conversation.diary_count > 0 ? ` · 새 대화 (일기 ${conversation.diary_count}편 있음)` : ""}
                            </option>
                        ))
                    )}
                </select>
                <Button type="button" onClick={requestDraft} disabled={!selectedId || isDrafting || isSaving}>
                    {isDrafting ? "정리 중…" : "초안 만들기"}
                </Button>
            </div>
            <DraftReplaceDialog
                open={!!confirmSource}
                onOpenChange={(open) => {
                    if (!open) setConfirmSource(null)
                }}
                onConfirm={() => {
                    if (confirmSource) void generateDraft(confirmSource.id, confirmSource.title, true)
                    setConfirmSource(null)
                }}
            />
            <p className="text-xs text-muted-foreground">
                이미 일기로 만든 채팅은 그 뒤에 새 대화가 있을 때만 보이고, 새 대화만 일기로 정리합니다. 채팅 없이 아래에 직접 써도 됩니다.
            </p>
        </div>
    )
}
