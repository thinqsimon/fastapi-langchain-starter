"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useChatStore } from "@/store/chat"

export function ConversationSidebar() {
    const conversations = useChatStore((state) => state.conversations)
    const activeId = useChatStore((state) => state.activeId)
    const openConversation = useChatStore((state) => state.openConversation)
    const startNewConversation = useChatStore((state) => state.startNewConversation)
    const removeConversation = useChatStore((state) => state.removeConversation)

    return (
        <aside className="flex w-64 shrink-0 flex-col border-r">
            <div className="p-3">
                <Button className="w-full" onClick={() => void startNewConversation()}>
                    새 대화
                </Button>
            </div>

            <nav aria-label="대화 목록" className="flex-1 overflow-y-auto px-2 pb-3">
                {conversations.length === 0 && <p className="px-2 py-4 text-sm text-muted-foreground">아직 대화가 없습니다.</p>}

                <ul className="flex flex-col gap-1">
                    {conversations.map((conversation) => (
                        <li key={conversation.id} className="group flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => void openConversation(conversation.id)}
                                className={cn(
                                    "flex-1 truncate rounded-md px-3 py-2 text-left text-sm hover:bg-muted",
                                    conversation.id === activeId && "bg-muted font-medium"
                                )}
                            >
                                {conversation.title}
                            </button>
                            <button
                                type="button"
                                aria-label={`${conversation.title} 삭제`}
                                onClick={() => void removeConversation(conversation.id)}
                                className="px-2 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive"
                            >
                                삭제
                            </button>
                        </li>
                    ))}
                </ul>
            </nav>
        </aside>
    )
}
