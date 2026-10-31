import { expect, test, type Page } from "@playwright/test"

import { logOut, openAccountMenu, sendChatMessage, signIn, signUp } from "./helpers"

/** ADMIN-01·03 관리자 LLM 설정(공급자 키·요금제별 라우팅), ADMIN-02 사용자 계정으로 테스트, 요금제 지정 */

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8010"
// scripts/e2e.sh가 백엔드에 ADMIN_EMAILS로 넘기는 주소와 같아야 한다.
const ADMIN = { email: "e2e-admin@example.com", password: "e2e-secret-password", displayName: "E2E 관리자" }
const PROVIDERS = ["openai", "anthropic", "google_genai"] as const

const planLine = (page: Page, plan: "free" | "pro" | "max") => page.locator(`[data-slot="llm-plan-${plan}"]`)
const keyForm = (page: Page, label: string) => page.getByRole("form", { name: `${label} 키` })
const routeForm = (page: Page, plan: string, n: number) => page.getByRole("form", { name: `${plan} ${n}번 라우트` })

/** 관리자 계정은 주소가 고정이라 이미 있을 수 있다. 가입을 시도하고(있으면 409) 로그인한다. */
async function signInAsAdmin(page: Page) {
    await page.request.post(`${API}/api/auth/signup`, {
        data: { email: ADMIN.email, password: ADMIN.password, display_name: ADMIN.displayName },
    })
    await signIn(page, ADMIN.email, ADMIN.password)
    await expect(page).toHaveURL(/\/chat$/)
}

/** 키·라우트는 서버 전체의 것이라 다른 테스트에 남지 않게 되돌린다. */
async function resetLlmSettings(page: Page) {
    const token = await page.evaluate(() => localStorage.getItem("access_token"))
    if (!token) return
    const headers = { Authorization: `Bearer ${token}` }
    const routes = await (await page.request.get(`${API}/api/admin/llm-routes`, { headers })).json()
    if (Array.isArray(routes)) {
        for (const route of routes) await page.request.delete(`${API}/api/admin/llm-routes/${route.id}`, { headers })
    }
    for (const provider of PROVIDERS) {
        await page.request.patch(`${API}/api/admin/llm-providers/${provider}`, { headers, data: { api_key: "" } })
    }
}

async function saveKey(page: Page, label: string, value: string) {
    const form = keyForm(page, label)
    await form.getByRole("textbox").fill(value)
    await form.getByRole("button", { name: "저장", exact: true }).click()
    await expect(form.locator('p[role="status"]')).toHaveText("키를 저장했습니다.")
    await expect(form.getByText("키 있음")).toBeVisible()
}

async function addRoute(page: Page, plan: string, provider: string, model: string) {
    const form = page.getByRole("form", { name: `${plan} 라우트 추가` })
    await form.getByLabel("공급자").selectOption(provider)
    await form.getByLabel("모델").fill(model)
    await form.getByRole("button", { name: "라우트 추가" }).click()
    await expect(form.locator('p[role="status"]')).toHaveText("라우트를 추가했습니다.")
}

test("일반 사용자에게는 '관리자' 메뉴가 없고 주소로 들어가도 막힌다", async ({ page }) => {
    await signUp(page, "e2e-member")

    const menu = await openAccountMenu(page)
    await expect(menu.getByRole("button", { name: "설정" })).toBeVisible()
    await expect(menu.getByRole("button", { name: "관리자" })).toHaveCount(0)
    await expect(menu.locator('[data-slot="account-plan"]')).toHaveText("Free")
    await page.keyboard.press("Escape")

    await page.goto("/admin")
    await expect(page.locator('p[role="alert"]')).toHaveText("관리자만 볼 수 있는 화면입니다.")
    await expect(page.getByRole("form", { name: "사용자 검색" })).toHaveCount(0)
})

test.describe("관리자", () => {
    test.afterEach(async ({ page }) => {
        await resetLlmSettings(page)
    })

    test("공급자 키를 넣고 요금제별 라우트를 만들면 '지금 동작'이 바뀌고, 채팅은 계속 된다", async ({ page }) => {
        await signInAsAdmin(page)
        // 마이그레이션이 기본 라우트(모델 사다리)를 넣어 두므로 빈 상태에서 시작한다.
        await resetLlmSettings(page)

        const menu = await openAccountMenu(page)
        const adminButton = menu.getByRole("button", { name: "관리자" })
        const settingsButton = menu.getByRole("button", { name: "설정", exact: true })
        await expect(adminButton).toBeVisible()
        // '관리자'는 '설정' 바로 위에 있다.
        expect((await adminButton.boundingBox())!.y).toBeLessThan((await settingsButton.boundingBox())!.y)
        await adminButton.click()
        await expect(page).toHaveURL(/\/admin$/)

        // 아무것도 없으면 세 요금제 모두 .env 설정을 쓴다.
        await expect(planLine(page, "free")).toContainText(".env 설정")
        await expect(planLine(page, "pro")).toContainText(".env 설정")
        for (const label of ["OpenAI", "Claude", "Gemini"]) await expect(keyForm(page, label)).toBeVisible()

        // 키는 저장 뒤 다시 보이지 않는다.
        await saveKey(page, "Gemini", "e2e-gemini-key")
        expect(await page.content()).not.toContain("e2e-gemini-key")

        // Free 라우트: Gemini를 넣으면 바로 1순위가 된다.
        await expect(page.locator('[data-slot="routes-empty"]')).toContainText("Free 요금제에 라우트가 없습니다")
        await addRoute(page, "Free", "google_genai", "gemini-e2e")
        await expect(routeForm(page, "Free", 1)).toContainText("1. Gemini")
        await expect(planLine(page, "free")).toContainText("우선순위 1. Gemini (gemini-e2e)")

        // 키 없는 공급자는 라우트를 넣어도 쓰이지 않는다.
        await addRoute(page, "Free", "openai", "gpt-4o-mini")
        await expect(routeForm(page, "Free", 2)).toContainText("키 없음")
        await expect(planLine(page, "free")).not.toContainText("OpenAI")
        await saveKey(page, "OpenAI", "e2e-openai-key")
        await expect(planLine(page, "free")).toContainText("1. Gemini (gemini-e2e) → 2. OpenAI (gpt-4o-mini)")

        // 강제 사용은 하나만, 해제하면 순서로 돌아간다. 위로 올리면 순서가 바뀐다.
        await routeForm(page, "Free", 2).getByRole("button", { name: "강제 사용" }).click()
        await expect(planLine(page, "free")).toContainText("강제 사용: OpenAI (gpt-4o-mini)")
        await routeForm(page, "Free", 2).getByRole("button", { name: "강제 해제" }).click()
        await expect(planLine(page, "free")).toContainText("우선순위 1. Gemini")
        await routeForm(page, "Free", 2).getByRole("button", { name: "Free 2번 라우트 위로" }).click()
        await expect(planLine(page, "free")).toContainText("1. OpenAI (gpt-4o-mini) → 2. Gemini (gemini-e2e)")

        // Pro는 라우트가 없으면 free를 따른다. 키 없는 Claude를 넣어도 마찬가지다.
        await page.getByRole("tab", { name: /^Pro/ }).click()
        await expect(page.locator('[data-slot="routes-empty"]')).toContainText("Pro 요금제에 라우트가 없습니다")
        await expect(planLine(page, "pro")).toContainText("(free 라우트를 따름) 우선순위 1. OpenAI")
        await addRoute(page, "Pro", "anthropic", "claude-e2e")
        await expect(routeForm(page, "Pro", 1)).toContainText("키 없음")
        await expect(planLine(page, "pro")).toContainText("(free 라우트를 따름)")

        // 새로고침해도 서버에 저장된 값이 보인다.
        await page.reload()
        await expect(planLine(page, "free")).toContainText("1. OpenAI (gpt-4o-mini) → 2. Gemini (gemini-e2e)")
        await page.getByRole("tab", { name: /^Pro/ }).click()
        await routeForm(page, "Pro", 1).getByRole("button", { name: "Pro 1번 라우트 삭제" }).click()
        await expect(page.locator('[data-slot="routes-empty"]')).toContainText("Pro 요금제에 라우트가 없습니다")

        // 빈 요금제는 기본 라우트(Free보다 한 단계씩 비싼 모델)로 한 번에 채운다. Claude는 키가 없어 쓰이지 않는다.
        await page.locator('[data-slot="routes-empty"]').getByRole("button", { name: "기본 라우트 채우기" }).click()
        await expect(routeForm(page, "Pro", 1).getByLabel("모델")).toHaveValue("gemini-2.5-pro")
        await expect(routeForm(page, "Pro", 2).getByLabel("모델")).toHaveValue("gpt-4.1-mini")
        await expect(routeForm(page, "Pro", 3).getByLabel("모델")).toHaveValue("claude-sonnet-5-5")
        await expect(routeForm(page, "Pro", 3)).toContainText("키 없음")
        await expect(planLine(page, "pro")).toContainText("우선순위 1. Gemini (gemini-2.5-pro) → 2. OpenAI (gpt-4.1-mini)")

        // 라우트 추가 폼은 요금제·공급자에 맞는 기본 모델을 미리 채운다(Max의 Claude는 Opus).
        await page.getByRole("tab", { name: /^Max/ }).click()
        const addMax = page.getByRole("form", { name: "Max 라우트 추가" })
        await addMax.getByLabel("공급자").selectOption("anthropic")
        await expect(addMax.getByLabel("모델")).toHaveValue("claude-opus-5-5")
        await addMax.getByLabel("공급자").selectOption("openai")
        await expect(addMax.getByLabel("모델")).toHaveValue("gpt-4.1")

        // 설정을 바꿔도 채팅은 계속 된다(E2E는 fake 공급자라 실제 호출은 없다).
        await page.getByRole("link", { name: "채팅", exact: true }).click()
        await sendChatMessage(page, "서버 설정을 바꾼 뒤 보내는 메시지")
    })

    test("사용자를 검색해 요금제를 바꾸고 그 계정으로 테스트하면, 메시지는 보낼 수 있지만 삭제는 막히며, 내 계정으로 돌아온다", async ({ page }) => {
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

        // 요금제를 Pro로 바꾼다.
        const planSelect = results.getByRole("combobox", { name: `${member.email} 요금제` })
        await expect(planSelect).toHaveValue("free")
        await planSelect.selectOption("pro")
        await expect(planSelect).toHaveValue("pro")

        await results.getByRole("button", { name: `${member.email} 계정으로 테스트` }).click()

        // 그 계정의 채팅 화면으로 가고, 띠가 누구 계정인지 알려 준다. 계정 메뉴에는 바뀐 요금제가 보인다.
        await expect(page).toHaveURL(/\/chat$/)
        const banner = page.locator('[data-slot="acting-banner"]')
        await expect(banner).toContainText(member.email)
        await expect(page.getByRole("navigation", { name: "대화 목록" })).toContainText("대상 사용자의 질문입니다")
        const menu = await openAccountMenu(page)
        await expect(menu.getByText(member.email)).toBeVisible()
        await expect(menu.locator('[data-slot="account-plan"]')).toContainText("Pro")
        await page.keyboard.press("Escape")

        // 재현을 위해 쓰기는 된다(그 사용자 계정에 남는다).
        await page.getByRole("navigation", { name: "대화 목록" }).getByRole("button", { name: "대상 사용자의 질문입니다", exact: true }).click()
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

        // 사용자 계정에는 재현 메시지가 남아 있고 요금제도 Pro다(사용자가 로그인해 확인).
        await logOut(page)
        await signIn(page, member.email, member.password)
        await expect(page).toHaveURL(/\/chat$/)
        await page.getByRole("navigation", { name: "대화 목록" }).getByRole("button", { name: "대상 사용자의 질문입니다", exact: true }).click()
        await expect(page.getByText("관리자가 재현하며 보낸 메시지")).toBeVisible()
        const memberMenu = await openAccountMenu(page)
        await expect(memberMenu.locator('[data-slot="account-plan"]')).toContainText("Pro")
    })

    test("관리자 화면은 좁은 화면에서도 가로로 넘치지 않는다", async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 })
        await signInAsAdmin(page)
        await page.goto("/admin")
        await expect(keyForm(page, "OpenAI")).toBeVisible()
        await expect(page.getByRole("form", { name: "사용자 검색" })).toBeVisible()
        await expect(page.getByRole("form", { name: "Free 라우트 추가" })).toBeVisible()

        expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
    })
})
