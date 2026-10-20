"use client"

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
    const generateDraft = useDiaryStore((state) => state.generateDraft)

    const isEmpty = conversations.length === 0

    return (
        <div className="flex flex-col gap-2 rounded-lg border p-3">
            <Label htmlFor="diary-conversation">일기로 만들 채팅</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
                <select
                    id="diary-conversation"
                    value={selectedId}
                    disabled={isEmpty}
                    onChange={(event) => selectConversation(event.target.value)}
                    className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
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
                <Button type="button" onClick={() => void generateDraft()} disabled={!selectedId || isDrafting}>
                    {isDrafting ? "정리 중…" : "초안 만들기"}
                </Button>
            </div>
            <p className="text-xs text-muted-foreground">
                이미 일기로 만든 채팅은 그 뒤에 새 대화가 있을 때만 보이고, 새 대화만 일기로 정리합니다. 채팅 없이 아래에 직접 써도 됩니다.
            </p>
        </div>
    )
}
