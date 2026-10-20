import { expect, test, type Page } from "@playwright/test"

import { DEFAULT_FOOTER, localToday, signUp } from "./helpers"

/** DIARY-04 일기 프리뷰 보기·전체 복사 */

const title = `${localToday()} Docker, Compose`

test.beforeEach(async ({ context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"])
})

async function fillDiary(page: Page, nextPlan = "") {
    await page.getByRole("link", { name: "일기" }).click()
    await page.getByLabel("제목").fill(title)
    await page.getByLabel("오늘 배운 것").fill("Compose로 여러 컨테이너를 한 번에 관리했다.")
    await page.getByLabel("배운 내용 상세").fill("### 컨테이너 실행\n- `docker compose up`\n- `docker compose down`")
    await page.getByLabel("어려웠던 것").fill("네트워크 설정")
    await page.getByLabel("내일 할 것").fill(nextPlan)
}

function clipboard(page: Page) {
    return page.evaluate(async () => {
        const [item] = await navigator.clipboard.read()
        return {
            text: await (await item.getType("text/plain")).text(),
            html: item.types.includes("text/html") ? await (await item.getType("text/html")).text() : "",
        }
    })
}

test("작성 화면: 프리뷰 보기는 일기 전체를 문서 형태로 보여주고 닫기·전체 복사가 있다", async ({ page }) => {
    await signUp(page, "e2e-preview")
    await fillDiary(page)

    await page.getByRole("button", { name: "작성 중인 일기 프리뷰 보기" }).click()
    const preview = page.getByRole("dialog", { name: "일기 프리뷰" })
    await expect(preview).toBeVisible()

    // 제목 → 배운 것 → 배운 내용 상세(소제목 포함) → 어려웠던 것 순서. 비어 있는 '내일 할 것'은 없다.
    await expect(preview.locator("article").getByRole("heading")).toHaveText([title, "배운 것", "배운 내용 상세", "컨테이너 실행", "어려웠던 것"])
    await expect(preview.getByRole("listitem")).toHaveText(["docker compose up", "docker compose down"])
    // 저장하면 붙을 푸터가 맨 끝에 보인다.
    await expect(preview.locator("article > p").last()).toHaveText(DEFAULT_FOOTER)

    await preview.getByRole("button", { name: "프리뷰 전체 복사" }).click()
    await expect(preview.getByRole("button", { name: "프리뷰 전체 복사" })).toContainText("복사됨")
    expect((await clipboard(page)).text).toContain(`# ${title}`)

    await preview.getByRole("button", { name: "닫기" }).click()
    await expect(preview).toBeHidden()
})

test("작성 화면: 전체 복사는 창을 열지 않고 마크다운 글자와 서식을 함께 복사한다", async ({ page }) => {
    await signUp(page, "e2e-preview")
    await fillDiary(page)

    await page.getByRole("button", { name: "작성 중인 일기 전체 복사" }).click()

    await expect(page.getByRole("dialog")).toHaveCount(0)
    await expect(page.getByRole("button", { name: "작성 중인 일기 전체 복사" })).toContainText("복사됨")
    const copied = await clipboard(page)
    expect(copied.text).toBe(
        [
            `# ${title}`,
            "## 배운 것\n\nCompose로 여러 컨테이너를 한 번에 관리했다.",
            "## 배운 내용 상세\n\n### 컨테이너 실행\n- `docker compose up`\n- `docker compose down`",
            "## 어려웠던 것\n\n네트워크 설정",
            `---\n\n${DEFAULT_FOOTER}`,
        ].join("\n\n") + "\n"
    )
    // 서식 붙여 넣기용 HTML도 함께 들어 있다(노션·구글 문서·워드에 제목·목록 서식으로 붙는다).
    expect(copied.html).toContain(`<h1`)
    expect(copied.html).toContain("<li")
})

test("지난 일기 카드에도 프리뷰 보기·전체 복사가 있고 '내일 할 것'은 있을 때만 들어간다", async ({ page }) => {
    await signUp(page, "e2e-preview")
    await fillDiary(page, "볼륨 정리하기")
    await page.getByRole("button", { name: "저장", exact: true }).click()
    const card = page.locator('[data-slot="diary-entry"]').first()
    await expect(card).toContainText(title)

    await card.getByRole("button", { name: `${title} 전체 복사` }).click()
    // 복사가 끝난 뒤에 읽는다(쓰는 중에 읽으면 브라우저가 거부한다).
    await expect(card.getByRole("button", { name: `${title} 전체 복사` })).toContainText("복사됨")
    const copied = await clipboard(page)
    expect(copied.text).toContain("## 어려웠던 것\n\n네트워크 설정\n\n## 내일 할 것\n\n볼륨 정리하기\n\n---")
    expect(copied.text.trimEnd().endsWith(DEFAULT_FOOTER)).toBe(true)

    await card.getByRole("button", { name: `${title} 프리뷰 보기` }).click()
    const preview = page.getByRole("dialog", { name: "일기 프리뷰" })
    await expect(preview.locator("article").getByRole("heading", { level: 1 })).toHaveText(title)
    await expect(preview.getByRole("heading", { name: "내일 할 것" })).toBeVisible()
    await preview.getByRole("button", { name: "닫기" }).click()
    await expect(preview).toBeHidden()
})

test("그냥 쓴 글의 '#'·'---' 줄은 문서의 제목이나 구분선으로 바뀌지 않는다", async ({ page }) => {
    await signUp(page, "e2e-preview")
    await fillDiary(page)
    await page.getByLabel("오늘 배운 것").fill("# 제목처럼 쓴 줄\n---\n일반 문장")

    await page.getByRole("button", { name: "작성 중인 일기 프리뷰 보기" }).click()
    const article = page.getByRole("dialog", { name: "일기 프리뷰" }).locator("article")

    await expect(article.getByRole("heading", { level: 1 })).toHaveText(title)
    await expect(article.getByText("# 제목처럼 쓴 줄")).toBeVisible()
    // 구분선은 푸터 앞 하나뿐이다.
    await expect(article.locator("hr")).toHaveCount(1)
})
