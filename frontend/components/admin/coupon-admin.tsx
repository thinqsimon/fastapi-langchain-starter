"use client"

import { useEffect, useState } from "react"
import { Copy } from "lucide-react"

import type { CouponDuration, CouponPlan, CouponStatus, CouponValidDays } from "@/lib/api"
import { FormStatus, useFormAction } from "@/components/settings/form-status"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { copyToClipboard, couponShareText, couponsShareText } from "@/lib/coupon-text"
import { COUPON_DURATION_LABELS, COUPON_DURATIONS, COUPON_VALID_DAYS, planLabel } from "@/lib/llm-labels"
import { useAuthStore } from "@/store/auth"
import { useCouponStore } from "@/store/coupon"

const STATUS_LABELS: Record<CouponStatus, string> = { active: "미사용", redeemed: "사용됨", expired: "만료", revoked: "취소" }
const STATUS_FILTERS: (CouponStatus | "all")[] = ["all", "active", "redeemed", "expired", "revoked"]
const SELECT_CLASS = "h-9 rounded-md border border-input bg-transparent px-3 text-base shadow-xs md:text-sm"

/** 요금제 쿠폰 발급과 목록(COUPON-01). 관리자가 아니면 아무것도 그리지 않는다. */
export function CouponAdmin() {
    const user = useAuthStore((state) => state.user)
    if (!user?.is_admin) return null

    return (
        <section aria-labelledby="admin-coupon-heading" className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
                <h2 id="admin-coupon-heading" className="text-lg font-semibold">
                    쿠폰
                </h2>
                <p className="text-sm text-muted-foreground">
                    카카오톡 선물처럼 코드를 만들어 보냅니다. 받은 사람이 등록 기한 안에 설정 화면에서 등록하면 그날부터 기간만큼 요금제가 적용됩니다.
                </p>
            </div>
            <IssueCard />
            <CouponListCard />
        </section>
    )
}

/** 복사 버튼 공통 처리. 복사 결과 문구는 한 곳(data-slot="copy-status")에 보여 준다. */
function useCopy() {
    const [copied, setCopied] = useState<string | null>(null)

    async function copy(text: string, label = "복사했습니다.") {
        try {
            await copyToClipboard(text)
            setCopied(label)
        } catch {
            setCopied("복사하지 못했습니다. 코드를 직접 선택해 복사해 주세요.")
        }
    }

    return { copied, copy }
}

function IssueCard() {
    const issue = useCouponStore((state) => state.issue)
    const issued = useCouponStore((state) => state.issued)
    const [plan, setPlan] = useState<CouponPlan>("pro")
    const [duration, setDuration] = useState<CouponDuration>("1m")
    const [validDays, setValidDays] = useState<CouponValidDays>(30)
    const [quantity, setQuantity] = useState("1")
    const [memo, setMemo] = useState("")
    const { result, isPending, run } = useFormAction()
    const { copied, copy } = useCopy()
    const origin = typeof window === "undefined" ? "" : window.location.origin

    return (
        <Card>
            <CardHeader>
                <CardTitle>쿠폰 발급</CardTitle>
                <CardDescription>
                    요금제와 기간을 고르고 발급하면 1회용 코드가 만들어집니다. 코드는 아래 목록에서 언제든 다시 복사할 수 있습니다.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <form
                    aria-label="쿠폰 발급"
                    className="flex flex-col gap-3"
                    onSubmit={(event) => {
                        event.preventDefault()
                        const count = Number(quantity)
                        if (!Number.isInteger(count) || count < 1 || count > 20) return
                        void run(async () => {
                            const created = await issue({ plan, duration, valid_days: validDays, quantity: count, memo: memo.trim() || undefined })
                            return `${created.length}장을 발급했습니다. 아래에서 복사해 전달하세요.`
                        }, "발급하지 못했습니다.")
                    }}
                >
                    <div className="grid gap-3 sm:grid-cols-4">
                        <div className="flex flex-col gap-1">
                            <Label htmlFor="coupon-plan">요금제</Label>
                            <select id="coupon-plan" value={plan} onChange={(event) => setPlan(event.target.value as CouponPlan)} className={SELECT_CLASS}>
                                <option value="pro">Pro</option>
                                <option value="max">Max</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <Label htmlFor="coupon-duration">기간</Label>
                            <select
                                id="coupon-duration"
                                value={duration}
                                onChange={(event) => setDuration(event.target.value as CouponDuration)}
                                className={SELECT_CLASS}
                            >
                                {COUPON_DURATIONS.map((value) => (
                                    <option key={value} value={value}>
                                        {COUPON_DURATION_LABELS[value]}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <Label htmlFor="coupon-valid-days">등록 기한</Label>
                            <select
                                id="coupon-valid-days"
                                value={String(validDays)}
                                onChange={(event) => setValidDays(Number(event.target.value) as CouponValidDays)}
                                className={SELECT_CLASS}
                            >
                                {COUPON_VALID_DAYS.map((days) => (
                                    <option key={days} value={days}>
                                        발급 후 {days}일
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <Label htmlFor="coupon-quantity">수량</Label>
                            <Input
                                id="coupon-quantity"
                                type="number"
                                min={1}
                                max={20}
                                value={quantity}
                                onChange={(event) => setQuantity(event.target.value)}
                                required
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <Label htmlFor="coupon-memo">메모</Label>
                        <Input
                            id="coupon-memo"
                            value={memo}
                            onChange={(event) => setMemo(event.target.value)}
                            maxLength={200}
                            placeholder="예: 11월 수강생 이벤트 (받는 사람에게는 보이지 않습니다)"
                        />
                    </div>
                    <div>
                        <Button type="submit" disabled={isPending}>
                            {isPending ? "발급 중…" : "발급"}
                        </Button>
                    </div>
                    <FormStatus result={result} />
                </form>

                {issued.length > 0 && (
                    <section aria-label="발급된 쿠폰" className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium">
                                방금 발급한 쿠폰 {issued.length}장 · {planLabel(issued[0].plan)} {issued[0].duration_label} ·{" "}
                                {new Date(issued[0].expires_at).toLocaleDateString("ko-KR")}
                                까지 등록
                            </p>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void copy(couponsShareText(issued, origin), `${issued.length}장 안내문을 복사했습니다.`)}
                            >
                                <Copy />
                                모두 복사
                            </Button>
                        </div>
                        <ul className="flex flex-col gap-1">
                            {issued.map((coupon) => (
                                <li key={coupon.id} data-slot="issued-coupon" className="flex items-center justify-between gap-2 text-sm">
                                    <code className="rounded bg-background px-2 py-1 font-mono text-base tracking-wider">{coupon.code}</code>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        aria-label={`${coupon.code} 복사`}
                                        onClick={() => void copy(couponShareText(coupon, origin))}
                                    >
                                        <Copy />
                                        복사
                                    </Button>
                                </li>
                            ))}
                        </ul>
                        <p className="text-xs text-muted-foreground">복사한 안내문에는 코드, 등록 기한, 적용 내용, 사용처({origin})가 들어 있습니다.</p>
                        {copied && (
                            <p role="status" data-slot="copy-status" className="text-xs text-muted-foreground">
                                {copied}
                            </p>
                        )}
                    </section>
                )}
            </CardContent>
        </Card>
    )
}

function CouponListCard() {
    const coupons = useCouponStore((state) => state.coupons)
    const load = useCouponStore((state) => state.load)
    const revoke = useCouponStore((state) => state.revoke)
    const error = useCouponStore((state) => state.error)
    const [filter, setFilter] = useState<CouponStatus | "all">("all")
    const { result, isPending, run } = useFormAction()
    const { copied, copy } = useCopy()
    const origin = typeof window === "undefined" ? "" : window.location.origin

    useEffect(() => {
        void load()
    }, [load])

    const shown = coupons.filter((coupon) => filter === "all" || coupon.status === filter)

    return (
        <Card>
            <CardHeader>
                <CardTitle>쿠폰 목록</CardTitle>
                <CardDescription>최근 200장. 미사용 쿠폰만 취소할 수 있고, 등록 기한이 지난 쿠폰은 자동으로 만료 처리됩니다.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                <div role="group" aria-label="상태 필터" className="flex flex-wrap gap-1">
                    {STATUS_FILTERS.map((value) => (
                        <Button
                            key={value}
                            type="button"
                            size="sm"
                            variant={filter === value ? "secondary" : "outline"}
                            aria-pressed={filter === value}
                            onClick={() => setFilter(value)}
                        >
                            {value === "all" ? "전체" : STATUS_LABELS[value]}
                            <span className="text-xs text-muted-foreground">
                                {value === "all" ? coupons.length : coupons.filter((c) => c.status === value).length}
                            </span>
                        </Button>
                    ))}
                </div>
                {error && (
                    <p role="alert" className="text-sm text-destructive">
                        {error}
                    </p>
                )}
                {shown.length === 0 ? (
                    <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">해당하는 쿠폰이 없습니다.</p>
                ) : (
                    <ul aria-label="쿠폰 목록" className="flex flex-col divide-y rounded-md border">
                        {shown.map((coupon) => (
                            <li
                                key={coupon.id}
                                data-slot="coupon-row"
                                data-status={coupon.status}
                                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm"
                            >
                                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <code className="font-mono tracking-wider">{coupon.code}</code>
                                        <StatusBadge status={coupon.status} />
                                        <span className="text-muted-foreground">
                                            {planLabel(coupon.plan)} {coupon.duration_label}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {new Date(coupon.expires_at).toLocaleDateString("ko-KR")}까지 등록
                                        {coupon.memo && ` · ${coupon.memo}`}
                                        {coupon.status === "redeemed" &&
                                            coupon.redeemed_at &&
                                            ` · ${coupon.redeemed_by_email ?? "탈퇴한 사용자"}가 ${new Date(coupon.redeemed_at).toLocaleDateString("ko-KR")} 사용`}
                                        {coupon.status === "redeemed" &&
                                            coupon.plan_until &&
                                            ` (${new Date(coupon.plan_until).toLocaleDateString("ko-KR")}까지 적용)`}
                                    </p>
                                </div>
                                <div className="flex gap-1">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        aria-label={`${coupon.code} 복사`}
                                        onClick={() => void copy(couponShareText(coupon, origin))}
                                    >
                                        <Copy />
                                        복사
                                    </Button>
                                    {coupon.status === "active" && (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            aria-label={`${coupon.code} 취소`}
                                            disabled={isPending}
                                            onClick={() =>
                                                void run(async () => {
                                                    await revoke(coupon.id)
                                                    return `${coupon.code} 쿠폰을 취소했습니다.`
                                                }, "취소하지 못했습니다.")
                                            }
                                        >
                                            취소
                                        </Button>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
                <FormStatus result={result} />
                {copied && (
                    <p role="status" data-slot="copy-status" className="text-xs text-muted-foreground">
                        {copied}
                    </p>
                )}
            </CardContent>
        </Card>
    )
}

function StatusBadge({ status }: { status: CouponStatus }) {
    const color =
        status === "active"
            ? "bg-emerald-100 text-emerald-800"
            : status === "redeemed"
              ? "bg-sky-100 text-sky-800"
              : status === "expired"
                ? "bg-muted text-muted-foreground"
                : "bg-amber-100 text-amber-900"
    return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>{STATUS_LABELS[status]}</span>
}
