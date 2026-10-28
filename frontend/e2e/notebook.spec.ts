import { expect, test, type Page } from "@playwright/test"

import { logOut, newAccount, signUp } from "./helpers"

/** NOTE-01 학습장: /study-notes md 업로드와 주제별 관리 · NOTE-04 보관함(선택 보관·보관함 보기) */

const backend = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8010"
const FILENAME = "2026-10-27_01.md"
const TITLE = "테스트 배움노트 #01"
const OTHER_TITLE = "다른 프로젝트 배움노트 #01"
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

/** 다른 프로젝트(frontmatter project)의 같은 날짜 노트. 파일명은 같지만 따로 올라가야 한다(NOTE-02). */
const OTHER_PROJECT_SAMPLE = SAMPLE.replace("project: SpaceXyzDiary", "project: ai-one-park").split(TITLE).join(OTHER_TITLE)

const list = (page: Page) => page.locator('[data-slot="notebook-list"]')
const detail = (page: Page) => page.locator('[data-slot="topic-detail"]')
const groups = (page: Page) => page.locator('[data-slot="notebook-group"]')
const topics = (page: Page) => page.locator('[data-slot="notebook-topic"]')
const completedTopics = (page: Page) => page.locator('[data-slot="notebook-topic"][data-completed="true"]')
const keptTopics = (page: Page) => page.locator('[data-slot="notebook-topic"][data-kept="true"]')
const selectBar = (page: Page) => page.locator('[data-slot="notebook-select-bar"]')
const viewGroup = (page: Page) => list(page).getByRole("group", { name: "보기", exact: true })
const allView = (page: Page) => viewGroup(page).getByRole("button", { name: "전체", exact: true })
/** 보관한 주제가 있으면 "보관함 N"이라 앞부분만 맞춘다. */
const keptView = (page: Page) => viewGroup(page).getByRole("button", { name: /^보관함/ })
const newView = (page: Page) => viewGroup(page).getByRole("button", { name: /^신규/ })
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

test("같은 파일을 다시 올리면 거부하고, 학습장을 삭제한 뒤에는 다시 올릴 수 있으며, 다른 프로젝트의 같은 파일명은 따로 올라간다", async ({ page }) => {
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

    // 다른 프로젝트의 같은 파일명은 따로 올라간다. 같은 프로젝트의 같은 파일은 여전히 거부된다.
    await uploadFile(page, FILENAME, OTHER_PROJECT_SAMPLE)
    await expect(status(page)).toHaveText("학습장을 올렸어요. 주제 2개")
    await expect(alert(page)).toHaveCount(0)
    await expect(groups(page)).toHaveCount(2)
    await expect(groups(page).first()).toContainText("ai-one-park")
    await expect(groups(page).first()).toContainText(OTHER_TITLE)
    await uploadFile(page, FILENAME, OTHER_PROJECT_SAMPLE)
    await expect(alert(page)).toContainText("이미 올렸습니다")
    await expect(groups(page)).toHaveCount(2)
    await page.reload()
    await expect(groups(page)).toHaveCount(2)
    await expect(topics(page)).toHaveCount(4)
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
    await expect(list(page).getByRole("button", { name: "끝낸 것", exact: true })).toHaveAttribute("aria-pressed", "false")
    await expect(topics(page)).toHaveCount(1)
    await expect(topics(page).getByRole("button", { name: "1. Claude Code 스킬 만들기", exact: true })).toBeVisible()
    // 열어 둔 완료 주제가 목록에서 사라졌으므로 본문도 비워진다(목록·본문 동기화).
    await expect(detail(page)).toContainText("왼쪽에서 주제를 고르세요")

    // 완료 취소하면 '공부할 것'에 다시 나오고 '끝낸 것'은 비어 있다. (칩을 끄고 주제를 다시 연다)
    await list(page).getByRole("button", { name: "공부할 것", exact: true }).click()
    await topics(page).getByRole("button", { name: "2. 플랜 모드 다시 보기", exact: true }).click()
    await detail(page).getByRole("button", { name: "완료 취소", exact: true }).click()
    await expect(status(page)).toHaveText("완료를 취소했어요.")
    await expect(topics(page)).toHaveCount(2)
    await expect(completedTopics(page)).toHaveCount(0)
    await list(page).getByRole("button", { name: "끝낸 것", exact: true }).click()
    await expect(topics(page)).toHaveCount(0)
    // 조건에 맞는 주제가 없는 학습장은 머리글도 숨긴다.
    await expect(groups(page)).toHaveCount(0)
    await expect(list(page)).toContainText("지금 상태 칩에 맞는 주제가 없어요")
    // 눌린 칩을 다시 누르면 꺼져서 모두 보인다(상태 칩에는 '전체'가 없다).
    await list(page).getByRole("button", { name: "끝낸 것", exact: true }).click()
    await expect(list(page).getByRole("button", { name: "끝낸 것", exact: true })).toHaveAttribute("aria-pressed", "false")
    await expect(topics(page)).toHaveCount(2)
    await page.reload()
    await expect(completedTopics(page)).toHaveCount(0)
})

test("주제를 골라 보관하면 보관함에만 모이고, 보기는 새로고침 뒤에도 기억된다", async ({ page }) => {
    await signUp(page, "notebook-keep")
    await seed(page)
    await openNotebook(page)
    await expect(topics(page)).toHaveCount(2)
    await expect(allView(page)).toHaveAttribute("aria-pressed", "true")
    await expect(keptView(page)).toHaveText("보관함")
    await expect(newView(page)).toHaveText("신규 2")
    await expect(keptTopics(page)).toHaveCount(0)

    // 선택 모드: Esc로 끝낼 수 있고, 고른 주제 수가 하단 막대에 보인다.
    await list(page).getByRole("button", { name: "선택", exact: true }).click()
    await expect(selectBar(page)).toContainText("0개 선택")
    await expect(selectBar(page).getByRole("button", { name: "보관", exact: true })).toBeDisabled()
    await page.keyboard.press("Escape")
    await expect(selectBar(page)).toHaveCount(0)
    await expect(topics(page).getByRole("checkbox")).toHaveCount(0)

    // 줄을 누르면 본문이 열리는 대신 체크가 바뀐다. 일부만 고르면 학습장 체크박스는 indeterminate다.
    await list(page).getByRole("button", { name: "선택", exact: true }).click()
    const groupCheckbox = groups(page).getByRole("checkbox", { name: `${TITLE} 모두 선택`, exact: true })
    const firstCheckbox = topics(page).getByRole("checkbox", { name: "1. Claude Code 스킬 만들기 선택", exact: true })
    await expect(groupCheckbox).not.toBeChecked()
    await topics(page).getByText("1. Claude Code 스킬 만들기", { exact: true }).click()
    await expect(firstCheckbox).toBeChecked()
    await expect(selectBar(page)).toContainText("1개 선택")
    await expect(groupCheckbox).toHaveJSProperty("indeterminate", true)
    await expect(detail(page)).toContainText("왼쪽에서 주제를 고르세요.")
    await selectBar(page).getByRole("button", { name: "보관", exact: true }).click()
    await expect(status(page)).toHaveText("주제 1개를 보관했어요.")
    await expect(selectBar(page)).toHaveCount(0)
    await expect(keptTopics(page)).toHaveCount(1)
    await expect(keptTopics(page)).toContainText("1. Claude Code 스킬 만들기")
    await expect(keptView(page)).toHaveText("보관함 1")
    await expect(groups(page)).toContainText("보관 1")

    // 보관한 주제를 열어 둔 채 신규 보기로 바꾸면 목록에서 사라지므로 본문도 비운다(목록·본문 동기화).
    await topics(page).filter({ hasText: "1. Claude Code 스킬 만들기" }).getByRole("button").click()
    await expect(detail(page)).toContainText("Claude Code 스킬 만들기")
    await expect(newView(page)).toHaveText("신규 1")
    await newView(page).click()
    await expect(detail(page)).toContainText("왼쪽에서 주제를 고르세요")
    await expect(topics(page)).toHaveCount(1)
    await expect(topics(page)).toContainText("2. 플랜 모드")
    await expect(keptTopics(page)).toHaveCount(0)

    // 보관함 보기: 보관한 주제만 보이고 새로고침 뒤에도 그 보기 그대로다.
    await keptView(page).click()
    await expect(keptView(page)).toHaveAttribute("aria-pressed", "true")
    await expect(allView(page)).toHaveAttribute("aria-pressed", "false")
    await expect(topics(page)).toHaveCount(1)
    await expect(keptTopics(page)).toHaveCount(1)
    await page.reload()
    await expect(keptView(page)).toHaveAttribute("aria-pressed", "true")
    await expect(topics(page)).toHaveCount(1)
    await expect(topics(page)).toContainText("1. Claude Code 스킬 만들기")

    // 본문 툴바에서 보관 해제하면 보관함이 빈다.
    await topics(page).getByRole("button", { name: "1. Claude Code 스킬 만들기", exact: true }).click()
    await expect(meta(page)).toContainText("보관됨")
    await detail(page).getByRole("button", { name: "보관 해제", exact: true }).click()
    await expect(status(page)).toHaveText("보관함에서 뺐어요.")
    await expect(detail(page)).toContainText("왼쪽에서 주제를 고르세요")
    await expect(topics(page)).toHaveCount(0)
    await expect(groups(page)).toHaveCount(0)
    await expect(list(page)).toContainText("보관한 주제가 없어요. 전체 보기에서 주제를 골라 보관하세요.")
    await expect(keptView(page)).toHaveText("보관함")

    // 전체 보기에서 학습장의 '모두 선택'으로 한 번에 보관한다.
    await allView(page).click()
    await expect(topics(page)).toHaveCount(2)
    await list(page).getByRole("button", { name: "선택", exact: true }).click()
    await groupCheckbox.check()
    await expect(selectBar(page)).toContainText("2개 선택")
    await expect(firstCheckbox).toBeChecked()
    await expect(topics(page).getByRole("checkbox", { name: "2. 플랜 모드 선택", exact: true })).toBeChecked()
    await selectBar(page).getByRole("button", { name: "보관", exact: true }).click()
    await expect(status(page)).toHaveText("주제 2개를 보관했어요.")
    await expect(keptTopics(page)).toHaveCount(2)
    await expect(keptView(page)).toHaveText("보관함 2")
    await expect(groups(page)).toContainText("보관 2")

    // 보관함 안에서도 상태 칩으로 좁힐 수 있다.
    await keptView(page).click()
    await expect(topics(page)).toHaveCount(2)
    await topics(page).getByRole("button", { name: "2. 플랜 모드", exact: true }).click()
    await detail(page).getByRole("button", { name: "학습 완료", exact: true }).click()
    await expect(status(page)).toHaveText("학습 완료로 표시했어요.")
    await list(page).getByRole("button", { name: "끝낸 것", exact: true }).click()
    await expect(topics(page)).toHaveCount(1)
    await expect(topics(page)).toContainText("2. 플랜 모드")
    await list(page).getByRole("button", { name: "끝낸 것", exact: true }).click()
    await expect(topics(page)).toHaveCount(2)

    // 보관함 보기에서 파일을 올리면 새 주제가 바로 보이도록 신규 보기로 바뀐다.
    await uploadFile(page, FILENAME, OTHER_PROJECT_SAMPLE)
    await expect(status(page)).toHaveText("학습장을 올렸어요. 주제 2개")
    await expect(newView(page)).toHaveAttribute("aria-pressed", "true")
    await expect(topics(page)).toHaveCount(2)
    await expect(keptTopics(page)).toHaveCount(0)
    await allView(page).click()
    await expect(groups(page)).toHaveCount(2)
    await expect(topics(page)).toHaveCount(4)
    await expect(keptTopics(page)).toHaveCount(2)
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

test("넓은 화면에서는 목록과 본문 사이를 끌어 목록 너비를 바꾸고, 새로고침·키보드·두 번 누르기에도 맞게 동작한다", async ({ page }) => {
    await signUp(page, "notebook-resize")
    await openNotebook(page)
    const handle = page.locator('[data-slot="notebook-resizer"]')
    const width = async () => (await list(page).boundingBox())!.width
    const initial = await width()

    const box = (await handle.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + 200)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 120, box.y + 200, { steps: 8 })
    await page.mouse.up()
    const widened = await width()
    expect(widened).toBeGreaterThan(initial + 100)
    await expect(handle).toHaveAttribute("aria-valuenow", String(Math.round(widened)))

    await page.reload()
    await expect(page.getByRole("heading", { name: "학습장", exact: true })).toBeVisible()
    await expect.poll(width).toBeCloseTo(widened, 0)

    await handle.focus()
    await page.keyboard.press("ArrowLeft")
    await expect.poll(width).toBeCloseTo(widened - 16, 0)

    await handle.dblclick()
    await expect.poll(width).toBeCloseTo(initial, 0)
    await expect(page.locator('[data-slot="topic-detail"]')).toBeVisible()
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

        // 선택 모드: 하단 막대가 화면 안에 보이고 가로 넘침이 없다.
        await list(page).getByRole("button", { name: "선택", exact: true }).click()
        await expect(selectBar(page)).toBeInViewport()
        await topics(page).getByRole("checkbox", { name: "1. Claude Code 스킬 만들기 선택", exact: true }).check()
        await expect(selectBar(page)).toContainText("1개 선택")
        expect(await hasHorizontalScroll(page)).toBe(false)
        await selectBar(page).getByRole("button", { name: "취소", exact: true }).click()
        await expect(selectBar(page)).toHaveCount(0)
        await expect(topics(page).getByRole("button", { name: "1. Claude Code 스킬 만들기", exact: true })).toBeVisible()
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

test("빈 파일·md가 아닌 파일·스킬 노트가 아닌 md는 올리지 않고, 업로드가 실패하면 안내한 뒤 다시 시도할 수 있다", async ({ page }) => {
    await signUp(page, "notebook-retry")
    await openNotebook(page)
    await uploadFile(page, "empty.md", "")
    await expect(alert(page)).toHaveText("학습장에 저장할 내용이 없습니다.")
    await expect(groups(page)).toHaveCount(0)

    // 올리기 버튼의 안내와 도움말 창
    await expect(list(page).getByRole("button", { name: "학습장 올리기", exact: true })).toHaveAttribute("title", /study-notes/)
    await list(page).getByRole("button", { name: "도움말", exact: true }).click()
    const help = page.getByRole("dialog", { name: "학습장 사용 안내" })
    await expect(help).toBeVisible()
    await expect(help).toContainText("/study-notes")
    await page.keyboard.press("Escape")
    await expect(help).toBeHidden()

    // 확장자는 화면에서, 스킬 노트 서명은 서버에서 거른다.
    await uploadFile(page, "notes.txt", SAMPLE)
    await expect(alert(page)).toHaveText("md 파일(.md, .markdown)만 올릴 수 있습니다.")
    await uploadFile(page, "memo.md", "# 회의록\n\n오늘 할 일\n")
    await expect(alert(page)).toContainText("/study-notes로 만든 학습 노트(md)만 올릴 수 있습니다.")
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
