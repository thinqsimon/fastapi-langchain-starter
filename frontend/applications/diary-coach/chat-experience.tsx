"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { ArrowUpRight, BookOpen, LoaderCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DraftReplaceDialog } from "@/components/diary/draft-replace-dialog"
import { useChatStore } from "@/store/chat"
import { useDiaryStore } from "@/store/diary"

const MASCOT = "/coach/cloud-coach.png"
const SUGGESTIONS = ["오늘 배운 개념을 예시로 설명해 줘", "어려운 내용을 함께 복습하고 싶어"]

export function CloudAvatar() {
    return <Image src={MASCOT} width={40} height={40} alt="" className="size-10 shrink-0 rounded-2xl object-cover" />
}

export function CoachWelcome() {
    const sendMessage = useChatStore((state) => state.sendMessage)
    const isStreaming = useChatStore((state) => state.isStreaming)

    return (
        <div className="flex min-h-0 flex-1 overflow-y-auto bg-linear-to-br from-sky-50/70 via-background to-background dark:from-sky-950/20">
            <div className="m-auto grid w-full max-w-5xl items-center gap-6 px-6 py-8 lg:grid-cols-[1.2fr_1fr] lg:gap-10 lg:px-12">
                <div className="order-2 min-w-0 lg:order-1">
                    <p className="mb-3 text-xs font-semibold tracking-widest text-sky-700 dark:text-sky-300">배움이 기록이 되는 곳</p>
                    <h1 className="text-2xl leading-snug font-semibold tracking-tight sm:text-3xl lg:text-4xl">
                        오늘의 궁금함,
                        <br />
                        구름 코치와 풀어볼까요?
                    </h1>
                    <p className="mt-4 text-sm leading-7 text-muted-foreground">
                        모르는 것은 편하게 물어보세요.
                        <br />
                        함께 나눈 대화는 나만의 배움일기로 정리할 수 있어요.
                    </p>
                    <div className="mt-6 flex flex-col gap-2">
                        {SUGGESTIONS.map((question) => (
                            <Button
                                key={question}
                                variant="outline"
                                disabled={isStreaming}
                                onClick={() => void sendMessage(question)}
                                className="h-auto min-h-11 justify-between gap-3 rounded-xl bg-background/80 px-4 py-3 text-left text-sm font-normal whitespace-normal"
                            >
                                {question}
                                <ArrowUpRight className="size-4 shrink-0 text-sky-600" />
                            </Button>
                        ))}
                    </div>
                    <p className="mt-4 text-xs leading-5 text-muted-foreground">대화하기 → 일기 초안 만들기 → 내 말로 다듬어 저장하기</p>
                </div>
                <div className="order-1 mx-auto lg:order-2">
                    <Image
                        src={MASCOT}
                        alt="헤드셋을 쓰고 웃는 구름 코치"
                        width={1254}
                        height={1254}
                        sizes="(min-width: 1024px) 320px, 144px"
                        preload
                        className="size-36 rounded-[2rem] shadow-xl shadow-sky-200/30 sm:size-44 lg:size-72 xl:size-80 dark:shadow-none"
                    />
                </div>
            </div>
        </div>
    )
}

export function CoachChatHeader() {
    const router = useRouter()
    const activeId = useChatStore((state) => state.activeId)
    const conversations = useChatStore((state) => state.conversations)
    const messages = useChatStore((state) => state.messages)
    const isStreaming = useChatStore((state) => state.isStreaming)
    const chatError = useChatStore((state) => state.error)
    const isDrafting = useDiaryStore((state) => state.isDrafting)
    const isSaving = useDiaryStore((state) => state.isSaving)
    const error = useDiaryStore((state) => state.error)
    const generateDraft = useDiaryStore((state) => state.generateDraftFromConversation)
    const [confirmSource, setConfirmSource] = useState<{ id: string; title: string } | null>(null)
    const mounted = useRef(false)

    useEffect(() => {
        mounted.current = true
        return () => {
            mounted.current = false
        }
    }, [])

    const canDraft = !!activeId && messages.some((message) => message.role === "assistant") && !isStreaming && !chatError && !isDrafting && !isSaving

    async function createDraft(source: { id: string; title: string }, replaceExisting = false) {
        setConfirmSource(null)
        if (await generateDraft(source.id, source.title, replaceExisting)) {
            if (mounted.current) router.push("/diary")
        }
    }

    function requestDraft() {
        if (!canDraft || !activeId) return
        const source = { id: activeId, title: conversations.find((conversation) => conversation.id === activeId)?.title ?? "현재 대화" }
        if (useDiaryStore.getState().hasUnsavedChanges) setConfirmSource(source)
        else void createDraft(source)
    }

    return (
        <>
            <div className="shrink-0 border-b bg-background px-4 py-3 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                        <CloudAvatar />
                        <div className="min-w-0">
                            <p className="text-sm font-semibold">구름 코치</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">질문은 편하게, 배움은 차곡차곡</p>
                        </div>
                    </div>
                    <Button onClick={requestDraft} disabled={!canDraft} aria-busy={isDrafting} className="min-h-10 w-full rounded-xl sm:w-auto">
                        {isDrafting ? <LoaderCircle className="size-4 animate-spin" /> : <BookOpen className="size-4" />}
                        {isDrafting ? "일기 초안 만드는 중…" : "이 대화로 일기 만들기"}
                    </Button>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground" role={isDrafting ? "status" : undefined}>
                    {isDrafting ? "대화 속 배움과 어려웠던 점을 정리하고 있어요." : "답변이 끝나면 초안을 만들 수 있어요. 내용을 확인한 뒤 직접 저장해 주세요."}
                </p>
                {error && (
                    <p role="alert" className="mt-2 text-sm text-destructive">
                        {error}
                    </p>
                )}
            </div>
            <DraftReplaceDialog
                open={!!confirmSource}
                onOpenChange={(open) => {
                    if (!open) setConfirmSource(null)
                }}
                onConfirm={() => {
                    if (confirmSource) void createDraft(confirmSource, true)
                }}
            />
        </>
    )
}
