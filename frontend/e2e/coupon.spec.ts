import { expect, test, type Page } from "@playwright/test"

import { logOut, openAccountMenu, openSettings, signIn, signUp } from "./helpers"

/** COUPON-01: 관리자가 쿠폰을 발급·복사·취소하고, 사용자가 등록하면 요금제가 바뀐다. */

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8010"
const ADMIN = { email: "e2e-admin@example.com", password: "e2e-secret-password", displayName: "E2E 관리자" }
const CODE_RE = /^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/

test.use({ permissions: ["clipboard-read", "clipboard-write"] })

async function signInAsAdmin(page: Page) {
    await page.request.post(`${API}/api/auth/signup`, {
        data: { email: ADMIN.email, password: ADMIN.password, display_name: ADMIN.displayName },
    })
    await signIn(page, ADMIN.email, ADMIN.password)
    await expect(page).toHaveURL(/\/chat$/)
}

test("관리자가 쿠폰을 발급해 복사·취소하고, 사용자가 등록하면 요금제가 바뀐다", async ({ page }) => {
    await signInAsAdmin(page)
    await page.goto("/admin")

    // 발급: Pro 1개월, 7일 안에 등록, 2장
    const issue = page.getByRole("form", { name: "쿠폰 발급" })
    await issue.getByLabel("요금제").selectOption("pro")
    await issue.getByLabel("기간").selectOption("1m")
    await issue.getByLabel("등록 기한").selectOption("7")
    await issue.getByLabel("수량").fill("2")
    await issue.getByLabel("메모").fill("E2E 테스트")
    await issue.getByRole("button", { name: "발급", exact: true }).click()
    await expect(issue.locator('p[role="status"]')).toContainText("2장을 발급했습니다")

    const issued = page.getByRole("region", { name: "발급된 쿠폰" })
    const codes = await issued.locator("code").allTextContents()
    expect(codes).toHaveLength(2)
    for (const code of codes) expect(code).toMatch(CODE_RE)
    expect(new Set(codes).size).toBe(2)

    // 모두 복사: 코드·적용 내용·사용처(현재 사이트 주소)가 들어간다.
    await issued.getByRole("button", { name: "모두 복사" }).click()
    await expect(issued.locator('[data-slot="copy-status"]')).toHaveText("2장 안내문을 복사했습니다.")
    const clipboard = await page.evaluate(() => navigator.clipboard.readText())
    const origin = new URL(page.url()).origin
    for (const code of codes) expect(clipboard).toContain(`쿠폰 코드: ${code}`)
    expect(clipboard).toContain("Pro 1개월")
    expect(clipboard).toContain(`사용처: ${origin}`)
    expect(clipboard).toContain("쿠폰 등록")

    // 목록에서 두 번째 쿠폰을 취소한다. 취소된 쿠폰은 취소 버튼이 사라진다.
    const list = page.getByRole("list", { name: "쿠폰 목록" })
    const secondRow = list.locator('[data-slot="coupon-row"]', { hasText: codes[1] })
    await secondRow.getByRole("button", { name: `${codes[1]} 취소` }).click()
    await expect(secondRow).toHaveAttribute("data-status", "revoked")
    await expect(secondRow.getByRole("button", { name: `${codes[1]} 취소` })).toHaveCount(0)
    await logOut(page)

    // 사용자: 설정 → 요금제와 쿠폰. 소문자로 넣어도 등록된다.
    await signUp(page, "e2e-coupon")
    await openSettings(page)
    const card = page.getByRole("form", { name: "쿠폰 등록" })
    const currentPlan = page.locator('[data-slot="current-plan"]')
    await expect(currentPlan).toHaveText("Free")
    await card.getByLabel("쿠폰 코드").fill(codes[0].toLowerCase())
    await card.getByRole("button", { name: "쿠폰 등록" }).click()
    await expect(card.locator('p[role="status"]')).toContainText("Pro 1개월 쿠폰을 등록했어요.")
    await expect(currentPlan).toContainText("Pro · ")
    await expect(currentPlan).toContainText("까지")

    // 다시 쓰거나 취소된 쿠폰은 안 된다.
    await card.getByLabel("쿠폰 코드").fill(codes[0])
    await card.getByRole("button", { name: "쿠폰 등록" }).click()
    await expect(card.locator('p[role="alert"]')).toHaveText("이미 사용한 쿠폰이에요.")
    await card.getByLabel("쿠폰 코드").fill(codes[1])
    await card.getByRole("button", { name: "쿠폰 등록" }).click()
    await expect(card.locator('p[role="alert"]')).toHaveText("취소된 쿠폰이에요.")
    await card.getByLabel("쿠폰 코드").fill("ZZZZ-ZZZZ-ZZZZ")
    await card.getByRole("button", { name: "쿠폰 등록" }).click()
    await expect(card.locator('p[role="alert"]')).toContainText("없는 쿠폰 코드예요")

    // 상위 요금제(Max) 쿠폰은 남은 Pro 기간이 사라진다는 확인을 거친다.
    const adminToken = (await (await page.request.post(`${API}/api/auth/login`, { data: { email: ADMIN.email, password: ADMIN.password } })).json())
        .access_token
    const [maxCoupon] = await (
        await page.request.post(`${API}/api/admin/coupons`, {
            headers: { Authorization: `Bearer ${adminToken}` },
            data: { plan: "max", duration: "7d", valid_days: 7, quantity: 1 },
        })
    ).json()
    await card.getByLabel("쿠폰 코드").fill(maxCoupon.code)
    await card.getByRole("button", { name: "쿠폰 등록" }).click()
    const dialog = page.getByRole("dialog", { name: "남은 기간이 사라져요" })
    await expect(dialog).toContainText("Max 7일")
    await expect(currentPlan).toContainText("Pro · ") // 아직 바뀌지 않았다
    await dialog.getByRole("button", { name: "계속 등록" }).click()
    await expect(card.locator('p[role="status"]')).toContainText("Max 7일 쿠폰을 등록했어요.")
    await expect(currentPlan).toContainText("Max · ")

    // 계정 메뉴에도 같은 요금제와 만료일이 보인다.
    const menu = await openAccountMenu(page)
    await expect(menu.locator('[data-slot="account-plan"]')).toContainText("Max · ")
})
