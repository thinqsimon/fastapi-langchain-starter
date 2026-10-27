import { expect, test, type Page } from "@playwright/test"

import { logOut, newAccount, signUp } from "./helpers"

/** NOTE-01 학습장: /study-notes md 업로드와 주제별 관리 */

const backend = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8010"
const FILENAME = "2026-10-27_01.md"
const TITLE = "테스트 배움노트 #01"
const PHONE = { width: 390, height: 844 }

/** /study-notes가 만드는 노트 형식. 목차 표, 메타 줄, 코드 블록 안의 '## '과 '---'를 담는다. */
const SAMPLE = [
    "---",
    `title: ${TITLE}`,
    "project: SpaceXyzDiary",
    "session: e2e",
    "topics: 2",
    "---",
    `# ${TITLE} · 2026-10-27`,
    "",
    "> 학습장 업로드를 검증하려고 만든 노트다.",
    "> 주제는 두 개다.",
    "",
    "## 목차",
    "| # | 주제 | 유형 | 난이도 |",
    "|---|---|---|---|",
    "| 1 | Claude Code 스킬 만들기 | 워크플로 | ★☆☆ |",
    "| 2 | 플랜 모드 | 워크플로 | ★★☆ |",
    "",
    "---",
    "",
    "## 1. Claude Code 스킬 만들기",
    "> 한 줄 요약: 스킬은 절차를 적어 둔 md 파일이다.",
    "",
    "`유형` 워크플로 | `태그` claude-code, skill | `난이도` ★☆☆",
    "",
    "### 어떤 상황에서 나왔나",
    "대화를 학습장 md로 정리하는 스킬이 필요했다.",
    "",
    "```markdown",
    "---",
    "name: handoff",
    "---",
    "## 코드 블록 안의 제목은 주제가 아니다",
    "```",
    "",
    "### 핵심 개념",
    "- SKILL.md는 frontmatter와 본문으로 나뉜다.",
    "",
    "---",
    "",
    "## 2. 플랜 모드",
    "> 한 줄 요약: 코드를 건드리기 전에 계획을 승인받는다.",
    "",
    "`유형` 워크플로 | `태그` claude-code, plan-mode | `난이도` ★★☆",
    "",
    "### 왜 필요한가",
    "설계도 없이 벽돌부터 쌓으면 고치기 어렵다.",
    "",
].join("\n")

const list = (page: Page) => page.locator('[data-slot="notebook-list"]')
const detail = (page: Page) => page.locator('[data-slot="topic-detail"]')
const groups = (page: Page) => page.locator('[data-slot="notebook-group"]')
const topics = (page: Page) => page.locator('[data-slot="notebook-topic"]')
const completedTopics = (page: Page) => page.locator('[data-slot="notebook-topic"][data-completed="true"]')
const meta = (page: Page) => detail(page).locator('[data-slot="topic-meta"]')
const document = (page: Page) => detail(page).locator('[data-slot="diary-document"]')
const alert = (page: Page) => page.locator('p[role="alert"]')
const status = (page: Page) => page.locator('p[role="status"]')

/** API로 바로 올린다(화면 업로드를 거치지 않는 시나리오용). */
async function seed(page: Page, filename = FILENAME, content = SAMPLE) {
    const access = await page.evaluate(() => localStorage.getItem("access_token"))
    const response = await page.request.post(`${backend}/api/notebooks/upload`, {
        headers: { Authorization: `Bearer ${access}` },
        data: { filename, content },
    })
    expect(response.status()).toBe(201)
    return response.json()
}

async function openNotebook(page: Page) {
    await page.getByRole("link", { name: "학습장", exact: true }).click()
    await expect(page).toHaveURL(/\/notebook$/)
    await expect(page.getByRole("heading", { name: "학습장", exact: true })).toBeVisible()
}

async function uploadFile(page: Page, name = FILENAME, content = SAMPLE) {
    await page.locator('[data-slot="notebook-file-input"]').setInputFiles({ name, mimeType: "text/markdown", buffer: Buffer.from(content, "utf8") })
}

async function loginOnPage(page: Page, account: { email: string; password: string }) {
    await page.getByLabel("이메일").fill(account.email)
    await page.getByLabel("비밀번호").fill(account.password)
    await page.getByRole("button", { name: "로그인", exact: true }).click()
    await expect(page).toHaveURL(/\/chat$/)
}

/** 화면에 보이는 모든 입력칸 중 가장 작은 글자 크기(px). 16px 미만이면 모바일 Safari가 누를 때 확대한다. */
async function smallestInputFont(page: Page) {
    return page.evaluate(() =>
        Math.min(
            ...Array.from(window.document.querySelectorAll<HTMLElement>("input, textarea, select"))
                .filter((element) => element.offsetParent !== null)
                .map((element) => parseFloat(getComputedStyle(element).fontSize))
        )
    )
}

async function hasHorizontalScroll(page: Page) {
    return page.evaluate(() => window.document.documentElement.scrollWidth > window.innerWidth)
}

test("md 파일을 올리면 주제별로 나뉘고 본문·메타가 새로고침 뒤에도 유지된다", async ({ page }) => {
    await signUp(page, "notebook-upload")
    await openNotebook(page)
    await expect(list(page)).toContainText("아직 올린 학습장이 없습니다")
    await expect(detail(page)).toContainText("왼쪽에서 주제를 고르세요.")

    await uploadFile(page)
    await expect(status(page)).toHaveText("학습장을 올렸어요. 주제 2개")
    await expect(groups(page)).toHaveCount(1)
    await expect(groups(page).getByRole("heading", { name: TITLE })).toBeVisible()
    await expect(groups(page)).toContainText(FILENAME)
    await expect(topics(page)).toHaveCount(2)
    await expect(topics(page)).toContainText(["1. Claude Code 스킬 만들기", "2. 플랜 모드"])
    await expect(list(page).getByText("목차")).toHaveCount(0)
    await expect(completedTopics(page)).toHaveCount(0)

    // 올리면 첫 주제가 열린다.
    await expect(detail(page).getByRole("heading", { name: "Claude Code 스킬 만들기" })).toBeVisible()
    await expect(topics(page).getByRole("button", { name: "1. Claude Code 스킬 만들기", exact: true })).toHaveAttribute("aria-current", "true")
    await topics(page).getByRole("button", { name: "2. 플랜 모드", exact: true }).click()
    await expect(detail(page).getByRole("heading", { name: "플랜 모드" })).toBeVisible()
    await expect(document(page).getByRole("heading", { name: "왜 필요한가" })).toBeVisible()

    await topics(page).getByRole("button", { name: "1. Claude Code 스킬 만들기", exact: true }).click()
    await expect(document(page).getByRole("heading", { name: "어떤 상황에서 나왔나" })).toBeVisible()
    await expect(document(page).getByRole("heading", { name: "핵심 개념" })).toBeVisible()
    // 코드 블록 안의 '## '은 제목이 아니라 코드 그대로다.
    await expect(document(page).locator("pre")).toContainText("## 코드 블록 안의 제목은 주제가 아니다")
    await expect(document(page).getByRole("heading", { name: "코드 블록 안의 제목은 주제가 아니다" })).toHaveCount(0)
    // 메타 줄은 본문에서 빠지고 topic-meta에 들어간다.
    await expect(document(page).getByText("유형", { exact: true })).toHaveCount(0)
    await expect(document(page)).not.toContainText("워크플로")
    await expect(meta(page)).toContainText("워크플로")
    await expect(meta(page)).toContainText("claude-code, skill")
    await expect(meta(page)).toContainText("★")

    await page.reload()
    await expect(groups(page).getByRole("heading", { name: TITLE })).toBeVisible()
    await expect(topics(page)).toHaveCount(2)
    await topics(page).getByRole("button", { name: "1. Claude Code 스킬 만들기", exact: true }).click()
    await expect(document(page).locator("pre")).toContainText("## 코드 블록 안의 제목은 주제가 아니다")
    await expect(meta(page)).toContainText("워크플로")
})

test("같은 파일을 다시 올리면 거부하고, 학습장을 삭제한 뒤에는 다시 올릴 수 있다", async ({ page }) => {
    await signUp(page, "notebook-duplicate")
    await seed(page)
    await openNotebook(page)
    await expect(groups(page)).toHaveCount(1)

    await uploadFile(page)
    await expect(alert(page)).toContainText("이미 올렸습니다")
    await expect(groups(page)).toHaveCount(1)

    await groups(page)
        .getByRole("button", { name: `${TITLE} 삭제` })
        .click()
    const dialog = page.getByRole("dialog", { name: "학습장을 삭제할까요?" })
    await expect(dialog).toBeVisible()
    await dialog.getByRole("button", { name: "취소", exact: true }).click()
    await expect(dialog).toBeHidden()
    await expect(groups(page)).toHaveCount(1)

    await groups(page)
        .getByRole("button", { name: `${TITLE} 삭제` })
        .click()
    await dialog.getByRole("button", { name: "삭제하기" }).click()
    await expect(status(page)).toHaveText("학습장을 삭제했어요.")
    await expect(groups(page)).toHaveCount(0)
    await expect(list(page)).toContainText("아직 올린 학습장이 없습니다")

    await uploadFile(page)
    await expect(status(page)).toHaveText("학습장을 올렸어요. 주제 2개")
    await expect(alert(page)).toHaveCount(0)
    await expect(topics(page)).toHaveCount(2)
    await page.reload()
    await expect(groups(page)).toHaveCount(1)
    await expect(topics(page)).toHaveCount(2)
})

test("주제를 수정하고 학습 완료를 표시하면 재로그인 뒤에도 유지되고 필터로 나눠 본다", async ({ page }) => {
    const account = await signUp(page, "notebook-edit")
    await seed(page)
    await openNotebook(page)
    await topics(page).getByRole("button", { name: "2. 플랜 모드", exact: true }).click()
    await expect(detail(page).getByRole("heading", { name: "플랜 모드" })).toBeVisible()

    await detail(page).getByRole("button", { name: "수정", exact: true }).click()
    await expect(page.getByLabel("제목", { exact: true })).toHaveValue("플랜 모드")
    await expect(page.getByLabel("유형", { exact: true })).toHaveValue("워크플로")
    await expect(page.getByLabel("태그", { exact: true })).toHaveValue("claude-code, plan-mode")
    await expect(page.getByLabel("난이도", { exact: true })).toHaveValue("2")
    await expect(page.getByLabel("내용", { exact: true })).toHaveValue(/### 왜 필요한가/)
    await page.getByLabel("제목", { exact: true }).fill("플랜 모드 다시 보기")
    await page.getByLabel("유형", { exact: true }).fill("개념")
    await page.getByLabel("태그", { exact: true }).fill("plan-mode, 승인")
    await page.getByLabel("난이도", { exact: true }).selectOption("3")
    await page.getByLabel("내용", { exact: true }).fill("### 고친 소제목\n계획을 먼저 승인받는다.")

    // 작성 → 미리보기 → 작성
    await expect(page.getByRole("button", { name: "작성", exact: true })).toHaveAttribute("aria-pressed", "true")
    await page.getByRole("button", { name: "미리보기", exact: true }).click()
    await expect(page.getByRole("button", { name: "미리보기", exact: true })).toHaveAttribute("aria-pressed", "true")
    await expect(page.getByLabel("내용", { exact: true })).toBeHidden()
    await expect(detail(page).getByRole("heading", { name: "고친 소제목" })).toBeVisible()
    await page.getByRole("button", { name: "작성", exact: true }).click()
    await expect(page.getByLabel("내용", { exact: true })).toBeVisible()
    await page.getByRole("button", { name: "저장", exact: true }).click()
    await expect(status(page)).toHaveText("주제를 저장했어요.")
    await expect(detail(page).getByRole("heading", { name: "플랜 모드 다시 보기" })).toBeVisible()
    await expect(meta(page)).toContainText("개념")
    await expect(meta(page)).toContainText("plan-mode, 승인")
    await expect(meta(page)).toContainText("★★★")
    await expect(document(page).getByRole("heading", { name: "고친 소제목" })).toBeVisible()
    await expect(topics(page).getByRole("button", { name: "2. 플랜 모드 다시 보기", exact: true })).toBeVisible()

    // 학습 완료
    await detail(page).getByRole("button", { name: "학습 완료", exact: true }).click()
    await expect(status(page)).toHaveText("학습 완료로 표시했어요.")
    await expect(completedTopics(page)).toHaveCount(1)
    await expect(completedTopics(page)).toContainText("플랜 모드 다시 보기")
    await expect(detail(page).getByRole("button", { name: "완료 취소", exact: true })).toBeVisible()

    await logOut(page)
    await loginOnPage(page, account)
    await openNotebook(page)
    await expect(topics(page)).toHaveCount(2)
    await expect(completedTopics(page)).toHaveCount(1)
    await topics(page).getByRole("button", { name: "2. 플랜 모드 다시 보기", exact: true }).click()
    await expect(document(page).getByRole("heading", { name: "고친 소제목" })).toBeVisible()
    await expect(meta(page)).toContainText("개념")
    await expect(meta(page)).toContainText("★★★")

    // 필터
    await list(page).getByRole("button", { name: "끝낸 것", exact: true }).click()
    await expect(list(page).getByRole("button", { name: "끝낸 것", exact: true })).toHaveAttribute("aria-pressed", "true")
    await expect(topics(page)).toHaveCount(1)
    await expect(topics(page).getByRole("button", { name: "2. 플랜 모드 다시 보기", exact: true })).toBeVisible()
    await list(page).getByRole("button", { name: "공부할 것", exact: true }).click()
    await expect(topics(page)).toHaveCount(1)
    await expect(topics(page).getByRole("button", { name: "1. Claude Code 스킬 만들기", exact: true })).toBeVisible()

    // 완료 취소하면 '공부할 것'에 다시 나오고 '끝낸 것'은 비어 있다.
    await detail(page).getByRole("button", { name: "완료 취소", exact: true }).click()
    await expect(status(page)).toHaveText("완료를 취소했어요.")
    await expect(topics(page)).toHaveCount(2)
    await expect(completedTopics(page)).toHaveCount(0)
    await list(page).getByRole("button", { name: "끝낸 것", exact: true }).click()
    await expect(topics(page)).toHaveCount(0)
    await expect(groups(page)).toContainText("주제가 없습니다.")
    await list(page).getByRole("button", { name: "전체", exact: true }).click()
    await expect(topics(page)).toHaveCount(2)
    await page.reload()
    await expect(completedTopics(page)).toHaveCount(0)
})

test("업로드 없이 학습장과 주제를 직접 만들고, 이름을 바꾸고, 주제를 삭제한다", async ({ page }) => {
    await signUp(page, "notebook-manual")
    await openNotebook(page)
    await list(page).getByRole("button", { name: "새 학습장", exact: true }).click()
    await page.getByLabel("학습장 이름").fill("직접 쓴 학습장")
    await list(page).getByRole("button", { name: "만들기", exact: true }).click()
    await expect(groups(page)).toHaveCount(1)
    await expect(groups(page).getByRole("heading", { name: "직접 쓴 학습장" })).toBeVisible()
    await expect(groups(page)).toContainText("직접 만든 학습장")
    await expect(groups(page)).toContainText("주제가 없습니다.")
    await expect(page.getByLabel("학습장 이름")).toHaveCount(0)

    await groups(page).getByRole("button", { name: "새 주제", exact: true }).click()
    await expect(detail(page).getByRole("heading", { name: "새 주제" })).toBeVisible()
    await page.getByLabel("제목", { exact: true }).fill("직접 쓴 주제")
    await page.getByLabel("유형", { exact: true }).fill("개념")
    await page.getByLabel("태그", { exact: true }).fill("zustand, 상태")
    await page.getByLabel("난이도", { exact: true }).selectOption("1")
    await page.getByLabel("내용", { exact: true }).fill("### 처음 쓴 소제목\n직접 쓴 본문")
    await page.getByRole("button", { name: "추가", exact: true }).click()
    await expect(status(page)).toHaveText("주제를 추가했어요.")
    await expect(topics(page)).toHaveCount(1)
    await expect(topics(page).getByRole("button", { name: "1. 직접 쓴 주제", exact: true })).toHaveAttribute("aria-current", "true")
    await expect(detail(page).getByRole("heading", { name: "직접 쓴 주제" })).toBeVisible()
    await expect(meta(page)).toContainText("개념")
    await expect(meta(page)).toContainText("zustand, 상태")
    await expect(meta(page)).toContainText("★")
    await expect(document(page).getByRole("heading", { name: "처음 쓴 소제목" })).toBeVisible()

    await page.reload()
    await expect(topics(page)).toHaveCount(1)
    await topics(page).getByRole("button", { name: "1. 직접 쓴 주제", exact: true }).click()
    await expect(document(page).getByRole("heading", { name: "처음 쓴 소제목" })).toBeVisible()

    // 이름 바꾸기
    await groups(page).getByRole("button", { name: "이름 바꾸기", exact: true }).click()
    await groups(page).getByLabel("학습장 이름").fill("이름을 바꾼 학습장")
    await groups(page).getByRole("button", { name: "저장", exact: true }).click()
    await expect(groups(page).getByRole("heading", { name: "이름을 바꾼 학습장" })).toBeVisible()
    await expect(groups(page).getByLabel("학습장 이름")).toHaveCount(0)

    // 주제 삭제는 확인 창을 거친다.
    await detail(page).getByRole("button", { name: "직접 쓴 주제 삭제" }).click()
    const dialog = page.getByRole("dialog", { name: "주제를 삭제할까요?" })
    await dialog.getByRole("button", { name: "취소", exact: true }).click()
    await expect(dialog).toBeHidden()
    await expect(topics(page)).toHaveCount(1)
    await detail(page).getByRole("button", { name: "직접 쓴 주제 삭제" }).click()
    await dialog.getByRole("button", { name: "삭제하기" }).click()
    await expect(status(page)).toHaveText("주제를 삭제했어요.")
    await expect(topics(page)).toHaveCount(0)
    await expect(groups(page)).toContainText("주제가 없습니다.")
    await expect(detail(page)).toContainText("왼쪽에서 주제를 고르세요.")
    await page.reload()
    await expect(groups(page).getByRole("heading", { name: "이름을 바꾼 학습장" })).toBeVisible()
    await expect(topics(page)).toHaveCount(0)
})

test.describe("터치 폰(390px)", () => {
    test.use({ viewport: PHONE, hasTouch: true, isMobile: true })

    test("목록과 본문을 한 칸씩 보여 주고 '목록'으로 돌아오며 가로 넘침이 없다", async ({ page }) => {
        await signUp(page, "notebook-mobile")
        await seed(page)
        await openNotebook(page)
        await expect(list(page)).toBeVisible()
        await expect(detail(page)).toBeHidden()
        await expect(topics(page)).toHaveCount(2)
        expect(await hasHorizontalScroll(page)).toBe(false)
        expect(await smallestInputFont(page)).toBeGreaterThanOrEqual(16)

        await topics(page).getByRole("button", { name: "1. Claude Code 스킬 만들기", exact: true }).click()
        await expect(detail(page)).toBeVisible()
        await expect(list(page)).toBeHidden()
        await expect(document(page).locator("pre")).toContainText("## 코드 블록 안의 제목은 주제가 아니다")
        expect(await hasHorizontalScroll(page)).toBe(false)

        await detail(page).getByRole("button", { name: "수정", exact: true }).click()
        await expect(page.getByLabel("제목", { exact: true })).toHaveValue("Claude Code 스킬 만들기")
        expect(await smallestInputFont(page)).toBeGreaterThanOrEqual(16)
        expect(await hasHorizontalScroll(page)).toBe(false)

        await detail(page).getByRole("button", { name: "목록", exact: true }).click()
        await expect(list(page)).toBeVisible()
        await expect(detail(page)).toBeHidden()

        await groups(page).getByRole("button", { name: "새 주제", exact: true }).click()
        await expect(detail(page).getByRole("heading", { name: "새 주제" })).toBeVisible()
        await expect(list(page)).toBeHidden()
        expect(await smallestInputFont(page)).toBeGreaterThanOrEqual(16)
        await detail(page).getByRole("button", { name: "취소", exact: true }).click()
        await expect(list(page)).toBeVisible()
        await expect(detail(page)).toBeHidden()
    })
})

test("다른 계정에는 보이지 않고, 로그아웃 뒤 늦게 온 업로드 응답은 표시하지 않는다", async ({ page }) => {
    const account = await signUp(page, "notebook-session")
    const other = newAccount("notebook-other")
    expect(
        (
            await page.request.post(`${backend}/api/auth/signup`, { data: { email: other.email, password: other.password, display_name: other.displayName } })
        ).status()
    ).toBe(201)
    await openNotebook(page)
    let release!: () => void
    let stored!: () => void
    const gate = new Promise<void>((resolve) => {
        release = resolve
    })
    const written = new Promise<void>((resolve) => {
        stored = resolve
    })
    await page.route("**/api/notebooks/upload", async (route) => {
        const response = await route.fetch()
        stored()
        await gate
        await route.fulfill({ response })
    })
    await uploadFile(page)
    await expect(list(page).getByRole("button", { name: "올리는 중…" })).toBeDisabled()
    await written
    await logOut(page)
    await loginOnPage(page, other)
    await openNotebook(page)
    await expect(list(page)).toContainText("아직 올린 학습장이 없습니다")
    const otherToken = await page.evaluate(() => localStorage.getItem("access_token"))
    const finished = page.waitForResponse((response) => response.url().endsWith("/api/notebooks/upload"))
    release()
    await (await finished).finished()
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
    await expect(groups(page)).toHaveCount(0)
    await expect(page.getByText("학습장을 올렸어요")).toHaveCount(0)
    await expect(list(page)).toContainText("아직 올린 학습장이 없습니다")
    await expect(list(page).getByRole("button", { name: "학습장 올리기", exact: true })).toBeEnabled()

    // 원래 계정에는 올린 학습장이 있고, 다른 계정의 토큰으로는 그 주제를 열 수 없다.
    await logOut(page)
    await loginOnPage(page, account)
    await openNotebook(page)
    await expect(groups(page)).toHaveCount(1)
    await expect(topics(page)).toHaveCount(2)
    const mine = await page.evaluate(() => localStorage.getItem("access_token"))
    const notebooks = await (await page.request.get(`${backend}/api/notebooks`, { headers: { Authorization: `Bearer ${mine}` } })).json()
    const topicId: string = notebooks[0].topics[0].id
    expect((await page.request.get(`${backend}/api/notebooks/topics/${topicId}`, { headers: { Authorization: `Bearer ${otherToken}` } })).status()).toBe(404)
    expect((await page.request.get(`${backend}/api/notebooks/topics/${topicId}`)).status()).toBe(401)
})

test("빈 파일은 올리지 않고, 업로드가 실패하면 안내한 뒤 다시 시도할 수 있다", async ({ page }) => {
    await signUp(page, "notebook-retry")
    await openNotebook(page)
    await uploadFile(page, "empty.md", "")
    await expect(alert(page)).toHaveText("학습장에 저장할 내용이 없습니다.")
    await expect(groups(page)).toHaveCount(0)

    await page.route(
        "**/api/notebooks/upload",
        (route) => route.fulfill({ status: 503, json: { error: { code: "UNAVAILABLE", message: "지금은 올릴 수 없어요." } } }),
        { times: 1 }
    )
    await uploadFile(page)
    await expect(alert(page)).toHaveText("지금은 올릴 수 없어요.")
    await expect(groups(page)).toHaveCount(0)
    await expect(list(page).getByRole("button", { name: "학습장 올리기", exact: true })).toBeEnabled()

    await uploadFile(page)
    await expect(status(page)).toHaveText("학습장을 올렸어요. 주제 2개")
    await expect(alert(page)).toHaveCount(0)
    await expect(topics(page)).toHaveCount(2)
})
