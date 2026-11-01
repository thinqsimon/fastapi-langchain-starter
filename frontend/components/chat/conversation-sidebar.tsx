"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { Ellipsis, Pencil, Trash2 } from "lucide-react"

import type { Conversation } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useMediaQuery } from "@/lib/use-media-query"
import { cn } from "@/lib/utils"
import { useChatStore } from "@/store/chat"
import { DESKTOP_QUERY, useLayoutStore } from "@/store/layout"

/** 서비스가 '…' 메뉴 맨 위에 더하는 항목(코치: 이 대화로 일기 만들기). closeDrawer는 폰의 대화 목록 서랍을 닫는다. */
export type ConversationMenuExtra = (conversation: Conversation, closeDrawer: () => void) => ReactNode

/**
 * 대화 목록. 넓은 화면에서는 왼쪽에 붙어 있고(헤더 아이콘으로 접고 펼침, 오른쪽 손잡이로 너비 조절),
 * 모바일에서는 감춰 두었다가 아이콘을 누르면 왼쪽에서 서랍처럼 열린다.
 */
export function ConversationSidebar({ menuExtra }: { menuExtra?: ConversationMenuExtra }) {
    const desktopOpen = useLayoutStore((state) => state.desktopSidebarOpen)
    const mobileOpen = useLayoutStore((state) => state.mobileSidebarOpen)
    const setMobileOpen = useLayoutStore((state) => state.setMobileSidebarOpen)
    const listWidth = useLayoutStore((state) => state.listWidth)
    const isDesktop = useMediaQuery(DESKTOP_QUERY)

    // 서랍을 연 채로 화면이 넓어지면(태블릿 회전·창 크기 변경) 서랍을 닫는다.
    // 그대로 두면 서랍의 반투명 배경만 남아 화면을 누를 수 없게 된다.
    useEffect(() => {
        if (isDesktop) setMobileOpen(false)
    }, [isDesktop, setMobileOpen])

    return (
        <>
            {desktopOpen && (
                <aside id="conversation-sidebar" style={{ width: listWidth }} className="hidden shrink-0 flex-col md:flex">
                    <ConversationList menuExtra={menuExtra} />
                </aside>
            )}

            <Sheet open={mobileOpen && !isDesktop} onOpenChange={setMobileOpen}>
                <SheetContent side="left" className="w-72 max-w-[85vw] gap-0">
                    <SheetHeader className="pb-0">
                        <SheetTitle>대화 목록</SheetTitle>
                        <SheetDescription className="sr-only">대화를 고르거나 새로 시작합니다.</SheetDescription>
                    </SheetHeader>
                    {/* 대화를 고르면 서랍을 닫아 바로 대화를 보이게 한다. */}
                    <ConversationList menuExtra={menuExtra} onPicked={() => setMobileOpen(false)} />
                </SheetContent>
            </Sheet>
        </>
    )
}

function ConversationList({ onPicked, menuExtra }: { onPicked?: () => void; menuExtra?: ConversationMenuExtra }) {
    const conversations = useChatStore((state) => state.conversations)
    const activeId = useChatStore((state) => state.activeId)
    const startNewConversation = useChatStore((state) => state.startNewConversation)

    return (
        <>
            <div className="p-3">
                <Button
                    className="w-full"
                    onClick={() => {
                        onPicked?.()
                        void startNewConversation()
                    }}
                >
                    새 대화
                </Button>
            </div>

            <nav aria-label="대화 목록" className="flex-1 overflow-y-auto px-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
                {conversations.length === 0 && <p className="px-2 py-4 text-sm text-muted-foreground">아직 대화가 없습니다.</p>}

                <ul className="flex flex-col gap-1">
                    {conversations.map((conversation) => (
                        <ConversationItem
                            key={conversation.id}
                            conversation={conversation}
                            active={conversation.id === activeId}
                            onPicked={onPicked}
                            menuExtra={menuExtra}
                        />
                    ))}
                </ul>
            </nav>
        </>
    )
}

/** 대화 한 줄. 제목을 누르면 열고, 옆 '…' 메뉴에서 이름을 바꾸거나 지운다(서비스가 더한 항목은 맨 위). */
function ConversationItem({
    conversation,
    active,
    onPicked,
    menuExtra,
}: {
    conversation: Conversation
    active: boolean
    onPicked?: () => void
    menuExtra?: ConversationMenuExtra
}) {
    const openConversation = useChatStore((state) => state.openConversation)
    const renameConversation = useChatStore((state) => state.renameConversation)
    const removeConversation = useChatStore((state) => state.removeConversation)
    const [renaming, setRenaming] = useState(false)
    const input = useRef<HTMLInputElement>(null)
    const titleButton = useRef<HTMLButtonElement>(null)
    // Enter 뒤 입력칸이 사라질 때 blur가 한 번 더 와도 두 번 저장하지 않게 한다.
    const editing = useRef(false)
    const refocusTitle = useRef(false)

    // 키보드로 끝냈으면(Enter·Esc) 제목 버튼으로 포커스를 돌려준다. 다른 곳을 눌러 끝냈으면 그곳에 둔다.
    useEffect(() => {
        if (renaming || !refocusTitle.current) return
        refocusTitle.current = false
        titleButton.current?.focus()
    }, [renaming])

    const startRenaming = () => {
        editing.current = true
        setRenaming(true)
    }

    /** 비우거나 그대로면 저장하지 않는다(store가 거른다). */
    const finish = (save: boolean, byKeyboard: boolean) => {
        if (!editing.current) return
        editing.current = false
        refocusTitle.current = byKeyboard
        const title = input.current?.value ?? ""
        setRenaming(false)
        if (save) void renameConversation(conversation.id, title)
    }

    return (
        <li className="group flex items-center gap-1">
            {renaming ? (
                <form
                    className="min-w-0 flex-1"
                    onSubmit={(event) => {
                        event.preventDefault()
                        finish(true, true)
                    }}
                >
                    <Input
                        ref={input}
                        aria-label="대화 제목"
                        defaultValue={conversation.title}
                        maxLength={100}
                        onFocus={(event) => event.currentTarget.select()}
                        onBlur={() => finish(true, false)}
                        onKeyDown={(event) => {
                            if (event.key !== "Escape") return
                            // 서랍(폰의 대화 목록)까지 닫히지 않게 여기서 멈춘다.
                            event.preventDefault()
                            event.stopPropagation()
                            finish(false, true)
                        }}
                    />
                </form>
            ) : (
                <button
                    ref={titleButton}
                    type="button"
                    title={conversation.title}
                    onClick={() => {
                        onPicked?.()
                        void openConversation(conversation.id)
                    }}
                    className={cn("min-w-0 flex-1 truncate rounded-md px-3 py-2 text-left text-sm hover:bg-muted", active && "bg-muted font-medium")}
                >
                    {conversation.title}
                </button>
            )}
            <DropdownMenu>
                <DropdownMenuTrigger
                    render={
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`${conversation.title} 메뉴`}
                            className={cn(
                                "shrink-0 text-muted-foreground",
                                // 마우스가 있는 기기에서는 줄에 올리거나(포커스·메뉴 열림 포함) 지금 보는 대화일 때 보인다.
                                // 터치 기기(폰·태블릿)는 hover가 없으므로 늘 보인다.
                                !active && "group-hover:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100 [@media(hover:hover)]:opacity-0"
                            )}
                        />
                    }
                >
                    <Ellipsis />
                </DropdownMenuTrigger>
                {/* 이름 바꾸기를 고르면 메뉴가 닫힐 때 '…' 대신 제목 입력칸으로 포커스를 보낸다. */}
                <DropdownMenuContent align="end" className={menuExtra ? "w-60" : "w-36"} finalFocus={() => input.current ?? true}>
                    {menuExtra?.(conversation, () => onPicked?.())}
                    <DropdownMenuItem onClick={startRenaming}>
                        <Pencil />
                        이름 바꾸기
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onClick={() => void removeConversation(conversation.id)}>
                        <Trash2 />
                        삭제
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </li>
    )
}
