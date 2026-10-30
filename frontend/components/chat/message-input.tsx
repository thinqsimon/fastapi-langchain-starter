"use client"

import { useRef, useState } from "react"

import { SendHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"

/** 입력칸이 늘어나는 최대 줄 수. 넘으면 입력칸 안에서 스크롤한다. */
const MAX_ROWS = 3

/** 내용에 맞춰 높이를 늘리되 MAX_ROWS줄을 넘지 않게 한다. */
function fitHeight(textarea: HTMLTextAreaElement) {
    const style = getComputedStyle(textarea)
    const lineHeight = parseFloat(style.lineHeight)
    const chrome = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth)
    const maxHeight = lineHeight * MAX_ROWS + chrome

    textarea.style.height = "auto"
    const needed = textarea.scrollHeight + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth)
    textarea.style.height = `${Math.min(needed, maxHeight)}px`
    textarea.style.overflowY = needed > maxHeight ? "auto" : "hidden"
}

export function MessageInput({
    disabled,
    onSend,
    leading,
}: {
    disabled: boolean
    onSend: (content: string) => void
    /** 입력칸 왼쪽에 놓을 것(예: 부가 기능 + 메뉴). 서비스마다 다르므로 밖에서 넣는다. */
    leading?: React.ReactNode
}) {
    const [value, setValue] = useState("")
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    function submit(event: React.FormEvent) {
        event.preventDefault()
        const content = value.trim()
        if (!content || disabled) return
        onSend(content)
        setValue("")
        // 보낸 뒤에는 한 줄 높이로 돌아간다.
        if (textareaRef.current) {
            textareaRef.current.style.height = ""
            textareaRef.current.style.overflowY = ""
        }
    }

    return (
        // 아이폰 홈 인디케이터(하단 안전 영역) 위에서 끝나도록 아래 여백을 더한다.
        <form
            onSubmit={submit}
            className="flex items-end gap-2 border-t p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:p-4 sm:pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
            {leading}
            <textarea
                ref={textareaRef}
                aria-label="메시지"
                value={value}
                onChange={(event) => {
                    setValue(event.target.value)
                    fitHeight(event.target)
                }}
                onKeyDown={(event) => {
                    // Enter는 전송, Shift+Enter는 줄바꿈. 한글 조합 중 Enter는 글자 확정이므로 보내지 않는다.
                    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) submit(event)
                }}
                rows={1}
                placeholder="메시지를 입력하세요"
                // 모바일 Safari는 16px 미만 입력칸을 누르면 화면을 확대하므로, 마우스가 있는 넓은 화면에서만 14px로 줄인다.
                className="min-w-0 flex-1 resize-none overflow-y-hidden rounded-md border border-input bg-background px-3 py-2 text-base leading-6 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none md:[@media(pointer:fine)]:text-sm md:[@media(pointer:fine)]:leading-5"
            />
            <Button type="submit" size="icon-lg" className="size-10" aria-label="보내기" title="보내기" disabled={disabled || !value.trim()}>
                <SendHorizontal className="size-5" />
            </Button>
        </form>
    )
}
