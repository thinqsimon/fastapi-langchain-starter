import { expect, test, type Page } from "@playwright/test"

/** 샘플앱(배움일기 코치) 전체 흐름: 코칭 대화 → 일기 초안 → 저장 → 주간 회고 */

function newAccount() {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    return {
        email: `e2e-diary-${unique}@example.com`,
        password: "e2e-secret-password",
        displayName: "E2E 교육생",
    }
}

async function signUp(page: Page) {
    const account = newAccount()
    await page.goto("/sign-up")
    await page.getByLabel("이름").fill(account.displayName)
    await page.getByLabel("이메일").fill(account.email)
    await page.getByLabel("비밀번호").fill(account.password)
    await page.getByRole("button", { name: "가입하기" }).click()
    await expect(page).toHaveURL(/\/chat$/)
    return account
}

test("일기를 직접 쓰고 목록에서 확인한다", async ({ page }) => {
    await signUp(page)
    await page.getByRole("link", { name: "일기" }).click()

    await page.getByLabel("오늘 배운 것").fill("의존성 주입")
    await page.getByLabel("어려웠던 것").fill("세션 범위")
    await page.getByLabel("내일 할 것").fill("테스트 작성")
    await page.getByRole("button", { name: "저장" }).click()

    await expect(page.getByText("의존성 주입")).toBeVisible()
    await expect(page.getByText("아직 쓴 일기가 없습니다.")).toHaveCount(0)
})

test("코칭 대화에서 일기 초안을 만든다", async ({ page }) => {
    await signUp(page)

    // 먼저 코치와 대화한다.
    await page.getByLabel("메시지").fill("오늘 의존성 주입을 배웠어요")
    await page.getByRole("button", { name: "보내기" }).click()
    await expect(page.locator('[data-role="assistant"]:not([data-pending])').first()).not.toBeEmpty()

    await page.getByRole("link", { name: "일기" }).click()
    await page.getByRole("button", { name: "대화에서 초안 만들기" }).click()

    // 초안이 세 칸을 모두 채운다.
    await expect(page.getByLabel("오늘 배운 것")).not.toBeEmpty()
    await expect(page.getByLabel("어려웠던 것")).not.toBeEmpty()
    await expect(page.getByLabel("내일 할 것")).not.toBeEmpty()
})

test("같은 날 두 번 저장하면 안내를 보여준다", async ({ page }) => {
    await signUp(page)
    await page.getByRole("link", { name: "일기" }).click()

    for (const [label, value] of [
        ["오늘 배운 것", "첫 기록"],
        ["어려웠던 것", "어려움"],
        ["내일 할 것", "계획"],
    ]) {
        await page.getByLabel(label).fill(value)
    }
    await page.getByRole("button", { name: "저장" }).click()
    await expect(page.getByText("첫 기록")).toBeVisible()
    // 저장이 끝나 입력칸이 비워진 뒤에 다시 쓴다.
    await expect(page.getByLabel("오늘 배운 것")).toHaveValue("")

    // 같은 날 또 쓰면 하루 한 편 규칙에 걸린다.
    await page.getByLabel("오늘 배운 것").fill("두 번째 기록")
    await page.getByLabel("어려웠던 것").fill("어려움")
    await page.getByLabel("내일 할 것").fill("계획")
    await page.getByRole("button", { name: "저장" }).click()

    // Next.js의 route announcer도 role="alert"라 화면 안의 메시지로 범위를 좁힌다.
    await expect(page.locator('p[role="alert"]')).toContainText("이미 있습니다")
})

test("주간 회고를 만든다", async ({ page }) => {
    await signUp(page)
    await page.getByRole("link", { name: "일기" }).click()
    await page.getByLabel("오늘 배운 것").fill("회고용 기록")
    await page.getByLabel("어려웠던 것").fill("어려움")
    await page.getByLabel("내일 할 것").fill("계획")
    await page.getByRole("button", { name: "저장" }).click()
    await expect(page.getByText("회고용 기록")).toBeVisible()

    await page.getByRole("button", { name: "회고 만들기" }).click()

    await expect(page.getByText("성장한 점")).toBeVisible()
    await expect(page.getByText("다음 주 제안")).toBeVisible()
})
