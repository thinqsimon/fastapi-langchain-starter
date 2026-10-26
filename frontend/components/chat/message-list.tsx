"use client"

import { useEffect, useRef } from "react"

import type { Message } from "@/api"
import { LogoMark } from "@/components/brand-logo"
import { MarkdownView } from "@/components/markdown-view"
import { cn } from "@/lib/utils"

export type AssistantPresentation = { name: string; avatar: React.ReactNode }

export function MessageList({
    messages,
    streamingAnswer,
    isStreaming,
    emptyState,
    assistant,
}: {
    messages: Message[]
    streamingAnswer: string
    isStreaming: boolean
    emptyState?: React.ReactNode
    assistant?: AssistantPresentation
}) {
    const bottomRef = useRef<HTMLDivElement>(null)

    // 새 토큰이 올 때마다 맨 아래로 따라간다.
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages, streamingAnswer])

    if (messages.length === 0 && !isStreaming) {
        return (
            emptyState ?? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                    <LogoMark size={56} decorative className="opacity-90" />
                    무엇이든 물어보세요.
                </div>
            )
        )
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4 sm:p-6" role="region" aria-label="대화 내용">
            {messages.map((message) => (
                <Bubble key={message.id} role={message.role} assistant={assistant}>
                    {message.role === "assistant" ? <MarkdownView>{message.content}</MarkdownView> : message.content}
                </Bubble>
            ))}

            {isStreaming && (
                <Bubble role="assistant" pending assistant={assistant}>
                    {streamingAnswer ? <MarkdownView>{streamingAnswer}</MarkdownView> : <span className="animate-pulse">…</span>}
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
    assistant,
}: {
    role: Message["role"]
    /** 아직 서버에 저장되지 않은, 스트리밍 중인 응답 */
    pending?: boolean
    children: React.ReactNode
    assistant?: AssistantPresentation
}) {
    const isUser = role === "user"
    return (
        <div className={cn("flex gap-2 sm:gap-3", isUser ? "justify-end" : "justify-start")}>
            {!isUser && assistant && (
                <div aria-hidden="true" className="shrink-0">
                    {assistant.avatar}
                </div>
            )}
            <div
                data-role={role}
                data-pending={pending || undefined}
                className={cn(
                    "max-w-[85%] min-w-0 rounded-2xl px-4 py-3 text-sm wrap-anywhere sm:max-w-[80%]",
                    isUser ? "bg-primary whitespace-pre-wrap text-primary-foreground" : "bg-muted"
                )}
            >
                {!isUser && assistant && <p className="mb-2 text-xs font-semibold text-muted-foreground">{assistant.name}</p>}
                {children}
            </div>
        </div>
    )
}
