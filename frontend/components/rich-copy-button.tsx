"use client"

import { Check, Copy } from "lucide-react"
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from "react"
import { flushSync } from "react-dom"
import { createRoot } from "react-dom/client"

import { Button } from "@/components/ui/button"
import { copyRichText } from "@/lib/clipboard"

/** 붙여 넣기용 HTML을 만든다. 화면에 띄우지 않고 메모리에서 그린다. */
function renderPasteHtml(pasteDocument: ReactElement): string {
    const container = document.createElement("div")
    const root = createRoot(container)
    flushSync(() => root.render(pasteDocument))
    const html = container.innerHTML
    root.unmount()
    return html
}

/**
 * 마크다운 글자와 서식(HTML)을 함께 복사하는 버튼. 복사가 끝나면 잠시 '복사됨'으로 바뀐다.
 * 서식은 누를 때 pasteDocument를 그려서 만든다. 일기 '전체 복사'와 학습장 '클립보드에 복사'가 쓴다.
 */
export function RichCopyButton({
    markdown,
    pasteDocument,
    label,
    disabled,
    children,
}: {
    markdown: string
    pasteDocument: ReactElement
    /** 화면 읽기 프로그램용 이름. 버튼 글자가 '복사됨'으로 바뀌어도 그대로라 같은 버튼으로 찾을 수 있다. */
    label: string
    disabled?: boolean
    /** 평소의 버튼 글자 */
    children: ReactNode
}) {
    const [state, setState] = useState<"idle" | "copied" | "failed">("idle")
    // 누를 때의 폭. 글자가 '복사됨'으로 짧아져도 버튼이 줄지 않아, 옆 버튼(삭제·수정)이 누르던 자리로 당겨지지 않는다.
    const [minWidth, setMinWidth] = useState<number>()
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
    useEffect(() => () => clearTimeout(timer.current), [])

    async function copy(width: number) {
        setMinWidth(width)
        try {
            await copyRichText(markdown, renderPasteHtml(pasteDocument))
            setState("copied")
        } catch {
            setState("failed")
        }
        clearTimeout(timer.current)
        timer.current = setTimeout(() => {
            setState("idle")
            setMinWidth(undefined)
        }, 2000)
    }

    return (
        <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label={label}
            disabled={disabled}
            style={minWidth ? { minWidth } : undefined}
            onClick={(event) => void copy(event.currentTarget.getBoundingClientRect().width)}
        >
            {state === "copied" ? <Check /> : <Copy />}
            {/* 화면 읽기 프로그램에도 결과를 알린다. */}
            <span aria-live="polite">{state === "copied" ? "복사됨" : state === "failed" ? "복사 실패" : children}</span>
        </Button>
    )
}
