"use client"

import { Eye } from "lucide-react"
import { useState } from "react"

import { DiaryDocument } from "@/components/diary/diary-document"
import { DiaryPasteDocument } from "@/components/diary/diary-paste-document"
import { RichCopyButton } from "@/components/rich-copy-button"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { diaryToMarkdown, hasDiaryContent, type DiaryDocumentInput } from "@/lib/diary-markdown"

/** '전체 복사' 버튼. 마크다운 글자와 붙여 넣기 서식(DiaryPasteDocument)을 함께 넣는다. */
function CopyButton({ diary, label, disabled }: { diary: DiaryDocumentInput; label: string; disabled?: boolean }) {
    return (
        <RichCopyButton markdown={diaryToMarkdown(diary)} pasteDocument={<DiaryPasteDocument diary={diary} />} label={label} disabled={disabled}>
            전체 복사
        </RichCopyButton>
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
            <CopyButton diary={diary} label={`${name} 전체 복사`} disabled={empty} />

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent showCloseButton={false} className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-3xl">
                    {/* 버튼은 위쪽에 고정하고 본문만 스크롤한다. */}
                    <DialogHeader className="flex-row items-center justify-between gap-2 border-b px-4 py-3">
                        <DialogTitle>일기 프리뷰</DialogTitle>
                        <DialogDescription className="sr-only">일기 전체를 문서 형태로 봅니다.</DialogDescription>
                        <div className="flex gap-2">
                            <CopyButton diary={diary} label="프리뷰 전체 복사" />
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
