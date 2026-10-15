"use client"

import { useEffect, useRef } from "react"

import type { Message } from "@/api"
import { cn } from "@/lib/utils"

export function MessageList({ messages, streamingAnswer, isStreaming }: { messages: Message[]; streamingAnswer: string; isStreaming: boolean }) {
    const bottomRef = useRef<HTMLDivElement>(null)

    // 새 토큰이 올 때마다 맨 아래로 따라간다.
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages, streamingAnswer])

    if (messages.length === 0 && !isStreaming) {
        return <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">무엇이든 물어보세요.</div>
    }

    return (
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
            {messages.map((message) => (
                <Bubble key={message.id} role={message.role}>
                    {message.content}
                </Bubble>
            ))}

            {isStreaming && (
                <Bubble role="assistant" pending>
                    {streamingAnswer || <span className="animate-pulse">…</span>}
                </Bubble>
            )}

            <div ref={bottomRef} />
        </div>
    )
}

function Bubble({
    role,
    pending = false,
    children,
}: {
    role: Message["role"]
    /** 아직 서버에 저장되지 않은, 스트리밍 중인 응답 */
    pending?: boolean
    children: React.ReactNode
}) {
    const isUser = role === "user"
    return (
        <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
            <div
                data-role={role}
                data-pending={pending || undefined}
                className={cn("max-w-[80%] rounded-lg px-4 py-2 text-sm whitespace-pre-wrap", isUser ? "bg-primary text-primary-foreground" : "bg-muted")}
            >
                {children}
            </div>
        </div>
    )
}
