"use client"

import { useEffect, useRef, useState } from "react"
import { ApplicationChatHeader, ApplicationComposerMenu, applicationChatPresentation } from "@/applications/components"

import { AnswerLevelChooser } from "@/components/chat/answer-level-chooser"
import { ConversationSidebar } from "@/components/chat/conversation-sidebar"
import { MessageInput } from "@/components/chat/message-input"
import { MessageList } from "@/components/chat/message-list"
import { PaneResizer } from "@/components/pane-resizer"
import { cn } from "@/lib/utils"
import { useChatStore } from "@/store/chat"
import { CHAT_LIST_WIDTH, useLayoutStore } from "@/store/layout"

/** 대화 칸이 최소한 이만큼은 남도록 목록을 넓힐 때 상한을 둔다(px). */
const MIN_CHAT_WIDTH = 360

export default function ChatPage() {
    const loadConversations = useChatStore((state) => state.loadConversations)
    const messages = useChatStore((state) => state.messages)
    const streamingAnswer = useChatStore((state) => state.streamingAnswer)
    const isStreaming = useChatStore((state) => state.isStreaming)
    const error = useChatStore((state) => state.error)
    const sendMessage = useChatStore((state) => state.sendMessage)
    const desktopSidebarOpen = useLayoutStore((state) => state.desktopSidebarOpen)
    const listWidth = useLayoutStore((state) => state.listWidth)
    const restoreListWidth = useLayoutStore((state) => state.restoreListWidth)
    const setListWidth = useLayoutStore((state) => state.setListWidth)
    const resetListWidth = useLayoutStore((state) => state.resetListWidth)
    const row = useRef<HTMLDivElement>(null)
    const [resizing, setResizing] = useState(false)

    useEffect(() => {
        restoreListWidth()
        void loadConversations()
    }, [restoreListWidth, loadConversations])

    return (
        <div ref={row} className={cn("flex flex-1 overflow-hidden", resizing && "cursor-col-resize select-none")}>
            <ConversationSidebar />
            {/* 넓은 화면에서 목록을 펼쳐 둔 동안만 보인다. 끌어서(또는 화살표 키로) 목록 너비를 바꾸고, 두 번 누르면 기본 너비. */}
            {desktopSidebarOpen && (
                <PaneResizer
                    slot="chat-list-resizer"
                    label="대화 목록 너비 조절"
                    container={row}
                    width={listWidth}
                    limits={CHAT_LIST_WIDTH}
                    minRest={MIN_CHAT_WIDTH}
                    onResize={setListWidth}
                    onReset={resetListWidth}
                    onDraggingChange={setResizing}
                />
            )}

            <section className="flex min-w-0 flex-1 flex-col">
                <ApplicationChatHeader />
                {/* 답변 수준을 아직 고르지 않았으면 한 번 묻는다(CHAT-03). */}
                <AnswerLevelChooser />
                <MessageList messages={messages} streamingAnswer={streamingAnswer} isStreaming={isStreaming} {...applicationChatPresentation()} />

                {error && (
                    <p role="alert" className="px-4 pb-2 text-sm text-destructive sm:px-6">
                        {error}
                    </p>
                )}

                <MessageInput disabled={isStreaming} onSend={(content) => void sendMessage(content)} leading={<ApplicationComposerMenu />} />
            </section>
        </div>
    )
}
