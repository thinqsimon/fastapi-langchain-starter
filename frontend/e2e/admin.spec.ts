import { expect, test, type Page } from "@playwright/test"

import { logOut, openAccountMenu, sendChatMessage, signIn, signUp } from "./helpers"

/** ADMIN-01 관리자 LLM 공급자 설정, ADMIN-02 사용자 계정으로 테스트 */

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8010"
// scripts/e2e.sh가 백엔드에 ADMIN_EMAILS로 넘기는 주소와 같아야 한다.
const ADMIN = { email: "e2e-admin@example.com", password: "e2e-secret-password", displayName: "E2E 관리자" }
const PROVIDERS = ["openai", "anthropic", "google_genai"] as const

/** 관리자 계정은 주소가 고정이라 이미 있을 수 있다. 가입을 시도하고(있으면 409) 로그인한다. */
async function signInAsAdmin(page: Page) {
    await page.request.post(`${API}/api/auth/signup`, {
        data: { email: ADMIN.email, password: ADMIN.password, display_name: ADMIN.displayName },
    })
    await signIn(page, ADMIN.email, ADMIN.password)
    await expect(page).toHaveURL(/\/chat$/)
}

/** 공급자 설정은 서버 전체의 것이라 다른 테스트에 남지 않게 되돌린다. */
async function resetProviders(page: Page) {
    const token = await page.evaluate(() => localStorage.getItem("access_token"))
    if (!token) return
    for (const provider of PROVIDERS) {
        await page.request.patch(`${API}/api/admin/llm-providers/${provider}`, {
            headers: { Authorization: `Bearer ${token}` },
            data: { api_key: "", enabled: false, forced: false, priority: PROVIDERS.indexOf(provider) + 1 },
        })
    }
}

test("일반 사용자에게는 '관리자' 메뉴가 없고 주소로 들어가도 막힌다", async ({ page }) => {
    await signUp(page, "e2e-member")

    const menu = await openAccountMenu(page)
    await expect(menu.getByRole("button", { name: "설정" })).toBeVisible()
    await expect(menu.getByRole("button", { name: "관리자" })).toHaveCount(0)
    await page.keyboard.press("Escape")

    await page.goto("/admin")
    await expect(page.locator('p[role="alert"]')).toHaveText("관리자만 볼 수 있는 화면입니다.")
    await expect(page.getByRole("form", { name: "사용자 검색" })).toHaveCount(0)
})

test.describe("관리자", () => {
    test.afterEach(async ({ page }) => {
        await resetProviders(page)
    })

    test("설정 버튼 위의 '관리자'로 들어가 Gemini 키를 넣고 우선순위·강제 사용을 바꿔도 채팅이 된다", async ({ page }) => {
        await signInAsAdmin(page)

        const menu = await openAccountMenu(page)
        const adminButton = menu.getByRole("button", { name: "관리자" })
        const settingsButton = menu.getByRole("button", { name: "설정", exact: true })
        await expect(adminButton).toBeVisible()
        // '관리자'는 '설정' 바로 위에 있다.
        const adminBox = (await adminButton.boundingBox())!
        const settingsBox = (await settingsButton.boundingBox())!
        expect(adminBox.y).toBeLessThan(settingsBox.y)
        await adminButton.click()
        await expect(page).toHaveURL(/\/admin$/)

        const plan = page.locator('[data-slot="llm-plan"]')
        await expect(plan).toContainText(".env 설정")
        for (const name of ["OpenAI 설정", "Claude 설정", "Gemini 설정"]) {
            await expect(page.getByRole("form", { name })).toBeVisible()
        }

        // 키·모델·우선순위를 저장한다. 키는 화면에 다시 보이지 않는다.
        const gemini = page.getByRole("form", { name: "Gemini 설정" })
        await gemini.getByLabel("모델").fill("gemini-e2e")
        await gemini.getByLabel("API 키").fill("e2e-gemini-key")
        await gemini.getByLabel("우선순위").selectOption("1")
        await gemini.getByRole("button", { name: "저장", exact: true }).click()
        await expect(gemini.locator('p[role="status"]')).toHaveText("저장했습니다.")
        await expect(gemini.getByLabel("API 키")).toHaveValue("")
        await expect(gemini.getByLabel("API 키")).toHaveAttribute("placeholder", /저장된 키가 있습니다/)
        expect(await page.content()).not.toContain("e2e-gemini-key")
        // 키만 있고 꺼져 있으면 아직 쓰이지 않는다.
        await expect(plan).toContainText(".env 설정")

        await gemini.getByRole("button", { name: "사용 켜기" }).click()
        await expect(gemini.locator('p[role="status"]')).toHaveText("이 공급자를 켰습니다.")
        await expect(plan).toContainText("우선순위 1. Gemini (gemini-e2e)")

        // OpenAI도 켜서 두 번째 순위로 둔다(키 필요).
        const openai = page.getByRole("form", { name: "OpenAI 설정" })
        await openai.getByLabel("API 키").fill("e2e-openai-key")
        await openai.getByLabel("우선순위").selectOption("2")
        await openai.getByRole("button", { name: "저장", exact: true }).click()
        await expect(openai.locator('p[role="status"]')).toHaveText("저장했습니다.")
        await openai.getByRole("button", { name: "사용 켜기" }).click()
        await expect(plan).toContainText("1. Gemini (gemini-e2e) → 2. OpenAI")

        // 강제 사용은 하나만. OpenAI를 강제하면 순위를 무시하고 OpenAI만 쓴다.
        await openai.getByRole("button", { name: "강제 사용" }).click()
        await expect(plan).toContainText("강제 사용: OpenAI")
        await gemini.getByRole("button", { name: "강제 사용" }).click()
        await expect(plan).toContainText("강제 사용: Gemini")
        await expect(openai.getByRole("button", { name: "강제 사용" })).toBeVisible()
        await expect(gemini.getByRole("button", { name: "강제 해제" })).toBeVisible()

        // 새로고침해도 서버에 저장된 값이 보인다.
        await page.reload()
        await expect(page.locator('[data-slot="llm-plan"]')).toContainText("강제 사용: Gemini (gemini-e2e)")

        // 키를 지우면 그 공급자는 빠진다.
        await page.getByRole("form", { name: "Gemini 설정" }).getByRole("button", { name: "키 지우기" }).click()
        await expect(page.locator('[data-slot="llm-plan"]')).toContainText("1. OpenAI")

        // 설정을 바꿔도 채팅은 계속 된다(E2E는 fake 공급자라 실제 호출은 없다).
        await page.getByRole("link", { name: "채팅", exact: true }).click()
        await sendChatMessage(page, "서버 설정을 바꾼 뒤 보내는 메시지")
    })

    test("사용자를 검색해 그 계정으로 테스트하면 그 사용자의 대화가 보이고, 메시지는 보낼 수 있지만 삭제는 막히며, 내 계정으로 돌아온다", async ({ page }) => {
        // 신고한 사용자: 대화를 하나 남겨 둔다.
        const member = await signUp(page, "e2e-target")
        await sendChatMessage(page, "대상 사용자의 질문입니다")
        await logOut(page)

        await signInAsAdmin(page)
        await page.goto("/admin")
        const lookup = page.getByRole("form", { name: "사용자 검색" })
        await lookup.getByLabel("이메일 또는 이름").fill(member.email)
        await lookup.getByRole("button", { name: "검색" }).click()
        const results = page.getByRole("list", { name: "검색 결과" })
        await expect(results).toContainText(member.email)
        await results.getByRole("button", { name: `${member.email} 계정으로 테스트` }).click()

        // 그 계정의 채팅 화면으로 가고, 띠가 누구 계정인지 알려 준다.
        await expect(page).toHaveURL(/\/chat$/)
        const banner = page.locator('[data-slot="acting-banner"]')
        await expect(banner).toContainText(member.email)
        await expect(page.getByRole("navigation", { name: "대화 목록" })).toContainText("대상 사용자의 질문입니다")
        const menu = await openAccountMenu(page)
        await expect(menu.getByText(member.email)).toBeVisible()
        await page.keyboard.press("Escape")

        // 재현을 위해 쓰기는 된다(그 사용자 계정에 남는다).
        await page.getByRole("navigation", { name: "대화 목록" }).getByText("대상 사용자의 질문입니다").click()
        await sendChatMessage(page, "관리자가 재현하며 보낸 메시지")

        // 삭제는 서버가 막는다.
        const actingToken = await page.evaluate(() => localStorage.getItem("acting_access_token"))
        expect(actingToken).toBeTruthy()
        const conversations = await (await page.request.get(`${API}/api/conversations`, { headers: { Authorization: `Bearer ${actingToken}` } })).json()
        const blocked = await page.request.delete(`${API}/api/conversations/${conversations[0].id}`, {
            headers: { Authorization: `Bearer ${actingToken}` },
        })
        expect(blocked.status()).toBe(403)

        // 돌아오면 띠가 사라지고 관리자 계정이다. 관리자 토큰은 그대로 살아 있다.
        await banner.getByRole("button", { name: "내 계정으로 돌아가기" }).click()
        await expect(banner).toHaveCount(0)
        await expect(page).toHaveURL(/\/admin$/)
        const adminMenu = await openAccountMenu(page)
        await expect(adminMenu.getByText(ADMIN.email)).toBeVisible()
        await page.keyboard.press("Escape")

        // 사용자 계정에는 재현 메시지가 남아 있다(사용자가 로그인해 확인).
        await logOut(page)
        await signIn(page, member.email, member.password)
        await expect(page).toHaveURL(/\/chat$/)
        await page.getByRole("navigation", { name: "대화 목록" }).getByText("대상 사용자의 질문입니다").click()
        await expect(page.getByText("관리자가 재현하며 보낸 메시지")).toBeVisible()
    })

    test("관리자 화면은 좁은 화면에서도 가로로 넘치지 않는다", async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 })
        await signInAsAdmin(page)
        await page.goto("/admin")
        await expect(page.getByRole("form", { name: "OpenAI 설정" })).toBeVisible()
        await expect(page.getByRole("form", { name: "사용자 검색" })).toBeVisible()

        expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
    })
})
