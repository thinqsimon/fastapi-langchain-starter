import { expect, test, type Page } from "@playwright/test"

import { sendChatMessage, signUp } from "./helpers"

/** UX-03 반응형(대화 목록 접기·모바일 화면), UX-04 입력칸 자동 높이 */

const PHONE = { width: 390, height: 844 }

function toggle(page: Page) {
    return page.getByRole("button", { name: "대화 목록 열고 닫기" })
}

function conversationList(page: Page) {
    return page.getByRole("navigation", { name: "대화 목록" })
}

/** 화면에 보이는 모든 입력칸 중 가장 작은 글자 크기(px). 16px 미만이면 모바일 Safari가 누를 때 확대한다. */
async function smallestInputFont(page: Page) {
    return page.evaluate(() =>
        Math.min(
            ...Array.from(document.querySelectorAll<HTMLElement>("input, textarea, select"))
                .filter((element) => element.offsetParent !== null)
                .map((element) => parseFloat(getComputedStyle(element).fontSize))
        )
    )
}

async function hasHorizontalScroll(page: Page) {
    return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
}

test("넓은 화면: 좌측 상단 아이콘으로 대화 목록을 접고 펼친다", async ({ page }) => {
    await signUp(page, "e2e-responsive")

    await expect(conversationList(page)).toBeVisible()
    await toggle(page).click()
    await expect(conversationList(page)).toBeHidden()
    await toggle(page).click()
    await expect(conversationList(page)).toBeVisible()

    // 아이콘은 헤더 왼쪽 끝에 있다.
    const header = (await page.locator("header").boundingBox())!
    const icon = (await toggle(page).boundingBox())!
    expect(icon.x - header.x).toBeLessThan(40)
})

test.describe("터치 폰(390px)", () => {
    test.use({ viewport: PHONE, hasTouch: true, isMobile: true })

    test("대화 목록은 감춰져 있다가 아이콘으로 왼쪽에서 열리고, 대화를 고르면 닫힌다", async ({ page }) => {
        await signUp(page, "e2e-responsive")
        await sendChatMessage(page, "모바일에서 보낸 질문")

        await expect(conversationList(page)).toBeHidden()
        await expect(toggle(page)).toHaveAttribute("aria-expanded", "false")
        await toggle(page).click()
        const drawer = page.getByRole("dialog", { name: "대화 목록" })
        await expect(drawer).toBeVisible()
        await expect.poll(async () => drawer.boundingBox().then((box) => Math.round(box?.x ?? -1))).toBe(0)

        // 터치 기기에는 hover가 없으므로 삭제 버튼이 처음부터 보인다.
        const remove = drawer.getByRole("button", { name: "모바일에서 보낸 질문 삭제" })
        await expect(remove).toHaveCSS("opacity", "1")

        await drawer.getByRole("button", { name: "모바일에서 보낸 질문", exact: true }).click()
        await expect(drawer).toBeHidden()
        await expect(page.locator('[data-role="user"]')).toContainText("모바일에서 보낸 질문")
    })

    test("채팅·일기·설정 화면에 가로 스크롤이 없고, 모든 입력칸 글자는 16px 이상이다", async ({ page }) => {
        await signUp(page, "e2e-responsive")
        // 긴 단어(주소 등)가 있어도 말풍선이 화면 밖으로 넘치지 않아야 한다.
        await sendChatMessage(page, `https://example.com/${"a".repeat(120)}`)
        expect(await hasHorizontalScroll(page)).toBe(false)
        expect(await smallestInputFont(page)).toBeGreaterThanOrEqual(16)

        await page.getByRole("link", { name: "일기" }).click()
        await expect(page.getByRole("heading", { name: "새 배움일기" })).toBeVisible()
        expect(await hasHorizontalScroll(page)).toBe(false)
        expect(await smallestInputFont(page)).toBeGreaterThanOrEqual(16)

        await page.goto("/settings")
        await expect(page.getByRole("heading", { name: "설정" })).toBeVisible()
        expect(await hasHorizontalScroll(page)).toBe(false)
        expect(await smallestInputFont(page)).toBeGreaterThanOrEqual(16)
    })
})

test.describe("터치 태블릿(820px)", () => {
    test.use({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true })

    test("화면이 넓어도 터치 기기면 삭제 버튼이 보이고 입력칸 글자는 16px 이상이다", async ({ page }) => {
        await signUp(page, "e2e-responsive")
        await sendChatMessage(page, "태블릿 질문")

        await expect(page.getByRole("button", { name: "태블릿 질문 삭제" })).toHaveCSS("opacity", "1")
        expect(await smallestInputFont(page)).toBeGreaterThanOrEqual(16)
    })
})

test("서랍을 연 채로 화면이 넓어지면 서랍이 닫히고 화면을 그대로 쓸 수 있다", async ({ page }) => {
    await page.setViewportSize(PHONE)
    await signUp(page, "e2e-responsive")
    await toggle(page).click()
    await expect(page.getByRole("dialog", { name: "대화 목록" })).toBeVisible()

    await page.setViewportSize({ width: 1280, height: 800 })

    await expect(page.getByRole("dialog", { name: "대화 목록" })).toBeHidden()
    await expect(conversationList(page)).toBeVisible()
    // 배경 막(오버레이)이 남아 있으면 이 입력이 막힌다.
    await page.getByLabel("메시지").fill("넓어진 화면에서 입력", { timeout: 3000 })
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "true")
})

test("입력칸은 3줄까지 높이가 늘고, 넘으면 안에서 스크롤되며, 보내면 한 줄로 돌아온다", async ({ page }) => {
    await signUp(page, "e2e-responsive")
    const input = page.getByLabel("메시지")
    const height = () => input.evaluate((element) => element.getBoundingClientRect().height)

    const oneLine = await height()
    await input.fill("첫째 줄\n둘째 줄")
    const twoLines = await height()
    await input.fill("첫째 줄\n둘째 줄\n셋째 줄")
    const threeLines = await height()
    await input.fill("1\n2\n3\n4\n5\n6")
    const sixLines = await height()

    expect(twoLines).toBeGreaterThan(oneLine)
    expect(threeLines).toBeGreaterThan(twoLines)
    expect(sixLines).toBe(threeLines)
    expect(await input.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true)

    await page.getByRole("button", { name: "보내기" }).click()
    await expect(input).toHaveValue("")
    expect(await height()).toBe(oneLine)
})
