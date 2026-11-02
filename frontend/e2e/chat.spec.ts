import { expect, test, type Page } from "@playwright/test"

import { sendChatMessage } from "./helpers"

/** 스트리밍이 끝나 서버에 저장된 응답 말풍선 */
function savedAssistant(page: Page) {
    return page.locator('[data-role="assistant"]:not([data-pending])')
}

/** 테스트마다 새 계정을 써서 서로 간섭하지 않게 한다. */
function newAccount() {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    return {
        email: `e2e-chat-${unique}@example.com`,
        password: "e2e-secret-password",
        displayName: "E2E 대화자",
    }
}

/** 맨 위 '새 대화' 버튼. 목록에 생기는 '새 대화' 제목 버튼보다 앞에 있다. */
function newChatButton(page: Page) {
    return page.locator("#conversation-sidebar").getByRole("button", { name: "새 대화", exact: true }).first()
}

async function signUpAndOpenChat(page: Page) {
    const account = newAccount()
    await page.goto("/sign-up")
    await page.getByLabel("이름").fill(account.displayName)
    await page.getByLabel("이메일").fill(account.email)
    await page.getByLabel("비밀번호").fill(account.password)
    await page.getByRole("button", { name: "가입하기" }).click()
    await expect(page).toHaveURL(/\/chat$/)
    return account
}

test("메시지를 보내면 답변이 화면에 나타난다", async ({ page }) => {
    await signUpAndOpenChat(page)

    await page.getByLabel("메시지").fill("안녕하세요")
    await page.getByRole("button", { name: "보내기" }).click()

    // 보낸 메시지가 즉시 보이고, 이어서 응답이 채워진다.
    await expect(page.locator('[data-role="user"]')).toContainText("안녕하세요")
    await expect(savedAssistant(page).first()).not.toBeEmpty()
})

test("답변은 스트림 조각이 도착하는 대로 이어 붙어 보이고, 저장된 목록을 다시 받기 전에 이미 다 보인다", async ({ page }) => {
    // 서버가 보낸 SSE 본문(줄 끝 \r\n)을 1바이트씩 흘려 실제 네트워크처럼 잘게 조각나 도착하게 한다.
    // 첫 이벤트까지만 흘리고, 나머지는 window.__releaseStream()을 부를 때까지 붙잡아 둔다.
    await page.addInitScript(() => {
        const realFetch = window.fetch.bind(window)
        let release!: () => void
        const held = new Promise<void>((resolve) => {
            release = resolve
        })
        Object.assign(window, { __releaseStream: () => release() })
        window.fetch = async (input, init) => {
            const response = await realFetch(input, init)
            if (!String(input).endsWith("/stream") || !response.ok) return response
            const text = await response.text()
            const firstEvent = /\r?\n\r?\n/.exec(text)
            const cut = firstEvent ? firstEvent.index + firstEvent[0].length : text.length
            const encoder = new TextEncoder()
            const parts = [encoder.encode(text.slice(0, cut)), encoder.encode(text.slice(cut))]
            const body = new ReadableStream<Uint8Array>({
                async start(controller) {
                    for (const [index, part] of parts.entries()) {
                        if (index === 1) await held
                        for (const byte of part) {
                            controller.enqueue(Uint8Array.of(byte))
                            await new Promise((resolve) => setTimeout(resolve, 0))
                        }
                    }
                    controller.close()
                },
            })
            return new Response(body, { status: response.status, headers: response.headers })
        }
    })
    await signUpAndOpenChat(page)
    // 스트림이 끝난 뒤 저장된 목록을 다시 받는 요청도 붙잡는다. 그동안 보이는 글자는 스트림에서 온 것뿐이다.
    let releaseSaved!: () => void
    const saved = new Promise<void>((resolve) => {
        releaseSaved = resolve
    })
    await page.route("**/api/conversations/*/messages", async (route) => {
        await saved
        await route.continue()
    })

    await page.getByLabel("메시지").fill("조각조각 보여 줘")
    await page.getByRole("button", { name: "보내기" }).click()

    const streaming = page.locator('[data-role="assistant"][data-pending]')
    await expect(streaming).toContainText("안녕하세요!")
    await expect(streaming).not.toContainText("응답입니다")
    await page.evaluate(() => (window as unknown as { __releaseStream: () => void }).__releaseStream())
    await expect(streaming).toContainText("안녕하세요! 테스트 응답입니다.")

    releaseSaved()
    await expect(streaming).toHaveCount(0)
    await expect(savedAssistant(page)).toContainText("안녕하세요! 테스트 응답입니다.")
})

test("새로고침해도 대화 이력이 남는다", async ({ page }) => {
    await signUpAndOpenChat(page)
    await page.getByLabel("메시지").fill("기억할 질문")
    await page.getByRole("button", { name: "보내기" }).click()
    // 저장이 끝나 pending 표시가 사라질 때까지 기다린 뒤 새로고침한다.
    await expect(savedAssistant(page).first()).not.toBeEmpty()

    await page.reload()
    // 사이드바의 대화를 다시 연다(첫 메시지가 제목이 된다).
    await page.getByRole("button", { name: "기억할 질문", exact: true }).click()

    await expect(page.locator('[data-role="user"]')).toContainText("기억할 질문")
    await expect(savedAssistant(page).first()).not.toBeEmpty()
})

test("대화를 삭제하면 목록에서 사라진다", async ({ page }) => {
    await signUpAndOpenChat(page)
    await page.getByLabel("메시지").fill("지울 대화")
    await page.getByRole("button", { name: "보내기" }).click()
    await expect(page.getByRole("button", { name: "지울 대화", exact: true })).toBeVisible()

    await page.getByRole("button", { name: "지울 대화 메뉴" }).click()
    await page.getByRole("menuitem", { name: "삭제" }).click()

    await expect(page.getByRole("button", { name: "지울 대화", exact: true })).toHaveCount(0)
})

test("대화가 길어져도 헤더와 입력칸은 화면에 남고 메시지 영역만 스크롤된다", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 })
    await signUpAndOpenChat(page)
    for (const text of ["첫 질문", "두 번째 질문", "세 번째 질문", "네 번째 질문", "다섯 번째 질문"]) {
        await page.getByLabel("메시지").fill(text)
        await page.getByRole("button", { name: "보내기" }).click()
        await expect(savedAssistant(page).last()).not.toBeEmpty()
        await expect(page.locator('[data-role="user"]').last()).toContainText(text)
    }

    // 페이지 전체는 스크롤되지 않는다(헤더가 밀려 올라가지 않음).
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true)
    const header = (await page.locator("header").boundingBox())!
    expect(header.y).toBe(0)
    await expect(page.getByLabel("메시지")).toBeInViewport()
})

test("새 대화를 연달아 눌러도 빈 대화는 하나만 만들고, 다시 누르면 그 빈 대화를 쓴다", async ({ page }) => {
    await signUpAndOpenChat(page)
    await sendChatMessage(page, "첫 대화")
    const created: string[] = []
    page.on("request", (request) => {
        if (request.method() === "POST" && new URL(request.url()).pathname === "/api/conversations") created.push(request.url())
    })
    const list = page.getByRole("navigation", { name: "대화 목록" })
    const emptyChats = list.getByRole("button", { name: "새 대화", exact: true })
    const userMessages = page.locator('[data-role="user"]')

    for (let count = 0; count < 5; count++) await newChatButton(page).click()
    await expect(emptyChats).toHaveCount(1)
    await expect(userMessages).toHaveCount(0)

    // 지난 대화를 보다가 눌러도 새로 만들지 않고 그 빈 대화로 돌아간다.
    await list.getByRole("button", { name: "첫 대화", exact: true }).click()
    await expect(userMessages).toHaveText(["첫 대화"])
    await newChatButton(page).click()
    await expect(userMessages).toHaveCount(0)

    // 새로고침한 뒤에도 서버의 빈 대화는 하나이고, 첫 메시지는 그 대화로 간다.
    await page.reload()
    await expect(emptyChats).toHaveCount(1)
    await newChatButton(page).click()
    await sendChatMessage(page, "두 번째 대화")
    await expect(list.getByRole("listitem")).toHaveCount(2)
    await expect(emptyChats).toHaveCount(0)
    expect(created).toHaveLength(1)

    // 빈 대화를 쓰고 나면 다음 '새 대화'는 새로 만든다.
    await newChatButton(page).click()
    await expect(emptyChats).toHaveCount(1)
    expect(created).toHaveLength(2)
})

test("새 대화를 준비하는 동안 보낸 메시지는 새 대화로 간다", async ({ page }) => {
    await signUpAndOpenChat(page)
    await sendChatMessage(page, "첫 대화")
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
        release = resolve
    })
    await page.route("**/api/conversations", async (route) => {
        if (route.request().method() === "POST") await gate
        await route.continue()
    })

    await newChatButton(page).click()
    await page.getByLabel("메시지").fill("두 번째 대화")
    await page.getByRole("button", { name: "보내기" }).click()
    release()

    const list = page.getByRole("navigation", { name: "대화 목록" })
    await expect(list.getByRole("button", { name: "두 번째 대화", exact: true })).toBeVisible()
    await expect(page.locator('[data-role="user"]')).toHaveText(["두 번째 대화"])
    await list.getByRole("button", { name: "첫 대화", exact: true }).click()
    await expect(page.locator('[data-role="user"]')).toHaveText(["첫 대화"])
})

test("답변의 첫 글자를 기다리는 동안 점 세 개가 움직이고, 동작 줄이기 설정이면 깜빡이기만 한다", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 })
    await signUpAndOpenChat(page)
    // 대화를 화면보다 길게 만들어, 기다리는 동안 페이지 전체가 스크롤되지 않는지도 함께 본다.
    for (const text of ["첫 질문", "두 번째 질문", "세 번째 질문", "네 번째 질문"]) await sendChatMessage(page, text)
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
        release = resolve
    })
    await page.route("**/api/conversations/*/stream", async (route) => {
        const response = await route.fetch()
        await gate
        await route.fulfill({ response })
    })
    await page.getByLabel("메시지").fill("기다리는 동안")
    await page.getByRole("button", { name: "보내기" }).click()

    const indicator = page.locator('[data-role="assistant"][data-pending] [data-slot="typing-indicator"]')
    await expect(indicator).toContainText("답변을 준비하고 있어요")
    const dots = indicator.locator('[aria-hidden="true"]')
    await expect(dots).toHaveCount(3)
    await expect(dots.first()).toHaveCSS("animation-name", "typing-dot")
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true)
    await page.emulateMedia({ reducedMotion: "reduce" })
    await expect(dots.first()).toHaveCSS("animation-name", "pulse")

    release()
    await expect(savedAssistant(page)).toHaveCount(5)
    await expect(indicator).toHaveCount(0)
})

test("대화 목록의 '…' 메뉴로 제목을 바꾼다. Esc는 취소, 빈 제목은 그대로 두고, 빈 대화에 먼저 붙인 이름은 첫 메시지 뒤에도 남는다", async ({ page }) => {
    await signUpAndOpenChat(page)
    await sendChatMessage(page, "원래 제목")
    const list = page.getByRole("navigation", { name: "대화 목록" })
    const input = list.getByRole("textbox", { name: "대화 제목" })
    async function startRenaming(title: string) {
        await list.getByRole("button", { name: `${title} 메뉴` }).click()
        await page.getByRole("menuitem", { name: "이름 바꾸기" }).click()
        await expect(input).toBeFocused()
        await expect(input).toHaveValue(title)
    }

    await startRenaming("원래 제목")
    await input.fill("React 상태 관리")
    await input.press("Enter")
    await expect(input).toHaveCount(0)
    await expect(list.getByRole("button", { name: "React 상태 관리", exact: true })).toBeFocused()

    // Esc는 바꾸지 않고 닫는다.
    await startRenaming("React 상태 관리")
    await input.fill("취소할 제목")
    await input.press("Escape")
    await expect(input).toHaveCount(0)
    await expect(list.getByRole("button", { name: "React 상태 관리", exact: true })).toBeVisible()

    // 비운 채 다른 곳을 누르면 저장하지 않는다.
    await startRenaming("React 상태 관리")
    await input.fill("   ")
    await page.getByLabel("메시지").click()
    await expect(input).toHaveCount(0)
    await expect(list.getByRole("button", { name: "React 상태 관리", exact: true })).toBeVisible()

    // 빈 '새 대화'에 먼저 이름을 붙이면 첫 메시지를 보내도 그 이름이 남는다.
    await newChatButton(page).click()
    await startRenaming("새 대화")
    await input.fill("미리 붙인 제목")
    await input.press("Enter")
    await sendChatMessage(page, "첫 질문")

    await page.reload()
    await expect(list.getByRole("button", { name: "React 상태 관리", exact: true })).toBeVisible()
    await expect(list.getByRole("button", { name: "미리 붙인 제목", exact: true })).toBeVisible()
    await expect(list.getByRole("button", { name: "첫 질문", exact: true })).toHaveCount(0)
})

test("넓은 화면에서는 대화 목록과 대화 사이를 끌어 목록 너비를 바꾸고, 새로고침·키보드·두 번 누르기에도 맞게 동작한다", async ({ page }) => {
    await signUpAndOpenChat(page)
    const sidebar = page.locator("#conversation-sidebar")
    const handle = page.locator('[data-slot="chat-list-resizer"]')
    const width = async () => (await sidebar.boundingBox())!.width
    const initial = await width()
    expect(initial).toBe(256)

    const box = (await handle.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + 200)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 120, box.y + 200, { steps: 8 })
    await page.mouse.up()
    const widened = await width()
    expect(widened).toBeGreaterThan(initial + 100)
    await expect(handle).toHaveAttribute("aria-valuenow", String(Math.round(widened)))

    await page.reload()
    await expect(page.getByLabel("메시지")).toBeVisible()
    await expect.poll(width).toBeCloseTo(widened, 0)

    await handle.focus()
    await page.keyboard.press("ArrowLeft")
    await expect.poll(width).toBeCloseTo(widened - 16, 0)

    await handle.dblclick()
    await expect.poll(width).toBeCloseTo(initial, 0)

    // 목록을 접으면 손잡이도 사라진다.
    await page.getByRole("button", { name: "대화 목록 열고 닫기" }).click()
    await expect(sidebar).toHaveCount(0)
    await expect(handle).toHaveCount(0)
})

test("답변의 괄호 뒤에 조사가 바로 붙은 굵은 글씨도 별표 없이 굵게 보인다", async ({ page }) => {
    await signUpAndOpenChat(page)
    // fake 모델은 정해진 글만 답하므로, 저장된 답변을 실제 모델이 자주 쓰는 모양으로 바꿔 받는다.
    await page.route("**/api/conversations/*/messages", async (route) => {
        const response = await route.fetch()
        const messages: { role: string }[] = await response.json()
        const json = messages.map((message) =>
            message.role === "assistant" ? { ...message, content: "이것을 **자율 판단(Autonomous Decision)**이라고 부릅니다." } : message
        )
        await route.fulfill({ response, json })
    })

    await page.getByLabel("메시지").fill("굵은 글씨를 보여 줘")
    await page.getByRole("button", { name: "보내기" }).click()

    const answer = page.locator('[data-role="assistant"]:not([data-pending])').first()
    await expect(answer.locator("strong")).toHaveText("자율 판단(Autonomous Decision)")
    await expect(answer).not.toContainText("**")
})
