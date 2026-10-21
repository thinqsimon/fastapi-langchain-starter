"use client"

import { useEffect } from "react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useMediaQuery } from "@/lib/use-media-query"
import { cn } from "@/lib/utils"
import { useChatStore } from "@/store/chat"
import { DESKTOP_QUERY, useLayoutStore } from "@/store/layout"

/**
 * 대화 목록. 넓은 화면에서는 왼쪽에 붙어 있고(헤더 아이콘으로 접고 펼침),
 * 모바일에서는 감춰 두었다가 아이콘을 누르면 왼쪽에서 서랍처럼 열린다.
 */
export function ConversationSidebar() {
    const desktopOpen = useLayoutStore((state) => state.desktopSidebarOpen)
    const mobileOpen = useLayoutStore((state) => state.mobileSidebarOpen)
    const setMobileOpen = useLayoutStore((state) => state.setMobileSidebarOpen)
    const isDesktop = useMediaQuery(DESKTOP_QUERY)

    // 서랍을 연 채로 화면이 넓어지면(태블릿 회전·창 크기 변경) 서랍을 닫는다.
    // 그대로 두면 서랍의 반투명 배경만 남아 화면을 누를 수 없게 된다.
    useEffect(() => {
        if (isDesktop) setMobileOpen(false)
    }, [isDesktop, setMobileOpen])

    return (
        <>
            {desktopOpen && (
                <aside id="conversation-sidebar" className="hidden w-64 shrink-0 flex-col border-r md:flex">
                    <ConversationList />
                </aside>
            )}

            <Sheet open={mobileOpen && !isDesktop} onOpenChange={setMobileOpen}>
                <SheetContent side="left" className="w-72 max-w-[85vw] gap-0">
                    <SheetHeader className="pb-0">
                        <SheetTitle>대화 목록</SheetTitle>
                        <SheetDescription className="sr-only">대화를 고르거나 새로 시작합니다.</SheetDescription>
                    </SheetHeader>
                    {/* 대화를 고르면 서랍을 닫아 바로 대화를 보이게 한다. */}
                    <ConversationList onPicked={() => setMobileOpen(false)} />
                </SheetContent>
            </Sheet>
        </>
    )
}

function ConversationList({ onPicked }: { onPicked?: () => void }) {
    const conversations = useChatStore((state) => state.conversations)
    const activeId = useChatStore((state) => state.activeId)
    const openConversation = useChatStore((state) => state.openConversation)
    const startNewConversation = useChatStore((state) => state.startNewConversation)
    const removeConversation = useChatStore((state) => state.removeConversation)

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
                        <li key={conversation.id} className="group flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => {
                                    onPicked?.()
                                    void openConversation(conversation.id)
                                }}
                                className={cn(
                                    "min-w-0 flex-1 truncate rounded-md px-3 py-2 text-left text-sm hover:bg-muted",
                                    conversation.id === activeId && "bg-muted font-medium"
                                )}
                            >
                                {conversation.title}
                            </button>
                            {/* 마우스가 있는 기기에서만 올렸을 때 보인다. 터치 기기(폰·태블릿)는 hover가 없으므로 늘 보인다. */}
                            <button
                                type="button"
                                aria-label={`${conversation.title} 삭제`}
                                onClick={() => void removeConversation(conversation.id)}
                                className="px-2 py-2 text-xs text-muted-foreground group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100 [@media(hover:hover)]:opacity-0"
                            >
                                삭제
                            </button>
                        </li>
                    ))}
                </ul>
            </nav>
        </>
    )
}
