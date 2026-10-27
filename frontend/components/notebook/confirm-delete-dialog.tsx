"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const COPY = {
    notebook: {
        title: "학습장을 삭제할까요?",
        description: "학습장과 그 안의 주제가 모두 삭제됩니다. 올린 원본 md 파일은 바뀌지 않습니다.",
    },
    topic: {
        title: "주제를 삭제할까요?",
        description: "이 주제의 본문과 학습 완료 표시가 삭제됩니다.",
    },
} as const

/** 학습장·주제 삭제 확인 창. 확인하면 onConfirm을 부르고 닫는다. */
export function ConfirmDeleteDialog({
    open,
    kind,
    name,
    onOpenChange,
    onConfirm,
}: {
    open: boolean
    kind: "notebook" | "topic"
    name?: string
    onOpenChange: (open: boolean) => void
    onConfirm: () => void
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{COPY[kind].title}</DialogTitle>
                    <DialogDescription>
                        {name && <>&lsquo;{name}&rsquo; — </>}
                        {COPY[kind].description}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        취소
                    </Button>
                    <Button
                        onClick={() => {
                            onConfirm()
                            onOpenChange(false)
                        }}
                    >
                        삭제하기
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
