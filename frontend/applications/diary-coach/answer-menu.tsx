"use client"

import { Check, Ellipsis, MessageCircleQuestion, Settings } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Message } from "@/lib/api"
import { answerLevelLabel } from "@/lib/answer-level"
import { useAnswerLevelStore } from "@/store/answer-level"
import { useChatStore } from "@/store/chat"
import { usePreferencesStore } from "@/store/preferences"

const LEVELS = [1, 2, 3, 4, 5]

/**
 * 코치 답변 아래 '3단계 기초 …' 버튼(CHAT-04). 이 답변을 만든 수준을 보여 주고, 누르면
 * 같은 질문을 다른 수준으로 한 번 더 묻거나(설정은 그대로) 함께 받은 추천 질문을 바로 보낸다.
 */
export function CoachAnswerMenu({ message, question }: { message: Message; question: string | null }) {
    const router = useRouter()
    const levels = useAnswerLevelStore((state) => state.levels)
    const loadLevels = useAnswerLevelStore((state) => state.load)
    const suggestOn = usePreferencesStore((state) => state.preferences?.suggest_questions ?? false)
    const isStreaming = useChatStore((state) => state.isStreaming)
    const sendMessage = useChatStore((state) => state.sendMessage)
    const level = message.answer_level
    // 이 칸이 생기기 전의 답변은 수준을 모른다. 그래도 다른 수준으로 다시 물을 수는 있다.
    const label = level ? answerLevelLabel(level, levels) : "답변 수준"
    // 서버를 막 바꾼 직후(배포 중)에는 이 칸이 오지 않을 수 있다.
    const suggestions = message.suggested_questions ?? []

    useEffect(() => {
        void loadLevels()
    }, [loadLevels])

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        data-slot="answer-level-button"
                        aria-label={`${label} 메뉴 — 다른 수준으로 다시 답변, 추천 질문`}
                        className="h-6 rounded-full bg-background/70 font-normal text-muted-foreground pointer-coarse:h-7"
                    />
                }
            >
                {label}
                <Ellipsis data-icon="inline-end" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)]">
                <DropdownMenuGroup>
                    <DropdownMenuLabel>다른 수준으로 다시 답변</DropdownMenuLabel>
                    {LEVELS.map((item) => {
                        const current = item === level
                        return (
                            <DropdownMenuItem
                                key={item}
                                disabled={current || isStreaming || !question}
                                className={current ? "font-medium data-disabled:opacity-100" : undefined}
                                onClick={() => {
                                    if (question) void sendMessage(question, { answerLevel: item })
                                }}
                            >
                                {current ? <Check /> : <span aria-hidden="true" className="size-4" />}
                                {answerLevelLabel(item, levels)}
                                {current && <span className="ml-auto text-xs font-normal text-muted-foreground">지금 답변</span>}
                            </DropdownMenuItem>
                        )
                    })}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuLabel>이어서 물어보기</DropdownMenuLabel>
                    {suggestions.map((suggestion) => (
                        <DropdownMenuItem key={suggestion} disabled={isStreaming} className="items-start" onClick={() => void sendMessage(suggestion)}>
                            <MessageCircleQuestion className="mt-0.5" />
                            {suggestion}
                        </DropdownMenuItem>
                    ))}
                    {suggestions.length === 0 && (
                        <p data-slot="suggestions-empty" className="px-1.5 py-1 text-xs text-muted-foreground">
                            {suggestOn ? "이 답변에는 추천 질문이 없어요." : "설정에서 ‘추천 질문 함께 받기’를 켜면 다음 답변부터 질문 3개가 여기 나와요."}
                        </p>
                    )}
                    {suggestions.length === 0 && !suggestOn && (
                        <DropdownMenuItem onClick={() => router.push("/settings")}>
                            <Settings />
                            설정 열기
                        </DropdownMenuItem>
                    )}
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
