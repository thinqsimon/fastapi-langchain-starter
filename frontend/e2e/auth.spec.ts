import { expect, test } from "@playwright/test"

/** 테스트마다 새 계정을 써서 서로 간섭하지 않게 한다. */
function newAccount() {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    return {
        email: `e2e-${unique}@example.com`,
        password: "e2e-secret-password",
        displayName: "E2E 사용자",
    }
}

async function signUp(page: import("@playwright/test").Page, account: ReturnType<typeof newAccount>) {
    await page.goto("/sign-up")
    await page.getByLabel("이름").fill(account.displayName)
    await page.getByLabel("이메일").fill(account.email)
    await page.getByLabel("비밀번호").fill(account.password)
    await page.getByRole("button", { name: "가입하기" }).click()
}

test("회원가입하면 바로 로그인되어 보호 화면으로 이동한다", async ({ page }) => {
    const account = newAccount()

    await signUp(page, account)

    await expect(page).toHaveURL(/\/chat$/)
    await expect(page.getByText(account.displayName).first()).toBeVisible()
})

test("로그아웃하면 토큰이 지워지고 로그인 화면으로 돌아간다", async ({ page }) => {
    const account = newAccount()
    await signUp(page, account)
    await expect(page).toHaveURL(/\/chat$/)

    await page.getByRole("button", { name: "로그아웃" }).click()

    await expect(page).toHaveURL(/\/sign-in$/)
    const accessToken = await page.evaluate(() => localStorage.getItem("access_token"))
    expect(accessToken).toBeNull()
})

test("로그인하지 않으면 보호 화면에 접근할 수 없다", async ({ page }) => {
    await page.goto("/chat")

    await expect(page).toHaveURL(/\/sign-in$/)
})

test("잘못된 비밀번호는 오류 메시지를 보여준다", async ({ page }) => {
    const account = newAccount()
    await signUp(page, account)
    await page.getByRole("button", { name: "로그아웃" }).click()
    await expect(page).toHaveURL(/\/sign-in$/)

    await page.getByLabel("이메일").fill(account.email)
    await page.getByLabel("비밀번호").fill("wrong-password")
    await page.getByRole("button", { name: "로그인" }).click()

    // Next.js가 자체 route announcer(role="alert")를 두므로 폼 안으로 범위를 좁힌다.
    await expect(page.locator("form").getByRole("alert")).toContainText("이메일 또는 비밀번호")
    await expect(page).toHaveURL(/\/sign-in$/)
})

test("액세스 토큰이 만료돼도 리프레시로 자동 복구된다", async ({ page }) => {
    const account = newAccount()
    await signUp(page, account)
    await expect(page).toHaveURL(/\/chat$/)

    // 액세스 토큰만 못 쓰게 만들고(리프레시 토큰은 그대로) 새로고침한다.
    await page.evaluate(() => localStorage.setItem("access_token", "expired.invalid.token"))
    await page.reload()

    // 인터셉터가 재발급받아 화면이 유지돼야 한다.
    await expect(page).toHaveURL(/\/chat$/)
    await expect(page.getByText(account.displayName).first()).toBeVisible()
    const refreshed = await page.evaluate(() => localStorage.getItem("access_token"))
    expect(refreshed).not.toBe("expired.invalid.token")
})
