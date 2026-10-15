"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"

export function MessageInput({ disabled, onSend }: { disabled: boolean; onSend: (content: string) => void }) {
    const [value, setValue] = useState("")

    function submit(event: React.FormEvent) {
        event.preventDefault()
        const content = value.trim()
        if (!content || disabled) return
        onSend(content)
        setValue("")
    }

    return (
        <form onSubmit={submit} className="flex gap-2 border-t p-4">
            <textarea
                aria-label="메시지"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                onKeyDown={(event) => {
                    // Enter는 전송, Shift+Enter는 줄바꿈
                    if (event.key === "Enter" && !event.shiftKey) submit(event)
                }}
                rows={1}
                placeholder="메시지를 입력하세요"
                className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            />
            <Button type="submit" disabled={disabled || !value.trim()}>
                보내기
            </Button>
        </form>
    )
}
