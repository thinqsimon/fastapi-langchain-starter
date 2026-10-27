import { expect, test } from "@playwright/test"

import { openSettings, sendChatMessage, signUp } from "./helpers"

test("starter의 이름과 설명을 사용한다", async ({ page }) => {
    await page.goto("/sign-in")
    await expect(page).toHaveTitle("AX Chat Starter")
    await expect(page.getByText("AI CHAT STARTER", { exact: true })).toBeVisible()
    await expect(page.getByText("LEARNING DIARY COACH")).toHaveCount(0)
})

test("공통 인증·대화·계정 설정을 유지하고 서비스 설정은 요청하지 않는다", async ({ page }) => {
    const serviceRequests: string[] = []
    page.on("request", (request) => {
        if (/\/api\/(diary|notebooks|me\/preferences)(\/|\?|$)/.test(request.url())) {
            serviceRequests.push(request.url())
        }
    })
    const account = await signUp(page, "starter")
    await expect(page.getByRole("link", { name: "AX Chat Starter 홈", exact: true })).toBeVisible()
    await expect(page.getByRole("link", { name: "일기", exact: true })).toHaveCount(0)
    await expect(page.getByRole("link", { name: "학습장", exact: true })).toHaveCount(0)
    await expect(page.getByRole("button", { name: "이 대화로 일기 만들기" })).toHaveCount(0)
    await expect(page.getByRole("img", { name: "헤드셋을 쓰고 웃는 구름 코치" })).toHaveCount(0)
    await expect(page.getByText("무엇이든 물어보세요.", { exact: true })).toBeVisible()
    await sendChatMessage(page, "JWT는 무엇인가요?")
    await openSettings(page)
    await expect(page.getByRole("heading", { name: "설정", exact: true })).toBeVisible()
    await expect(page.getByLabel("이름", { exact: true })).toHaveValue(account.displayName)
    await expect(page.getByText("화면 설정", { exact: true })).toHaveCount(0)
    expect(serviceRequests).toEqual([])
})

test("일기·학습장 화면과 API를 직접 열어도 404다", async ({ page, request }) => {
    const response = await page.goto("/diary")
    expect(response?.status()).toBe(404)
    expect((await page.goto("/notebook"))?.status()).toBe(404)
    expect((await request.get("/diary/disabled-path")).status()).toBe(404)
    expect((await request.get("/notebook/disabled-path")).status()).toBe(404)
    const backend = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8010"
    expect((await request.get(`${backend}/api/diary`)).status()).toBe(404)
    expect((await request.get(`${backend}/api/diary/reviews`)).status()).toBe(404)
    expect((await request.get(`${backend}/api/diary/study`)).status()).toBe(404)
    expect((await request.get(`${backend}/api/notebooks`)).status()).toBe(404)
    expect((await request.get(`${backend}/api/me/preferences`)).status()).toBe(404)
})
