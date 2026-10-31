import { mkdir } from "node:fs/promises"
import { expect, test, type Page } from "@playwright/test"

import { DEMO_VIDEO, logOut, openSettings, sendChatMessage, signUp } from "./helpers"

/** 입력칸 왼쪽 + 버튼. 일기 만들기는 이 메뉴 안에 있다. 초안을 만드는 동안은 이름이 "일기 초안 만드는 중…"으로 바뀐다. */
const composerMenu = (page: Page) => page.getByRole("button", { name: "추가 기능", exact: true })
const draftItem = (page: Page) => page.getByRole("menuitem", { name: /이 대화로 일기 만들기/ })

/** 메뉴를 열어 '이 대화로 일기 만들기' 항목이 눌리는 상태인지 확인하고 닫는다. */
async function expectDraft(page: Page, enabled: boolean) {
    await composerMenu(page).click()
    if (enabled) await expect(draftItem(page)).toBeEnabled()
    else await expect(draftItem(page)).toBeDisabled()
    await page.keyboard.press("Escape")
    await expect(page.getByRole("menu")).toHaveCount(0)
}

/** 채팅 상단 버튼과 + 메뉴의 사용법 동영상이 같은 영상을 새 탭(폰에서는 유튜브 앱)으로 여는지 확인한다. */
async function expectGuideVideo(page: Page, href: string) {
    const guide = page.getByRole("link", { name: "사용법 동영상 열기" })
    await expect(guide).toHaveAttribute("href", href)
    await expect(guide).toHaveAttribute("target", "_blank")
    await composerMenu(page).click()
    await expect(page.getByRole("menuitem", { name: "사용법 동영상 열기" })).toHaveAttribute("href", href)
    await page.keyboard.press("Escape")
    await expect(page.getByRole("menu")).toHaveCount(0)
}

async function clickDraft(page: Page) {
    await composerMenu(page).click()
    await draftItem(page).click()
}
const diaryLink = (page: Page) => page.getByRole("link", { name: "일기", exact: true })
const chatLink = (page: Page) => page.getByRole("link", { name: "채팅", exact: true })
const entryCards = (page: Page) => page.locator('[data-slot="diary-entry"]')

test("구름 코치 시작 화면·추천 질문·응답 아바타와 데스크톱 미리보기", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 })
    await signUp(page, "coach-visual")
    await expect(page.getByRole("heading", { name: /구름 코치와 풀어볼까요/ })).toBeVisible()
    const mascot = page.getByRole("img", { name: "헤드셋을 쓰고 웃는 구름 코치" })
    await expect(mascot).toBeVisible()
    await expect.poll(() => mascot.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
    await expectDraft(page, false)
    // 넓은 화면의 사용법 동영상은 PC 화면판 시연 영상이다.
    await expectGuideVideo(page, DEMO_VIDEO.desktop)
    await mkdir("coach-ui-previews", { recursive: true })
    await page.screenshot({ path: "coach-ui-previews/desktop-welcome.png", animations: "disabled" })
    await page.getByRole("button", { name: "오늘 배운 개념을 예시로 설명해 줘" }).click()
    await expect(page.locator('[data-role="assistant"]:not([data-pending])')).toHaveCount(1)
    await expectDraft(page, true)
    await expect(page.locator('[data-role="assistant"]').getByText("구름 코치", { exact: true })).toBeVisible()
    await page.screenshot({ path: "coach-ui-previews/desktop-conversation.png", animations: "disabled" })
})

test("현재 대화로 초안만 만들고 수정·저장하며, 새 대화 없는 재생성은 차단한다", async ({ page }) => {
    await signUp(page, "coach-origin")
    await sendChatMessage(page, "먼저 FastAPI를 배웠어요")
    await expect(page.getByRole("button", { name: "먼저 FastAPI를 배웠어요", exact: true })).toBeVisible()
    await diaryLink(page).click()
    await expect(page.getByLabel("일기로 만들 채팅")).not.toHaveValue("")
    const previousId = await page.getByLabel("일기로 만들 채팅").inputValue()
    await chatLink(page).click()
    const created = page.waitForResponse((response) => response.url().endsWith("/api/conversations") && response.request().method() === "POST")
    await page.getByRole("button", { name: "새 대화", exact: true }).click()
    const current = await (await created).json()
    expect(current.id).not.toBe(previousId)
    await sendChatMessage(page, "새 대화에서는 React 상태 관리를 배웠어요")

    const saves: Record<string, unknown>[] = []
    page.on("request", (request) => {
        if (request.url().endsWith("/api/diary") && request.method() === "POST") saves.push(request.postDataJSON())
    })
    const draftResponse = page.waitForResponse((response) => response.url().endsWith("/api/diary/draft"))
    await clickDraft(page)
    const response = await draftResponse
    expect(response.request().postDataJSON().conversation_id).toBe(current.id)
    const draft = await response.json()
    await expect(page).toHaveURL(/\/diary$/)
    await expect(page.getByLabel("배운 내용 상세")).not.toHaveValue("")
    await expect(entryCards(page)).toHaveCount(0)
    expect(saves).toEqual([])
    await page.getByLabel("오늘 배운 것").fill("내 말로 고친 React 학습 기록")
    await page.getByRole("button", { name: "저장", exact: true }).click()
    await expect(entryCards(page)).toHaveCount(1)
    await expect(entryCards(page)).toContainText("내 말로 고친 React 학습 기록")
    expect(saves).toHaveLength(1)
    expect(saves[0]).toMatchObject({ conversation_id: current.id, source_last_message_at: draft.source_last_message_at, entry_date: draft.entry_date })
    await chatLink(page).click()
    const conflict = page.waitForResponse((response) => response.url().endsWith("/api/diary/draft"))
    await clickDraft(page)
    expect((await conflict).status()).toBe(409)
    await expect(page.locator('p[role="alert"]')).toBeVisible()
    await expect(page).toHaveURL(/\/chat$/)
    await sendChatMessage(page, "이어서 React의 useState도 배웠어요")
    await clickDraft(page)
    await expect(page).toHaveURL(/\/diary$/)
    await expect(page.getByLabel("오늘 배운 것")).not.toHaveValue("")
    await expect(entryCards(page)).toHaveCount(1)
})

test("미저장 일기는 취소·생성 실패 후에도 유지하고, 확인한 경우에만 새 초안으로 바꾼다", async ({ page }) => {
    await signUp(page, "coach-unsaved")
    await sendChatMessage(page, "JWT 리프레시 토큰을 배웠어요")
    await diaryLink(page).click()
    await page.getByLabel("오늘 배운 것").fill("아직 저장하지 않은 나의 기록")
    await chatLink(page).click()
    let requests = 0
    page.on("request", (request) => {
        if (request.url().endsWith("/api/diary/draft")) requests += 1
    })
    await clickDraft(page)
    await expect(page.getByRole("dialog", { name: "저장하지 않은 일기가 있어요" })).toBeVisible()
    await page.getByRole("button", { name: "취소", exact: true }).click()
    expect(requests).toBe(0)
    await page.route(
        "**/api/diary/draft",
        (route) => route.fulfill({ status: 503, json: { error: { code: "llm_unavailable", message: "잠시 후 다시 시도해 주세요." } } }),
        { times: 1 }
    )
    await clickDraft(page)
    await page.getByRole("button", { name: "새 초안으로 바꾸기" }).click()
    await expect(page.locator('p[role="alert"]')).toHaveText("잠시 후 다시 시도해 주세요.")
    await diaryLink(page).click()
    await expect(page.getByLabel("오늘 배운 것")).toHaveValue("아직 저장하지 않은 나의 기록")
    await chatLink(page).click()
    await clickDraft(page)
    await page.getByRole("button", { name: "새 초안으로 바꾸기" }).click()
    await expect(page).toHaveURL(/\/diary$/)
    await expect(page.getByLabel("오늘 배운 것")).not.toHaveValue("아직 저장하지 않은 나의 기록")
    await expect(entryCards(page)).toHaveCount(0)
})

test("응답이 끝나기 전에는 일기 생성을 막는다", async ({ page }) => {
    await signUp(page, "coach-stream")
    await sendChatMessage(page, "처음 배운 내용")
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
        release = resolve
    })
    await page.route("**/api/conversations/*/stream", async (route) => {
        const response = await route.fetch()
        await gate
        await route.fulfill({ response })
    })
    await page.getByLabel("메시지").fill("이어서 공부한 내용")
    await page.getByRole("button", { name: "보내기", exact: true }).click()
    await expectDraft(page, false)
    await expect(page.locator('[data-role="assistant"][data-pending]')).toBeVisible()
    release()
    await expect(page.locator('[data-role="assistant"]:not([data-pending])')).toHaveCount(2)
    await expectDraft(page, true)
})

test("생성 중 중복 요청을 막고, 기다리는 동안 쓴 일기를 늦은 응답으로 덮지 않는다", async ({ page }) => {
    await signUp(page, "coach-race")
    await sendChatMessage(page, "비동기 처리를 배웠어요")
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
        release = resolve
    })
    let requests = 0
    await page.route("**/api/diary/draft", async (route) => {
        requests += 1
        const response = await route.fetch()
        await gate
        await route.fulfill({ response })
    })
    await clickDraft(page)
    await expect(page.getByRole("button", { name: "일기 초안 만드는 중…" })).toBeDisabled()
    await expect(page.locator('p[role="status"]')).toContainText("정리하고 있어요")
    await diaryLink(page).click()
    await page.getByLabel("오늘 배운 것").fill("기다리면서 직접 작성한 내용")
    release()
    await expect(page.locator('p[role="alert"]')).toContainText("작성 중인 일기를 보호")
    await expect(page.getByLabel("오늘 배운 것")).toHaveValue("기다리면서 직접 작성한 내용")
    expect(requests).toBe(1)
})

test("로그아웃 후 도착한 초안은 화면을 이동하거나 재로그인 상태에 남지 않는다", async ({ page }) => {
    const account = await signUp(page, "coach-session")
    await sendChatMessage(page, "로그인 세션을 배웠어요")
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
        release = resolve
    })
    let completed!: () => void
    const finished = new Promise<void>((resolve) => {
        completed = resolve
    })
    await page.route("**/api/diary/draft", async (route) => {
        const response = await route.fetch()
        await gate
        await route.fulfill({ response })
        completed()
    })
    await clickDraft(page)
    await expect(page.getByRole("button", { name: "일기 초안 만드는 중…" })).toBeDisabled()
    // 서버의 로그아웃 호출이 실패해도 로컬 세션과 대기 중인 초안은 해제되어야 한다.
    await page.route("**/api/auth/logout", (route) => route.fulfill({ status: 503, json: { error: { code: "unavailable", message: "서버 일시 장애" } } }))
    await logOut(page)
    release()
    await finished
    await page.getByLabel("이메일").fill(account.email)
    await page.getByLabel("비밀번호").fill(account.password)
    await page.getByRole("button", { name: "로그인", exact: true }).click()
    await expect(page).toHaveURL(/\/chat$/)
    await expectDraft(page, false)
    await diaryLink(page).click()
    await expect(page.getByLabel("오늘 배운 것")).toHaveValue("")
})

test("일기 화면에서도 미저장 교체를 확인하고, 저장 중에는 입력을 잠근다", async ({ page }) => {
    await signUp(page, "coach-save")
    await sendChatMessage(page, "PostgreSQL 트랜잭션을 배웠어요")
    await diaryLink(page).click()
    await page.getByLabel("오늘 배운 것").fill("보호할 입력")
    await page.getByRole("button", { name: "초안 만들기", exact: true }).click()
    await expect(page.getByRole("dialog", { name: "저장하지 않은 일기가 있어요" })).toBeVisible()
    await page.getByRole("button", { name: "취소", exact: true }).click()
    await expect(page.getByLabel("오늘 배운 것")).toHaveValue("보호할 입력")
    await page.getByRole("button", { name: "초안 만들기", exact: true }).click()
    await page.getByRole("button", { name: "새 초안으로 바꾸기" }).click()
    await expect(page.getByLabel("배운 내용 상세")).not.toHaveValue("")
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
        release = resolve
    })
    await page.route("**/api/diary", async (route) => {
        if (route.request().method() !== "POST") return route.continue()
        const response = await route.fetch()
        await gate
        await route.fulfill({ response })
    })
    await page.getByRole("button", { name: "저장", exact: true }).click()
    await expect(page.getByLabel("오늘 배운 것")).toBeDisabled()
    await expect(page.getByRole("button", { name: "저장 중…" })).toBeDisabled()
    release()
    await expect(entryCards(page)).toHaveCount(1)
    await expect(page.getByLabel("오늘 배운 것")).toBeEnabled()
    await expect(page.getByLabel("오늘 배운 것")).toHaveValue("")
})

test("초안 대기 중 채팅을 바꾸어도 출처를 유지하고, 채팅을 떠났다면 강제 이동하지 않는다", async ({ page }) => {
    test.setTimeout(60_000)
    await signUp(page, "coach-navigation")
    const firstCreated = page.waitForResponse((response) => response.url().endsWith("/api/conversations") && response.request().method() === "POST")
    await sendChatMessage(page, "첫 번째 학습 대화")
    await expect(page.getByRole("button", { name: "첫 번째 학습 대화", exact: true })).toBeVisible()
    const first = await (await firstCreated).json()
    const secondCreated = page.waitForResponse((response) => response.url().endsWith("/api/conversations") && response.request().method() === "POST")
    await page.getByRole("button", { name: "새 대화", exact: true }).click()
    const second = await (await secondCreated).json()
    await sendChatMessage(page, "두 번째 학습 대화")

    async function holdNextDraft() {
        let release!: () => void
        const gate = new Promise<void>((resolve) => {
            release = resolve
        })
        await page.route(
            "**/api/diary/draft",
            async (route) => {
                const response = await route.fetch()
                await gate
                await route.fulfill({ response })
            },
            { times: 1 }
        )
        await clickDraft(page)
        await expect(page.getByRole("button", { name: "일기 초안 만드는 중…" })).toBeDisabled()
        return release
    }

    const releaseSecond = await holdNextDraft()
    await page.getByRole("button", { name: "첫 번째 학습 대화", exact: true }).click()
    await expect(page.locator('[data-role="user"]')).toHaveText("첫 번째 학습 대화")
    releaseSecond()
    await expect(page).toHaveURL(/\/diary$/)
    await expect(page.getByLabel("일기로 만들 채팅")).toHaveValue(second.id)
    await page.getByRole("button", { name: "초안 버리기" }).click()
    await chatLink(page).click()

    const releaseFirst = await holdNextDraft()
    await openSettings(page)
    const completed = page.waitForResponse((response) => response.url().endsWith("/api/diary/draft"))
    releaseFirst()
    await (await completed).finished()
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
    await expect(page).toHaveURL(/\/settings$/)
    await diaryLink(page).click()
    await expect(page.getByLabel("배운 내용 상세")).not.toHaveValue("")
    await expect(page.getByLabel("일기로 만들 채팅")).toHaveValue(first.id)
})

test("다른 대화의 늦은 응답 실패가 현재 대화의 일기 만들기를 막지 않는다", async ({ page }) => {
    await signUp(page, "coach-stream-error")
    await sendChatMessage(page, "첫 번째 대화의 배움")
    await expect(page.getByRole("button", { name: "첫 번째 대화의 배움", exact: true })).toBeVisible()
    const created = page.waitForResponse((response) => response.url().endsWith("/api/conversations") && response.request().method() === "POST")
    await page.getByRole("button", { name: "새 대화", exact: true }).click()
    await created
    await expect(page.locator('[data-role="user"]')).toHaveCount(0)
    await sendChatMessage(page, "두 번째 대화의 배움")
    await page.getByRole("button", { name: "첫 번째 대화의 배움", exact: true }).click()
    await expect(page.locator('[data-role="user"]')).toHaveText(["첫 번째 대화의 배움"])
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
        release = resolve
    })
    await page.route("**/api/conversations/*/stream", async (route) => {
        await gate
        await route.fulfill({ status: 503, json: { error: { code: "unavailable", message: "첫 대화 응답 실패" } } })
    })
    await page.getByLabel("메시지").fill("아직 응답 중인 질문")
    await page.getByRole("button", { name: "보내기", exact: true }).click()
    await expectDraft(page, false)
    await page.getByRole("button", { name: "두 번째 대화의 배움", exact: true }).click()
    await expect(page.locator('[data-role="user"]')).toHaveText(["두 번째 대화의 배움"])
    release()
    await expectDraft(page, true)
    await expect(page.locator('p[role="alert"]')).toHaveCount(0)
    await clickDraft(page)
    await expect(page).toHaveURL(/\/diary$/)
    await expect(page.getByLabel("오늘 배운 것")).not.toHaveValue("")
})

test("모바일에서도 구름 코치·입력·일기 만들기가 화면 안에 보인다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await signUp(page, "coach-mobile")
    await expect(page.getByRole("heading", { name: /구름 코치와 풀어볼까요/ })).toBeVisible()
    await expect(page.getByLabel("메시지")).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    // 폰 화면의 사용법 동영상은 폰 화면판 시연 영상이다.
    await expectGuideVideo(page, DEMO_VIDEO.phone)
    await mkdir("coach-ui-previews", { recursive: true })
    await page.screenshot({ path: "coach-ui-previews/mobile-welcome.png", animations: "disabled" })
    await sendChatMessage(page, "오늘 학습한 내용을 정리하고 싶어요")
    await expect(composerMenu(page)).toBeInViewport()
    await clickDraft(page)
    await expect(page).toHaveURL(/\/diary$/)
    await expect(page.getByLabel("오늘 배운 것")).not.toHaveValue("")
    await page.screenshot({ path: "coach-ui-previews/mobile-diary.png", animations: "disabled" })
})

test("채팅 상단(코치 소개·사용법 동영상·안내)은 빈 대화에서만 보이고, 첫 메시지를 보내거나 목록에서 대화를 고르면 통째로 감춰진다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await signUp(page, "coach-guide")
    const intro = page.getByText("질문은 편하게, 배움은 차곡차곡", { exact: true })
    const guide = page.getByRole("link", { name: "사용법 동영상 열기" })
    const hint = page.getByText(/일기 초안은 입력칸 왼쪽 \+ 메뉴에서/)
    await expect(intro).toBeVisible()
    await expect(guide).toBeVisible()
    await expect(hint).toBeVisible()

    // 첫 메시지를 보내면 통째로 감춰 대화 칸을 넓힌다. 사용법 동영상은 + 메뉴에서 계속 열 수 있다.
    await sendChatMessage(page, "첫 질문을 보내면 버튼이 감춰져요")
    await expect(intro).toHaveCount(0)
    await expect(guide).toHaveCount(0)
    await expect(hint).toHaveCount(0)
    await composerMenu(page).click()
    await expect(page.getByRole("menuitem", { name: "사용법 동영상 열기" })).toHaveAttribute("href", DEMO_VIDEO.phone)
    await page.keyboard.press("Escape")
    await expect(page.getByRole("menu")).toHaveCount(0)

    // 새 대화(빈 대화)에서는 다시 보이고, 목록에서 기존 대화를 고르면 감춰진다.
    const toggle = page.getByRole("button", { name: "대화 목록 열고 닫기" })
    const drawer = page.getByRole("dialog", { name: "대화 목록" })
    await toggle.click()
    await drawer.getByRole("button", { name: "새 대화", exact: true }).click()
    await expect(drawer).toBeHidden()
    await expect(intro).toBeVisible()
    await expect(guide).toBeVisible()
    await toggle.click()
    await drawer.getByRole("button", { name: "첫 질문을 보내면 버튼이 감춰져요", exact: true }).click()
    await expect(drawer).toBeHidden()
    await expect(page.locator('[data-role="user"]')).toContainText("첫 질문을 보내면 버튼이 감춰져요")
    await expect(intro).toHaveCount(0)
    await expect(guide).toHaveCount(0)
})
