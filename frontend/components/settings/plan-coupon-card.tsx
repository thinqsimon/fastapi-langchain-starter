"use client"

import { useState } from "react"
import { AxiosError } from "axios"

import { couponApi, errorMessage } from "@/lib/api"
import { FormStatus, type FormResult } from "@/components/settings/form-status"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { planPeriodLabel } from "@/lib/llm-labels"
import { useAuthStore } from "@/store/auth"

/** 서버가 "남은 기간이 사라진다"는 확인을 요구한 경우(409 CONFIRM_REQUIRED). */
function isConfirmRequired(error: unknown): boolean {
    return (
        error instanceof AxiosError &&
        error.response?.status === 409 &&
        (error.response.data as { error?: { code?: string } } | undefined)?.error?.code === "CONFIRM_REQUIRED"
    )
}

/** 설정 화면의 "요금제와 쿠폰" 카드(COUPON-01). 현재 요금제를 보여 주고 쿠폰 코드를 등록한다. */
export function PlanCouponCard() {
    const user = useAuthStore((state) => state.user)
    const refreshUser = useAuthStore((state) => state.refreshUser)
    const [code, setCode] = useState("")
    const [result, setResult] = useState<FormResult | null>(null)
    const [isPending, setIsPending] = useState(false)
    const [confirmMessage, setConfirmMessage] = useState<string | null>(null)

    async function redeem(confirm: boolean) {
        setIsPending(true)
        setResult(null)
        try {
            const redeemed = await couponApi.redeemCoupon(code.trim(), confirm)
            await refreshUser()
            setCode("")
            setConfirmMessage(null)
            setResult({ kind: "success", message: `${redeemed.message} ${planPeriodLabel(redeemed.plan, redeemed.plan_expires_at)}` })
        } catch (caught) {
            if (isConfirmRequired(caught)) setConfirmMessage(errorMessage(caught, "남은 기간이 사라집니다. 계속할까요?"))
            else setResult({ kind: "error", message: errorMessage(caught, "쿠폰을 등록하지 못했습니다.") })
        } finally {
            setIsPending(false)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>요금제와 쿠폰</CardTitle>
                <CardDescription>
                    현재 요금제:{" "}
                    <b data-slot="current-plan" className="text-foreground">
                        {user ? planPeriodLabel(user.plan, user.plan_expires_at) : ""}
                    </b>
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form
                    aria-label="쿠폰 등록"
                    className="flex flex-col gap-3"
                    onSubmit={(event) => {
                        event.preventDefault()
                        if (code.trim()) void redeem(false)
                    }}
                >
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="coupon-code">쿠폰 코드</Label>
                        <div className="flex gap-2">
                            <Input
                                id="coupon-code"
                                className="min-w-0 flex-1 font-mono tracking-wider"
                                value={code}
                                onChange={(event) => setCode(event.target.value)}
                                placeholder="XXXX-XXXX-XXXX"
                                autoComplete="off"
                                maxLength={32}
                            />
                            <Button type="submit" disabled={isPending || !code.trim()}>
                                {isPending ? "확인 중…" : "쿠폰 등록"}
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            등록한 날부터 쿠폰 기간만큼 요금제가 적용됩니다. 같은 요금제 쿠폰은 남은 기간 뒤에 이어 붙고, 기간이 끝나면 Free로 돌아갑니다.
                        </p>
                    </div>
                    <FormStatus result={result} />
                </form>
            </CardContent>

            <Dialog
                open={!!confirmMessage}
                onOpenChange={(open) => {
                    if (!open) setConfirmMessage(null)
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>남은 기간이 사라져요</DialogTitle>
                        <DialogDescription>{confirmMessage}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmMessage(null)}>
                            취소
                        </Button>
                        <Button disabled={isPending} onClick={() => void redeem(true)}>
                            계속 등록
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    )
}
