"use client"

import { useState } from "react"

import { diaryApi, errorMessage, type WeeklyReview } from "@/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function WeeklyReviewCard() {
    const [review, setReview] = useState<WeeklyReview | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function load() {
        setIsLoading(true)
        setError(null)
        try {
            setReview(await diaryApi.fetchWeeklyReview())
        } catch (caught) {
            setError(errorMessage(caught, "회고를 만들지 못했습니다."))
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">이번 주 회고</CardTitle>
                <Button size="sm" variant="outline" onClick={() => void load()} disabled={isLoading}>
                    {isLoading ? "정리 중…" : "회고 만들기"}
                </Button>
            </CardHeader>
            <CardContent>
                {error && (
                    <p role="alert" className="text-sm text-destructive">
                        {error}
                    </p>
                )}

                {review ? (
                    <dl className="flex flex-col gap-3 text-sm">
                        <p className="text-xs text-muted-foreground">
                            {review.week_start} ~ {review.week_end} · 일기 {review.entry_count}편
                        </p>
                        {[
                            ["성장한 점", review.grown],
                            ["반복된 어려움", review.repeated_difficulty],
                            ["다음 주 제안", review.suggestion],
                        ].map(([term, description]) => (
                            <div key={term}>
                                <dt className="font-medium">{term}</dt>
                                <dd className="text-muted-foreground">{description}</dd>
                            </div>
                        ))}
                    </dl>
                ) : (
                    !error && <p className="text-sm text-muted-foreground">이번 주에 쓴 일기를 모아 코치가 정리해 줍니다.</p>
                )}
            </CardContent>
        </Card>
    )
}
