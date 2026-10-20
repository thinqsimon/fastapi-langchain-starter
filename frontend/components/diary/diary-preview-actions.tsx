"use client"

import { Check, Copy, Eye } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { createRoot } from "react-dom/client"

import { DiaryDocument } from "@/components/diary/diary-document"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { copyRichText } from "@/lib/clipboard"
import { diaryToMarkdown, hasDiaryContent, type DiaryDocumentInput } from "@/lib/diary-markdown"

/** 프리뷰와 같은 모양의 HTML을 만든다(서식 붙여 넣기용). 화면에 띄우지 않고 메모리에서 그린다. */
function renderHtml(markdown: string): string {
    const container = document.createElement("div")
    const root = createRoot(container)
    flushSync(() => root.render(<DiaryDocument markdown={markdown} />))
    const html = container.innerHTML
    root.unmount()
    return html
}

/** '전체 복사' 버튼. 복사가 끝나면 잠시 '복사됨'으로 바뀐다. */
function CopyButton({ markdown, label, disabled }: { markdown: string; label: string; disabled?: boolean }) {
    const [state, setState] = useState<"idle" | "copied" | "failed">("idle")
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
    useEffect(() => () => clearTimeout(timer.current), [])

    async function copy() {
        try {
            await copyRichText(markdown, renderHtml(markdown))
            setState("copied")
        } catch {
            setState("failed")
        }
        clearTimeout(timer.current)
        timer.current = setTimeout(() => setState("idle"), 2000)
    }

    return (
        <Button type="button" size="sm" variant="outline" aria-label={label} disabled={disabled} onClick={() => void copy()}>
            {state === "copied" ? <Check /> : <Copy />}
            {/* 화면 읽기 프로그램에도 결과를 알린다. */}
            <span aria-live="polite">{state === "copied" ? "복사됨" : state === "failed" ? "복사 실패" : "전체 복사"}</span>
        </Button>
    )
}

/**
 * 일기 한 편의 '프리뷰 보기'와 '전체 복사' 버튼.
 * 프리뷰는 화면 위에 뜨는 창에 문서 형태로 보여주고, 복사는 창을 열지 않고 같은 내용을 클립보드에 넣는다.
 */
export function DiaryPreviewActions({ diary, name }: { diary: DiaryDocumentInput; name: string }) {
    const [open, setOpen] = useState(false)
    const markdown = diaryToMarkdown(diary)
    const empty = !hasDiaryContent(diary)

    return (
        <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" aria-label={`${name} 프리뷰 보기`} disabled={empty} onClick={() => setOpen(true)}>
                <Eye />
                프리뷰 보기
            </Button>
            <CopyButton markdown={markdown} label={`${name} 전체 복사`} disabled={empty} />

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent showCloseButton={false} className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-3xl">
                    {/* 버튼은 위쪽에 고정하고 본문만 스크롤한다. */}
                    <DialogHeader className="flex-row items-center justify-between gap-2 border-b px-4 py-3">
                        <DialogTitle>일기 프리뷰</DialogTitle>
                        <DialogDescription className="sr-only">일기 전체를 문서 형태로 봅니다.</DialogDescription>
                        <div className="flex gap-2">
                            <CopyButton markdown={markdown} label="프리뷰 전체 복사" />
                            <DialogClose render={<Button type="button" size="sm" />}>닫기</DialogClose>
                        </div>
                    </DialogHeader>
                    <div className="overflow-y-auto px-5 py-6 sm:px-10 sm:py-8">
                        <DiaryDocument markdown={markdown} />
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
