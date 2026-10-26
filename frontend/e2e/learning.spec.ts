import { mkdir } from "node:fs/promises"
import { expect, test, type Page } from "@playwright/test"

import { localToday, logOut, newAccount, signUp } from "./helpers"

const backend = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8010"
const weekly = (page: Page) => page.locator('[data-slot="weekly-reviews"]')
const saved = (page: Page) => page.locator('[data-slot="saved-review"]')
const study = (page: Page) => page.locator('[data-slot="study-review"]')
const items = (page: Page) => page.locator('[data-slot="study-item"]')

async function seed(page: Page, fields: Record<string, string> = {}) {
    const access = await page.evaluate(() => localStorage.getItem("access_token"))
    const response = await page.request.post(`${backend}/api/diary`, {
        headers: { Authorization: `Bearer ${access}` },
        data: {
            title: "트랜잭션 학습",
            entry_date: localToday(),
            learned: "트랜잭션은 작업을 하나로 묶는다",
            learned_detail: "### 원자성\n- 함께 성공하거나 함께 취소한다",
            difficult: "롤백과 세션 범위가 헷갈렸다",
            ...fields,
        },
    })
    expect(response.status()).toBe(201)
    return response.json()
}

async function openDiary(page: Page) {
    await page.getByRole("link", { name: "일기", exact: true }).click()
    await expect(page.getByRole("heading", { name: "새 배움일기" })).toBeVisible()
    await expect(weekly(page).getByRole("button", { name: /회고 만들기|저장된 회고 열기/ })).toBeEnabled()
}

async function loginOnPage(page: Page, account: { email: string; password: string }) {
    await page.getByLabel("이메일").fill(account.email)
    await page.getByLabel("비밀번호").fill(account.password)
    await page.getByRole("button", { name: "로그인", exact: true }).click()
    await expect(page).toHaveURL(/\/chat$/)
}

test("주간 회고는 바로 저장되고 새로고침·재로그인 후 다시 열며 중복 생성하지 않는다", async ({ page }) => {
    const account = await signUp(page, "learning-save")
    await openDiary(page)
    await page.getByLabel("오늘 배운 것").fill("트랜잭션을 배웠다")
    await page.getByLabel("어려웠던 것").fill("격리 수준")
    await page.getByRole("button", { name: "저장", exact: true }).click()
    await expect(items(page)).toHaveCount(1)
    let calls = 0
    page.on("request", (request) => {
        if (request.url().endsWith("/api/diary/reviews") && request.method() === "POST") calls += 1
    })
    await weekly(page).getByRole("button", { name: "회고 만들기", exact: true }).click()
    await expect(saved(page)).toContainText("성장한 점")
    await expect(page.getByRole("status")).toContainText("회고를 저장했어요")
    const snapshot = await saved(page).innerText()
    await weekly(page).getByRole("button", { name: "저장된 회고 열기" }).click()
    expect(calls).toBe(1)
    await page.reload()
    await expect(saved(page)).toHaveText(snapshot, { useInnerText: true })
    await logOut(page)
    await loginOnPage(page, account)
    await openDiary(page)
    await expect(saved(page)).toHaveText(snapshot, { useInnerText: true })
    await expect(page.getByLabel("저장된 회고").locator("option")).toHaveCount(2)
})

test("지난 주를 선택해 저장·조회하고 삭제를 확인한 경우에만 지운다", async ({ page }) => {
    await signUp(page, "learning-history")
    await seed(page, { entry_date: "2000-01-05", title: "지난 배움" })
    await seed(page)
    await openDiary(page)
    await page.getByLabel("회고 기준 날짜").fill("2000-01-05")
    await weekly(page).getByRole("button", { name: "회고 만들기", exact: true }).click()
    await expect(saved(page)).toContainText("2000-01-03 ~ 2000-01-09 · 일기 1편")
    const oldId = await page.getByLabel("저장된 회고").inputValue()
    await page.getByLabel("회고 기준 날짜").fill(localToday())
    await weekly(page).getByRole("button", { name: "회고 만들기", exact: true }).click()
    await expect(saved(page)).toBeVisible()
    await expect(page.getByLabel("저장된 회고").locator("option")).toHaveCount(3)
    await page.getByLabel("저장된 회고").selectOption(oldId)
    await weekly(page).getByRole("button", { name: "회고 삭제", exact: true }).click()
    const dialog = page.getByRole("dialog", { name: "저장한 회고를 삭제할까요?" })
    await dialog.getByRole("button", { name: "취소", exact: true }).click()
    await expect(saved(page)).toContainText("2000-01-03")
    await weekly(page).getByRole("button", { name: "회고 삭제", exact: true }).click()
    await dialog.getByRole("button", { name: "삭제하기" }).click()
    await expect(page.getByLabel("저장된 회고").locator("option")).toHaveCount(2)
    await expect(page.locator('[data-slot="diary-entry"]')).toHaveCount(2)
})

test("일기가 없거나 회고 생성이 실패하면 저장하지 않고 재시도할 수 있다", async ({ page }) => {
    await signUp(page, "learning-errors")
    await openDiary(page)
    await weekly(page).getByRole("button", { name: "회고 만들기", exact: true }).click()
    await expect(page.locator('p[role="alert"]')).toContainText("일기가 없습니다")
    await expect(saved(page)).toHaveCount(0)
    await seed(page)
    await page.reload()
    await expect(weekly(page).getByRole("button", { name: "회고 만들기", exact: true })).toBeEnabled()
    await page.route(
        "**/api/diary/reviews",
        async (route) => {
            if (route.request().method() !== "POST") return route.continue()
            await route.fulfill({ status: 502, json: { error: { code: "LLM_ERROR", message: "지금은 회고를 만들 수 없어요." } } })
        },
        { times: 1 }
    )
    await weekly(page).getByRole("button", { name: "회고 만들기", exact: true }).click()
    await expect(page.locator('p[role="alert"]')).toHaveText("지금은 회고를 만들 수 없어요.")
    await expect(saved(page)).toHaveCount(0)
    await weekly(page).getByRole("button", { name: "회고 만들기", exact: true }).click()
    await expect(saved(page)).toBeVisible()
})

test("어려웠던 내용·학습 원문·메모·완료·다시 복습을 저장하고 다시 연다", async ({ page }) => {
    await signUp(page, "learning-study")
    await seed(page)
    await seed(page, { title: "어려움 없는 일기", difficult: "없음" })
    await openDiary(page)
    await expect(items(page)).toHaveCount(1)
    await items(page).getByText("학습 내용 다시 보기", { exact: true }).click()
    await expect(items(page).getByRole("heading", { name: "원자성" })).toBeVisible()
    await items(page).getByLabel("복습 메모").fill("원자성은 함께 성공하거나 함께 롤백하는 성질이다")
    await items(page).getByRole("button", { name: "메모 저장", exact: true }).click()
    await expect(page.getByRole("status")).toContainText("복습 메모와 진행 상태")
    await page.reload()
    await expect(items(page).getByLabel("복습 메모")).toHaveValue("원자성은 함께 성공하거나 함께 롤백하는 성질이다")
    await items(page).getByRole("button", { name: "복습 완료", exact: true }).click()
    await expect(items(page)).toHaveCount(0)
    await study(page).getByRole("button", { name: "완료한 내용 (1)", exact: true }).click()
    await expect(items(page).getByRole("button", { name: "다시 복습", exact: true })).toBeVisible()
    await page.reload()
    await study(page).getByRole("button", { name: "완료한 내용 (1)", exact: true }).click()
    await expect(items(page).getByLabel("복습 메모")).toHaveValue("원자성은 함께 성공하거나 함께 롤백하는 성질이다")
    await items(page).getByRole("button", { name: "다시 복습", exact: true }).click()
    await expect(items(page)).toHaveCount(0)
    await study(page).getByRole("button", { name: "복습할 내용 (1)", exact: true }).click()
    await expect(items(page)).toHaveCount(1)
})

test("메모 저장 실패 시 입력을 유지하고 재시도 중에는 중복 저장을 막는다", async ({ page }) => {
    await signUp(page, "learning-note-error")
    await seed(page)
    await openDiary(page)
    await items(page).getByLabel("복습 메모").fill("실패해도 남겨야 하는 메모")
    await page.route(
        "**/api/diary/study/*",
        (route) => route.fulfill({ status: 503, json: { error: { code: "UNAVAILABLE", message: "저장에 실패했어요." } } }),
        { times: 1 }
    )
    await items(page).getByRole("button", { name: "메모 저장", exact: true }).click()
    await expect(page.locator('p[role="alert"]')).toHaveText("저장에 실패했어요.")
    await expect(items(page).getByLabel("복습 메모")).toHaveValue("실패해도 남겨야 하는 메모")
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
        release = resolve
    })
    let calls = 0
    await page.route("**/api/diary/study/*", async (route) => {
        calls += 1
        const response = await route.fetch()
        await gate
        await route.fulfill({ response })
    })
    await items(page).getByRole("button", { name: "메모 저장", exact: true }).click()
    await expect(items(page).getByLabel("복습 메모")).toBeDisabled()
    await expect(items(page).getByRole("button", { name: "저장 중…" })).toBeDisabled()
    release()
    await expect(page.getByRole("status")).toContainText("복습 메모와 진행 상태")
    expect(calls).toBe(1)
    await page.reload()
    await expect(items(page).getByLabel("복습 메모")).toHaveValue("실패해도 남겨야 하는 메모")
})

test("저장 응답이 늦어도 수정한 어려움과 해제된 복습 완료 상태를 덮지 않는다", async ({ page }) => {
    await signUp(page, "learning-source-race")
    await seed(page)
    await openDiary(page)
    let release!: () => void
    let stored!: () => void
    const gate = new Promise<void>((resolve) => {
        release = resolve
    })
    const written = new Promise<void>((resolve) => {
        stored = resolve
    })
    await page.route("**/api/diary/study/*", async (route) => {
        const response = await route.fetch()
        stored()
        await gate
        await route.fulfill({ response })
    })
    await items(page).getByLabel("복습 메모").fill("내 복습 메모")
    await items(page).getByRole("button", { name: "복습 완료", exact: true }).click()
    await written
    await page.locator('[data-slot="diary-entry"]').getByRole("button", { name: "수정", exact: true }).click()
    await page.getByLabel("어려웠던 것", { exact: true }).fill("변경한 새로운 어려움")
    await page.getByRole("button", { name: "수정 저장", exact: true }).click()
    await expect(items(page)).toContainText("변경한 새로운 어려움")
    release()
    await expect(page.getByRole("status")).toHaveText("최신 복습 내용을 확인했어요.")
    await expect(items(page)).toContainText("변경한 새로운 어려움")
    await expect(items(page).getByRole("button", { name: "복습 완료", exact: true })).toBeEnabled()
    await expect(items(page).getByLabel("복습 메모")).toHaveValue("내 복습 메모")
    await page.reload()
    await expect(items(page)).toContainText("변경한 새로운 어려움")
})

test("회고 생성 중 중복 요청을 막고 로그아웃 뒤 응답을 다른 계정에 표시하지 않는다", async ({ page }) => {
    await signUp(page, "learning-session")
    await seed(page)
    const other = newAccount("learning-other")
    expect(
        (
            await page.request.post(`${backend}/api/auth/signup`, { data: { email: other.email, password: other.password, display_name: other.displayName } })
        ).status()
    ).toBe(201)
    await openDiary(page)
    let release!: () => void
    let stored!: () => void
    const gate = new Promise<void>((resolve) => {
        release = resolve
    })
    const written = new Promise<void>((resolve) => {
        stored = resolve
    })
    let calls = 0
    await page.route("**/api/diary/reviews", async (route) => {
        if (route.request().method() !== "POST") return route.continue()
        calls += 1
        const response = await route.fetch()
        stored()
        await gate
        await route.fulfill({ response })
    })
    await weekly(page).getByRole("button", { name: "회고 만들기", exact: true }).click()
    await expect(weekly(page).getByRole("button", { name: "정리하고 저장 중…" })).toBeDisabled()
    await written
    await logOut(page)
    await loginOnPage(page, other)
    await openDiary(page)
    const finished = page.waitForResponse((response) => response.url().endsWith("/api/diary/reviews") && response.request().method() === "POST")
    release()
    await (await finished).finished()
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
    await expect(saved(page)).toHaveCount(0)
    await expect(items(page)).toHaveCount(0)
    await expect(page.getByLabel("저장된 회고").locator("option")).toHaveCount(1)
    await expect(page.getByText("회고를 저장했어요. 다음에 다시 열어볼 수 있어요.")).toHaveCount(0)
    expect(calls).toBe(1)
})

test("데스크톱·모바일 회고와 복습 화면에 가로 넘침이 없다", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await signUp(page, "learning-visual")
    await seed(page)
    await openDiary(page)
    await weekly(page).getByRole("button", { name: "회고 만들기", exact: true }).click()
    await expect(saved(page)).toBeVisible()
    await items(page).getByLabel("복습 메모").fill("트랜잭션 범위를 예제로 설명하고 세션 종료 시점을 확인했어요.")
    await items(page).getByRole("button", { name: "메모 저장", exact: true }).click()
    await expect(page.getByRole("status")).toContainText("복습 메모와 진행 상태")
    await mkdir("coach-ui-previews", { recursive: true })
    await weekly(page).scrollIntoViewIfNeeded()
    await page.screenshot({ path: "coach-ui-previews/desktop-learning.png", animations: "disabled" })
    await page.setViewportSize({ width: 390, height: 844 })
    await weekly(page).scrollIntoViewIfNeeded()
    expect(await weekly(page).evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: "coach-ui-previews/mobile-weekly-review.png", animations: "disabled" })
    await items(page).scrollIntoViewIfNeeded()
    await expect(items(page).getByRole("button", { name: "복습 완료", exact: true })).toBeInViewport()
    await page.screenshot({ path: "coach-ui-previews/mobile-study.png", animations: "disabled" })
})
