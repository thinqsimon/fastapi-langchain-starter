"use client"

import { useEffect, useRef } from "react"

import type { Message } from "@/lib/api"
import { LogoMark } from "@/components/brand-logo"
import { MarkdownView } from "@/components/markdown-view"
import { answeredByLabel } from "@/lib/llm-labels"
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
                <Bubble
                    key={message.id}
                    role={message.role}
                    assistant={assistant}
                    answeredBy={message.role === "assistant" ? answeredByLabel(message.provider, message.model) : null}
                >
                    {message.role === "assistant" ? <MarkdownView>{message.content}</MarkdownView> : message.content}
                </Bubble>
            ))}

            {isStreaming && (
                <Bubble role="assistant" pending assistant={assistant}>
                    {streamingAnswer ? <MarkdownView>{streamingAnswer}</MarkdownView> : <TypingDots />}
                </Bubble>
            )}

            <div ref={bottomRef} />
        </div>
    )
}

/**
 * 첫 글자가 오기 전의 대기 표시. 점 세 개가 차례로 튀어 올라 멈추지 않았음을 보여 준다.
 * 동작 줄이기 설정이면 튀지 않고 차례로 깜빡이기만 한다.
 */
function TypingDots() {
    return (
        // relative: 숨김 글자(sr-only)가 메시지 스크롤 영역 밖으로 빠져나가 페이지 전체가 스크롤되지 않게 한다.
        <span data-slot="typing-indicator" className="relative flex h-5 items-center gap-1.5">
            {[0, 150, 300].map((delay) => (
                <span
                    key={delay}
                    aria-hidden="true"
                    className="size-2 animate-typing-dot rounded-full bg-muted-foreground motion-reduce:animate-pulse"
                    style={{ animationDelay: `${delay}ms` }}
                />
            ))}
            <span className="sr-only">답변을 준비하고 있어요</span>
        </span>
    )
}

function Bubble({
    role,
    pending = false,
    children,
    assistant,
    answeredBy,
}: {
    role: Message["role"]
    /** 아직 서버에 저장되지 않은, 스트리밍 중인 응답 */
    pending?: boolean
    children: React.ReactNode
    assistant?: AssistantPresentation
    /** 답한 공급자·모델 표기(예: "Gemini · gemini-2.5-flash"). 없으면 표시하지 않는다. */
    answeredBy?: string | null
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
                {answeredBy && (
                    <p data-slot="message-model" className="mt-2 text-[11px] text-muted-foreground/80">
                        {answeredBy}
                    </p>
                )}
            </div>
        </div>
    )
}
