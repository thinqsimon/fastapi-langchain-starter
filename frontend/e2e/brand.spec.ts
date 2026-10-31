import { expect, test, type Page } from "@playwright/test"

import { DEMO_VIDEO, signUp } from "./helpers"

/** BRAND-01 로고·파비콘 */

test("탭 제목·파비콘·홈 화면 아이콘·웹앱 매니페스트가 연결돼 있다", async ({ page, request }) => {
    await page.goto("/sign-in")

    await expect(page).toHaveTitle("배움일기 코치")
    const head = page.locator("head")
    await expect(head.locator('link[rel="icon"][href*="favicon.ico"]')).toHaveCount(1)
    await expect(head.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveCount(1)
    await expect(head.locator('link[rel="apple-touch-icon"]')).toHaveCount(1)
    await expect(head.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute("content", "배움일기 코치")

    const manifestHref = await head.locator('link[rel="manifest"]').getAttribute("href")
    const manifest = await (await request.get(manifestHref!)).json()
    expect(manifest.name).toBe("배움일기 코치")

    // 연결된 아이콘 파일이 실제로 내려온다.
    for (const href of ["/favicon.ico", "/brand/logo.svg", "/brand/logo-small.svg", ...manifest.icons.map((icon: { src: string }) => icon.src)]) {
        expect((await request.get(href)).status(), href).toBe(200)
    }
    const appleIcon = await head.locator('link[rel="apple-touch-icon"]').getAttribute("href")
    expect((await request.get(appleIcon!)).headers()["content-type"]).toContain("image/png")
})

test("로그인 화면 위쪽에 로고와 서비스 이름이 보인다", async ({ page }) => {
    await page.goto("/sign-in")

    const logo = page.locator('main img[src="/brand/logo.svg"]')
    await expect(logo).toBeVisible()
    await expect(page.getByText("LEARNING DIARY COACH")).toBeVisible()
})

/** 화면 폭에 맞는 버튼 하나만 보이고(다른 하나는 감춰져 역할 목록에 없다), 그 영상을 새 탭으로 연다. */
async function expectDemoVideoLink(page: Page, href: string) {
    const demo = page.getByRole("link", { name: "사용법 시연" })
    await expect(demo).toBeVisible()
    await expect(demo).toHaveAttribute("href", href)
    await expect(demo).toHaveAttribute("target", "_blank")
}

test("첫 화면(로그인)과 가입 화면의 '사용법 시연' 버튼은 화면 폭에 맞는 시연 영상을 새 탭으로 연다", async ({ page }) => {
    // 사이트 주소(/)로 들어오면 /chat을 거쳐 로그인 화면이 첫 화면으로 뜬다. 넓은 화면은 PC 화면판 영상이다.
    await page.goto("/")
    await expect(page).toHaveURL(/\/sign-in$/)
    await expectDemoVideoLink(page, DEMO_VIDEO.desktop)

    await page.goto("/sign-up")
    await expectDemoVideoLink(page, DEMO_VIDEO.desktop)

    // 폰 화면(768px 미만)에서는 폰 화면판 영상으로 바뀐다.
    await page.setViewportSize({ width: 390, height: 844 })
    await expectDemoVideoLink(page, DEMO_VIDEO.phone)
    await page.goto("/sign-in")
    await expectDemoVideoLink(page, DEMO_VIDEO.phone)
})

test("헤더 왼쪽 로고를 누르면 채팅으로 가고, 좁은 화면에서는 로고만 보인다", async ({ page }) => {
    await signUp(page, "e2e-brand")
    await page.getByRole("link", { name: "일기", exact: true }).click()
    await expect(page).toHaveURL(/\/diary$/)

    const home = page.getByRole("link", { name: "배움일기 코치 홈" })
    await expect(home.locator("img")).toBeVisible()
    await home.click()
    await expect(page).toHaveURL(/\/chat$/)

    await page.setViewportSize({ width: 390, height: 844 })
    await expect(home.locator("img")).toBeVisible()
    await expect(home.getByText("배움일기 코치")).toBeHidden()
})
