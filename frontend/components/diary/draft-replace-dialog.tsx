"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export function DraftReplaceDialog({ open, onOpenChange, onConfirm }: { open: boolean; onOpenChange: (open: boolean) => void; onConfirm: () => void }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>저장하지 않은 일기가 있어요</DialogTitle>
                    <DialogDescription>
                        새 초안을 만들면 작성 중인 내용이 바뀝니다. 기존 일기를 남기려면 취소한 뒤 먼저 저장해 주세요. 생성에 실패하면 기존 내용은 유지됩니다.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        취소
                    </Button>
                    <Button onClick={onConfirm}>새 초안으로 바꾸기</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
