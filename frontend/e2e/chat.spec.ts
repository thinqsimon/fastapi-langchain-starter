import { expect, test, type Page } from "@playwright/test"

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

    await page.getByRole("button", { name: "지울 대화 삭제" }).click()

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
