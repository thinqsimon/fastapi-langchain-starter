import { expect, test, type Page } from "@playwright/test"

import { openSettings, sendChatMessage, signIn, signUp } from "./helpers"

/** CHAT-03 답변 수준: 첫 채팅에서 고르기, + 메뉴에서 바꾸기, 설정 카드(계정 정보 아래), 관리자 이름 변경 */

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8010"
const ADMIN = { email: "e2e-admin@example.com", password: "e2e-secret-password", displayName: "E2E 관리자" }

const chooser = (page: Page) => page.getByRole("region", { name: "답변 수준 고르기" })
const plusMenu = (page: Page) => page.getByRole("button", { name: "추가 기능", exact: true })
const levelItem = (page: Page, label: string) => page.getByRole("menuitemradio", { name: label, exact: true })

async function signInAsAdmin(page: Page) {
    await page.request.post(`${API}/api/auth/signup`, {
        data: { email: ADMIN.email, password: ADMIN.password, display_name: ADMIN.displayName },
    })
    await signIn(page, ADMIN.email, ADMIN.password)
    await expect(page).toHaveURL(/\/chat$/)
}

async function resetLevelNames(page: Page) {
    const token = await page.evaluate(() => localStorage.getItem("access_token"))
    if (!token) return
    for (const level of [1, 2, 3, 4, 5]) {
        await page.request.delete(`${API}/api/admin/answer-levels/${level}/name`, { headers: { Authorization: `Bearer ${token}` } })
    }
}

test("처음 채팅에서 수준을 고르고, + 메뉴와 설정 화면에서 바꾸면 그대로 저장된다", async ({ page }) => {
    await signUp(page, "e2e-level")

    // 아직 고르지 않았으면 채팅 위에 한 번 묻는다. 5단계가 순서대로 보인다.
    await expect(chooser(page)).toBeVisible()
    await expect(chooser(page)).toContainText("고르기 전에는 2단계 입문으로 답해요")
    await expect(chooser(page).getByRole("button", { name: /단계/ })).toHaveText(["1단계 왕초보", "2단계 입문", "3단계 기초", "4단계 실전", "5단계 심화"])
    await chooser(page).getByRole("button", { name: "3단계 기초" }).click()
    await expect(chooser(page)).toHaveCount(0)

    // + 메뉴에 지금 수준이 체크돼 있고, 다른 단계를 누르면 바로 바뀌고 메뉴가 닫힌다.
    await plusMenu(page).click()
    await expect(levelItem(page, "3단계 기초")).toHaveAttribute("aria-checked", "true")
    await levelItem(page, "5단계 심화").click()
    await expect(page.getByRole("menu")).toHaveCount(0)
    await plusMenu(page).click()
    await expect(levelItem(page, "5단계 심화")).toHaveAttribute("aria-checked", "true")
    await page.keyboard.press("Escape")

    // 수준을 바꿔도 채팅은 그대로 된다(E2E는 fake 공급자).
    await sendChatMessage(page, "수준을 바꾼 뒤 질문합니다")

    // 설정: "답변 수준" 카드는 계정 정보(비밀번호 변경) 바로 아래, 요금제 카드 위에 있다.
    await openSettings(page)
    const card = page.getByRole("form", { name: "답변 수준" })
    await expect(card).toBeVisible()
    const passwordBox = (await page.getByRole("form", { name: "비밀번호 변경" }).boundingBox())!
    const levelBox = (await card.boundingBox())!
    const couponBox = (await page.getByRole("form", { name: "쿠폰 등록" }).boundingBox())!
    expect(levelBox.y).toBeGreaterThan(passwordBox.y + passwordBox.height)
    expect(levelBox.y).toBeLessThan(couponBox.y)

    await expect(card.getByRole("radio", { name: /^5단계 심화/ })).toBeChecked()
    await expect(card.getByRole("button", { name: "수준 저장" })).toBeDisabled()
    await card.getByRole("radio", { name: /^3단계 기초/ }).check()
    await expect(card.locator('[data-slot="answer-level-example"]')).toContainText("3단계 기초로 설명하면")
    await card.getByRole("radio", { name: /^1단계 왕초보/ }).check()
    await expect(card.locator('[data-slot="answer-level-example"]')).toContainText("식당의 주문 창구")
    await card.getByRole("button", { name: "수준 저장" }).click()
    await expect(card.locator('p[role="status"]')).toHaveText("답변 수준을 '1단계 왕초보'로 저장했습니다. 다음 답변부터 적용됩니다.")

    await page.reload()
    await expect(page.getByRole("form", { name: "답변 수준" }).getByRole("radio", { name: /^1단계 왕초보/ })).toBeChecked()
})

test("'나중에'를 누르면 이 화면에서만 숨고, 설정 카드에는 아직 고르지 않았다고 보인다", async ({ page }) => {
    await signUp(page, "e2e-level-later")
    await chooser(page).getByRole("button", { name: "나중에" }).click()
    await expect(chooser(page)).toHaveCount(0)

    await openSettings(page)
    await expect(page.locator('[data-slot="answer-level-unset"]')).toContainText("지금은 2단계 입문으로 답합니다")
    await expect(page.getByRole("form", { name: "답변 수준" }).getByRole("radio", { name: /^2단계 입문/ })).toBeChecked()

    // 다시 채팅에 오면 고를 때까지 다시 묻는다.
    await page.getByRole("link", { name: "채팅", exact: true }).click()
    await expect(chooser(page)).toBeVisible()
})

test.describe("관리자", () => {
    test.afterEach(async ({ page }) => {
        await resetLevelNames(page)
    })

    test("단계 이름을 바꾸면 설정 카드와 + 메뉴에 바뀐 이름이 보이고, 기본 이름으로 되돌린다", async ({ page }) => {
        await signInAsAdmin(page)
        await page.goto("/admin")

        const level1 = page.getByRole("form", { name: "1단계 이름" })
        await level1.getByRole("textbox").fill("새내기")
        await level1.getByRole("button", { name: "저장", exact: true }).click()
        await expect(page.getByRole("form", { name: "1단계 이름" }).locator('p[role="status"]')).toHaveText("1단계 이름을 '새내기'로 바꿨습니다.")

        await openSettings(page)
        await expect(page.getByRole("form", { name: "답변 수준" }).getByRole("radio", { name: /^1단계 새내기/ })).toBeVisible()
        await page.getByRole("link", { name: "채팅", exact: true }).click()
        await plusMenu(page).click()
        await expect(levelItem(page, "1단계 새내기")).toBeVisible()
        await page.keyboard.press("Escape")

        await page.goto("/admin")
        await page.getByRole("form", { name: "1단계 이름" }).getByRole("button", { name: "기본 이름으로" }).click()
        await expect(page.getByRole("form", { name: "1단계 이름" }).getByRole("textbox")).toHaveValue("왕초보")
    })
})

test("폰 화면에서도 수준 고르기 안내와 입력칸이 화면 안에 있고 가로로 넘치지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await signUp(page, "e2e-level-phone")
    await expect(chooser(page)).toBeVisible()
    await expect(page.getByLabel("메시지")).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
})
