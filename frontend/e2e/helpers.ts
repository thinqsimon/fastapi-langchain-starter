import { expect, type Page } from "@playwright/test"

/** 테스트마다 새 계정을 써서 서로 간섭하지 않게 한다. */
export function newAccount(prefix = "e2e") {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    return {
        email: `${prefix}-${unique}@example.com`,
        password: "e2e-secret-password",
        displayName: "E2E 교육생",
    }
}

export type Account = ReturnType<typeof newAccount>

export async function signUp(page: Page, prefix?: string): Promise<Account> {
    const account = newAccount(prefix)
    await page.goto("/sign-up")
    await page.getByLabel("이름").fill(account.displayName)
    await page.getByLabel("이메일").fill(account.email)
    await page.getByLabel("비밀번호").fill(account.password)
    await page.getByRole("button", { name: "가입하기" }).click()
    await expect(page).toHaveURL(/\/chat$/)
    return account
}

/** 클립보드의 마크다운 글자(text/plain)와 서식(text/html). 테스트에서 clipboard-read 권한을 먼저 준다. */
export function readClipboard(page: Page) {
    return page.evaluate(async () => {
        const [item] = await navigator.clipboard.read()
        return {
            text: await (await item.getType("text/plain")).text(),
            html: item.types.includes("text/html") ? await (await item.getType("text/html")).text() : "",
        }
    })
}

export async function signIn(page: Page, email: string, password: string) {
    await page.goto("/sign-in")
    await page.getByLabel("이메일").fill(email)
    await page.getByLabel("비밀번호").fill(password)
    await page.getByRole("button", { name: "로그인" }).click()
}

export async function openAccountMenu(page: Page) {
    await page.getByRole("button", { name: "계정 메뉴 열기" }).click()
    const menu = page.getByRole("dialog", { name: "계정" })
    await expect(menu).toBeVisible()
    return menu
}

export async function logOut(page: Page) {
    const menu = await openAccountMenu(page)
    await menu.getByRole("button", { name: "로그아웃" }).click()
    await expect(page).toHaveURL(/\/sign-in$/)
}

export async function openSettings(page: Page) {
    const menu = await openAccountMenu(page)
    await menu.getByRole("button", { name: "설정" }).click()
    await expect(page).toHaveURL(/\/settings$/)
}

/** 지금 열린 채팅에 메시지를 보내고, 답변이 저장될 때까지 기다린다. */
export async function sendChatMessage(page: Page, content: string) {
    const saved = page.locator('[data-role="assistant"]:not([data-pending])')
    const before = await saved.count()
    await page.getByLabel("메시지").fill(content)
    await page.getByRole("button", { name: "보내기" }).click()
    await expect(saved).toHaveCount(before + 1)
}

/** 브라우저와 같은 기기 기준 오늘(YYYY-MM-DD). 화면이 제목 날짜로 쓰는 값과 같다. */
export function localToday(now = new Date()): string {
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    return local.toISOString().slice(0, 10)
}

export const DEFAULT_CATCHPHRASE = "풀스택 화이팅 !!!  절실하게 공부합시다!!! 운영진 분들 강사님 감사합니다."
export const DEFAULT_FOOTER = "감사 합니다."

/** 사용법 시연 영상(lib/application.ts의 demoVideos). 넓은 화면(768px 이상)은 PC 화면판, 좁은 화면은 폰 화면판. */
export const DEMO_VIDEO = { desktop: "https://youtu.be/wCsDCMeg8WQ", phone: "https://youtu.be/FekXxD6Tv8E" }
