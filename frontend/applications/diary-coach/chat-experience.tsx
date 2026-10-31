"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { ArrowUpRight, BookOpen, LoaderCircle, Plus, SquarePlay } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DraftReplaceDialog } from "@/components/diary/draft-replace-dialog"
import { errorMessage } from "@/lib/api"
import { DEFAULT_ANSWER_LEVEL, answerLevelLabel } from "@/lib/answer-level"
import { useAnswerLevelStore } from "@/store/answer-level"
import { useAuthStore } from "@/store/auth"
import { useChatStore } from "@/store/chat"
import { useDiaryStore } from "@/store/diary"

const MASCOT = "/coach/cloud-coach.png"
const SUGGESTIONS = ["오늘 배운 개념을 예시로 설명해 줘", "어려운 내용을 함께 복습하고 싶어"]
/** 사용법 동영상. 새 탭으로 열고, 유튜브 앱이 있는 폰에서는 앱이 열린다. */
export const GUIDE_VIDEO_URL = "https://youtu.be/MH6wL-0Qui0"

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
                    <p className="mt-4 text-xs leading-5 text-muted-foreground">대화하기 → 입력칸 왼쪽 + 메뉴로 일기 초안 만들기 → 내 말로 다듬어 저장하기</p>
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

/** "이 대화로 일기 만들기" 동작. 메뉴(+)와 상단 안내가 같은 상태를 본다. */
function useDiaryDraftAction() {
    const router = useRouter()
    const activeId = useChatStore((state) => state.activeId)
    const conversations = useChatStore((state) => state.conversations)
    const messages = useChatStore((state) => state.messages)
    const isStreaming = useChatStore((state) => state.isStreaming)
    const chatError = useChatStore((state) => state.error)
    const isDrafting = useDiaryStore((state) => state.isDrafting)
    const isSaving = useDiaryStore((state) => state.isSaving)
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

    return {
        canDraft,
        isDrafting,
        requestDraft,
        confirmSource,
        dismissConfirm: () => setConfirmSource(null),
        confirmReplace: () => {
            if (confirmSource) void createDraft(confirmSource, true)
        },
    }
}

/** 채팅 상단. 코치 소개와 사용법 동영상 링크, 일기 초안 진행 상태를 보여 준다. */
export function CoachChatHeader() {
    const isDrafting = useDiaryStore((state) => state.isDrafting)
    const error = useDiaryStore((state) => state.error)

    return (
        <div className="shrink-0 border-b bg-background px-4 py-3 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <CloudAvatar />
                    <div className="min-w-0">
                        <p className="text-sm font-semibold">구름 코치</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">질문은 편하게, 배움은 차곡차곡</p>
                    </div>
                </div>
                <a
                    href={GUIDE_VIDEO_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${buttonVariants({ variant: "outline" })} min-h-10 w-full rounded-xl sm:w-auto`}
                >
                    <SquarePlay className="size-4 text-red-600" />
                    사용법 동영상 열기
                </a>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground" role={isDrafting ? "status" : undefined}>
                {isDrafting
                    ? "대화 속 배움과 어려웠던 점을 정리하고 있어요."
                    : "일기 초안은 입력칸 왼쪽 + 메뉴에서 만들 수 있어요. 답변이 끝난 뒤 내용을 확인하고 직접 저장해 주세요."}
            </p>
            {error && (
                <p role="alert" className="mt-2 text-sm text-destructive">
                    {error}
                </p>
            )}
        </div>
    )
}

/** 입력칸 왼쪽의 + 버튼. 누르면 '이 대화로 일기 만들기' 같은 부가 기능 메뉴가 열린다. */
export function CoachComposerMenu() {
    const draft = useDiaryDraftAction()
    const level = useAnswerLevelChoice()
    const [open, setOpen] = useState(false)

    return (
        <>
            <DropdownMenu
                open={open}
                onOpenChange={(next) => {
                    setOpen(next)
                    if (next) level.clearError()
                }}
            >
                <DropdownMenuTrigger
                    render={
                        <Button
                            type="button"
                            variant="outline"
                            size="icon-lg"
                            className="size-10 shrink-0 rounded-full"
                            aria-label={draft.isDrafting ? "일기 초안 만드는 중…" : "추가 기능"}
                            title={draft.isDrafting ? "일기 초안 만드는 중…" : `추가 기능 · 답변 수준 ${level.label}`}
                            aria-busy={draft.isDrafting}
                            disabled={draft.isDrafting}
                        />
                    }
                >
                    {draft.isDrafting ? <LoaderCircle className="size-5 animate-spin" /> : <Plus className="size-5" />}
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-60">
                    <DropdownMenuItem disabled={!draft.canDraft} onClick={draft.requestDraft} className="min-h-10 px-2">
                        <BookOpen />
                        <span className="flex flex-col">
                            <span>이 대화로 일기 만들기</span>
                            {!draft.canDraft && <span className="text-xs text-muted-foreground">답변이 끝나면 만들 수 있어요</span>}
                        </span>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="min-h-10 px-2" render={<a href={GUIDE_VIDEO_URL} target="_blank" rel="noopener noreferrer" />}>
                        <SquarePlay className="text-red-600" />
                        사용법 동영상 열기
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {/* 답변 수준(CHAT-03): 대화 중에도 바로 바꾼다. 설정 화면 카드와 같은 값을 쓴다. */}
                    <DropdownMenuGroup>
                        <DropdownMenuLabel>
                            답변 수준{level.chosen === null && <span className="ml-1 font-normal">· 고르기 전에는 {level.defaultLabel}</span>}
                        </DropdownMenuLabel>
                        <DropdownMenuRadioGroup
                            value={level.chosen === null ? "" : String(level.chosen)}
                            onValueChange={(value) => {
                                void level.choose(Number(value)).then((ok) => {
                                    if (ok) setOpen(false)
                                })
                            }}
                        >
                            {level.levels.map((item) => (
                                <DropdownMenuRadioItem key={item.level} value={String(item.level)} disabled={level.busy} className="min-h-9 px-2">
                                    {item.level}단계 {item.name}
                                </DropdownMenuRadioItem>
                            ))}
                        </DropdownMenuRadioGroup>
                        {level.error && (
                            <p role="alert" className="px-2 py-1 text-xs text-destructive">
                                {level.error}
                            </p>
                        )}
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>
            <DraftReplaceDialog
                open={!!draft.confirmSource}
                onOpenChange={(open) => {
                    if (!open) draft.dismissConfirm()
                }}
                onConfirm={draft.confirmReplace}
            />
        </>
    )
}

/** + 메뉴의 답변 수준 고르기. 저장에 성공하면 true(메뉴를 닫는다). */
function useAnswerLevelChoice() {
    const user = useAuthStore((state) => state.user)
    const updateAnswerLevel = useAuthStore((state) => state.updateAnswerLevel)
    const levels = useAnswerLevelStore((state) => state.levels)
    const load = useAnswerLevelStore((state) => state.load)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const chosen = user?.answer_level ?? null

    useEffect(() => {
        void load()
    }, [load])

    async function choose(level: number): Promise<boolean> {
        if (!Number.isInteger(level) || level === chosen) return true
        setBusy(true)
        setError(null)
        try {
            await updateAnswerLevel(level)
            return true
        } catch (caught) {
            setError(errorMessage(caught, "답변 수준을 저장하지 못했습니다."))
            return false
        } finally {
            setBusy(false)
        }
    }

    return {
        levels,
        chosen,
        busy,
        error,
        clearError: () => setError(null),
        choose,
        label: answerLevelLabel(chosen ?? DEFAULT_ANSWER_LEVEL, levels),
        defaultLabel: answerLevelLabel(DEFAULT_ANSWER_LEVEL, levels),
    }
}
