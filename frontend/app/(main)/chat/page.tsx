"use client"

import { useEffect } from "react"

import { ConversationSidebar } from "@/components/chat/conversation-sidebar"
import { MessageInput } from "@/components/chat/message-input"
import { MessageList } from "@/components/chat/message-list"
import { useChatStore } from "@/store/chat"

export default function ChatPage() {
    const loadConversations = useChatStore((state) => state.loadConversations)
    const messages = useChatStore((state) => state.messages)
    const streamingAnswer = useChatStore((state) => state.streamingAnswer)
    const isStreaming = useChatStore((state) => state.isStreaming)
    const error = useChatStore((state) => state.error)
    const sendMessage = useChatStore((state) => state.sendMessage)

    useEffect(() => {
        void loadConversations()
    }, [loadConversations])

    return (
        <div className="flex flex-1 overflow-hidden">
            <ConversationSidebar />

            <section className="flex min-w-0 flex-1 flex-col">
                <MessageList messages={messages} streamingAnswer={streamingAnswer} isStreaming={isStreaming} />

                {error && (
                    <p role="alert" className="px-4 pb-2 text-sm text-destructive sm:px-6">
                        {error}
                    </p>
                )}

                <MessageInput disabled={isStreaming} onSend={(content) => void sendMessage(content)} />
            </section>
        </div>
    )
}
