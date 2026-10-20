import { expect, test, type Page } from "@playwright/test"

import { signUp } from "./helpers"

/** UX-02 캐치프레이즈 전광판. 실제로 10초를 기다리지 않고 걸린 애니메이션의 설정으로 확인한다. */

const NARROW = { width: 560, height: 800 }

function board(page: Page) {
    return page.locator('[data-slot="catchphrase"]')
}

test("공간이 넉넉하면 헤더 정중앙에 양옆 여백을 두고 멈춰 있다", async ({ page }) => {
    await signUp(page, "e2e-marquee")

    await expect(board(page)).toHaveAttribute("data-motion", "static")
    await expect(board(page)).toContainText("풀스택 화이팅")

    const header = (await page.locator("header").boundingBox())!
    const text = (await board(page).locator("span").boundingBox())!
    const nav = (await page.locator("header").getByRole("navigation").boundingBox())!
    const account = (await page.getByRole("button", { name: "계정 메뉴 열기" }).boundingBox())!
    // 헤더의 정중앙
    expect(Math.abs(header.x + header.width / 2 - (text.x + text.width / 2))).toBeLessThan(2)
    // 왼쪽 메뉴·오른쪽 계정 버튼과 붙지 않는다(여백).
    expect(text.x - (nav.x + nav.width)).toBeGreaterThanOrEqual(40)
    expect(account.x - (text.x + text.width)).toBeGreaterThanOrEqual(40)
})

test("공간보다 길면 오른쪽에서 왼쪽으로 흐르고, 다 흐르면 10초 비운 뒤 계속 반복한다", async ({ page }) => {
    await page.setViewportSize(NARROW)
    await signUp(page, "e2e-marquee")

    await expect(board(page)).toHaveAttribute("data-motion", "scroll")
    const animation = await board(page)
        .locator("span")
        .evaluate((element) => {
            const [running] = element.getAnimations()
            const effect = running.effect as KeyframeEffect
            return {
                iterations: effect.getTiming().iterations,
                duration: Number(effect.getTiming().duration),
                frames: effect.getKeyframes().map((frame) => ({ offset: frame.computedOffset, transform: String(frame.transform) })),
            }
        })

    expect(animation.iterations).toBe(Infinity)
    const [start, end, rest] = animation.frames
    // 오른쪽 바깥(+)에서 시작해 왼쪽 바깥(-)으로 빠져나간다.
    expect(start.transform).toMatch(/translateX\(\d/)
    expect(end.transform).toMatch(/translateX\(-/)
    // 빠져나간 자리에서 10초 동안 머문다(비어 보이는 시간).
    expect(rest.transform).toBe(end.transform)
    expect(Math.round(animation.duration * (rest.offset - end.offset))).toBe(10_000)
})

test("동작 줄이기 설정이면 흐르지 않는다", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.setViewportSize(NARROW)
    await signUp(page, "e2e-marquee")

    await expect(board(page)).toHaveAttribute("data-motion", "reduced")
    expect(
        await board(page)
            .locator("span")
            .evaluate((element) => element.getAnimations().length)
    ).toBe(0)
})
