import { expect, test } from "@playwright/test"

import { openAccountMenu, signUp } from "./helpers"

/** 사용 안내 화면: 계정 메뉴에서 열리고, 목차·단원·스킬 입력 예시가 보인다. */

test("계정 메뉴의 '사용 안내'를 누르면 안내 화면이 열리고 목차로 단원을 오갈 수 있다", async ({ page }) => {
    await signUp(page, "e2e-guide")

    const menu = await openAccountMenu(page)
    await menu.getByRole("button", { name: "사용 안내" }).click()
    await expect(page).toHaveURL(/\/guide$/)
    await expect(page.getByRole("heading", { level: 1, name: "사용 안내" })).toBeVisible()

    // 목차의 단원 링크로 이동하면 그 단원 제목이 화면에 들어온다.
    const toc = page.getByRole("navigation", { name: "사용 안내 목차" })
    await toc.getByRole("link", { name: "학습장" }).click()
    await expect(page).toHaveURL(/#notebook$/)
    await expect(page.getByRole("heading", { level: 2, name: "학습장" })).toBeInViewport()

    // 스킬 단원에는 실제 입력 문구가 터미널 패널로 들어 있다.
    await toc.getByRole("link", { name: "/study-notes 스킬" }).click()
    await expect(page.getByRole("heading", { level: 2, name: /study-notes 스킬/ })).toBeInViewport()
    await expect(page.locator('[data-slot="terminal"]').filter({ hasText: "/plugin install study-notes@thinqsimon" }).first()).toBeVisible()

    // 스크린샷은 모두 설명(alt)을 가진다.
    const images = page.locator("main img")
    expect(await images.count()).toBeGreaterThan(10)
    for (const alt of await images.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("alt") ?? ""))) {
        expect(alt.length).toBeGreaterThan(0)
    }
})

test("주소에 단원 id를 붙여 열면 그 단원부터 보이고, 학습장 도움말에서 스킬 단원으로 이어진다", async ({ page }) => {
    await signUp(page, "e2e-guide")

    await page.goto("/notebook")
    await page.getByRole("button", { name: "도움말" }).click()
    await page.getByRole("dialog").getByRole("link", { name: "사용 안내의 스킬 단원" }).click()
    await expect(page).toHaveURL(/\/guide#skill$/)
    await expect(page.getByRole("heading", { level: 2, name: /study-notes 스킬/ })).toBeInViewport()
})

test("폰 화면에서는 목차가 접힌 상태로 위에 있고 가로로 넘치지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await signUp(page, "e2e-guide")
    await page.goto("/guide")

    const summary = page.getByText("목차 펼치기")
    await expect(summary).toBeVisible()
    await summary.click()
    await expect(page.getByRole("link", { name: "답변 수준 5단계" }).first()).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(overflow).toBe(false)
})
