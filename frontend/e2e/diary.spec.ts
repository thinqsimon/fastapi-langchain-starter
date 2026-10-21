import { expect, test, type Page } from "@playwright/test"

import { DEFAULT_FOOTER, localToday, openSettings, sendChatMessage, signUp } from "./helpers"

/** 샘플앱(배움일기 코치): 채팅 고르기 → 초안 → 저장 → 재발행 조건 → 주간 회고 */

const today = localToday()

function entries(page: Page) {
    return page.locator('[data-slot="diary-entry"]')
}

async function openDiary(page: Page) {
    await page.getByRole("link", { name: "일기", exact: true }).click()
    await expect(page.getByRole("heading", { name: "새 배움일기" })).toBeVisible()
}

async function save(page: Page) {
    await page.getByRole("button", { name: "저장", exact: true }).click()
}

test("직접 쓴 일기: 제목은 오늘 날짜로 시작하고, 비운 '내일 할 것'은 빠지고, 푸터가 맨 끝에 붙는다", async ({ page }) => {
    await signUp(page, "e2e-diary")
    await openDiary(page)

    await expect(page.getByLabel("제목")).toHaveValue(today)
    await page.getByLabel("제목").fill(`${today} 의존성 주입`)
    await page.getByLabel("오늘 배운 것").fill("의존성 주입을 배웠다")
    await page.getByLabel("어려웠던 것").fill("세션 범위")
    await save(page)

    const card = entries(page).first()
    await expect(card).toContainText(`${today} 의존성 주입`)
    await expect(card).not.toContainText("내일 할 것")
    await expect(card.locator('[data-slot="diary-footer"]')).toHaveText(DEFAULT_FOOTER)
    await expect(page.getByText("아직 쓴 일기가 없습니다.")).toHaveCount(0)
})

test("채팅을 골라 초안을 만들고, 일기를 쓴 채팅은 새 대화가 생겨야 다시 고를 수 있다", async ({ page }) => {
    await signUp(page, "e2e-diary")
    await sendChatMessage(page, "오늘 의존성 주입을 배웠어요")
    await openDiary(page)

    const picker = page.getByLabel("일기로 만들 채팅")
    await expect(picker).toBeEnabled()
    await page.getByRole("button", { name: "초안 만들기" }).click()

    // 제목은 오늘 날짜 + 핵심 단어. 대화에 내일 계획이 없으면 '내일 할 것'은 비어 있다.
    await expect(page.getByLabel("제목")).toHaveValue(new RegExp(`^${today} \\S`))
    await expect(page.getByLabel("배운 내용 상세")).not.toHaveValue("")
    await expect(page.getByLabel("내일 할 것")).toHaveValue("")
    await save(page)
    await expect(entries(page)).toHaveCount(1)

    // 새 대화가 없으면 같은 채팅을 고를 수 없다.
    await expect(picker).toBeDisabled()
    await expect(picker).toContainText("새 대화가 있는 채팅이 없습니다")

    // 같은 채팅에 대화를 이어 가면 다시 고를 수 있다. 같은 날 두 번째 일기라 제목에 (2)가 붙는다.
    await page.getByRole("link", { name: "채팅" }).click()
    await sendChatMessage(page, "이어서 테스트 픽스처를 배웠어요")
    await openDiary(page)
    await expect(picker).toBeEnabled()
    await expect(picker).toContainText("일기 1편 있음")
    await page.getByRole("button", { name: "초안 만들기" }).click()
    await expect(page.getByLabel("제목")).toHaveValue(new RegExp(`^${today}\\(2\\) \\S`))
    await save(page)

    await expect(entries(page)).toHaveCount(2)
    await expect(picker).toBeDisabled()
})

test("배운 내용 상세는 소제목·목록으로 보여준다", async ({ page }) => {
    await signUp(page, "e2e-diary")
    await openDiary(page)

    await page.getByLabel("오늘 배운 것").fill("세션 주입을 배웠다")
    await page.getByLabel("배운 내용 상세").fill("### 의존성 주입\n- Depends로 세션을 받는다\n- 요청마다 새 세션을 연다")
    await page.getByLabel("어려웠던 것").fill("세션 범위")

    // 저장 전에 미리보기로 확인할 수 있다.
    await page.getByRole("button", { name: "미리보기", exact: true }).click()
    await expect(page.getByRole("heading", { name: "의존성 주입" })).toBeVisible()
    await page.getByRole("button", { name: "작성", exact: true }).click()
    await save(page)

    const card = entries(page).first()
    await card.getByText("배운 내용 상세").click()
    await expect(card.getByRole("heading", { name: "의존성 주입" })).toBeVisible()
    await expect(card.getByRole("listitem")).toHaveText(["Depends로 세션을 받는다", "요청마다 새 세션을 연다"])
})

test("같은 날 여러 편을 쓸 수 있고, 두 번째부터 제목 날짜에 (2)가 붙는다", async ({ page }) => {
    await signUp(page, "e2e-diary")
    await openDiary(page)

    for (const learned of ["첫 기록", "두 번째 기록"]) {
        await page.getByLabel("오늘 배운 것").fill(learned)
        await page.getByLabel("어려웠던 것").fill("어려움")
        await save(page)
        await expect(page.getByText(learned)).toBeVisible()
        // 저장이 끝나 입력칸이 비워진 뒤에 다음 일기를 쓴다.
        await expect(page.getByLabel("오늘 배운 것")).toHaveValue("")
    }

    await expect(entries(page).locator('[data-slot="card-title"]')).toHaveText([`${today}(2)`, today])
})

test("설정에서 바꾼 푸터는 다음 일기부터 붙고, 지난 일기의 푸터는 그대로다", async ({ page }) => {
    await signUp(page, "e2e-diary")
    await openDiary(page)
    await page.getByLabel("오늘 배운 것").fill("바꾸기 전")
    await page.getByLabel("어려웠던 것").fill("없음")
    await save(page)
    await expect(page.getByText("바꾸기 전")).toBeVisible()

    await openSettings(page)
    const preferences = page.getByRole("form", { name: "화면 설정" })
    await preferences.getByLabel("일기 푸터").fill("내일 또 봐요")
    await preferences.getByRole("button", { name: "설정 저장" }).click()
    await expect(preferences.locator('p[role="status"]')).toHaveText("설정을 저장했습니다.")

    await openDiary(page)
    await expect(page.getByText("저장하면 맨 끝에 “내일 또 봐요” 문구가 붙습니다.")).toBeVisible()
    await page.getByLabel("오늘 배운 것").fill("바꾼 뒤")
    await page.getByLabel("어려웠던 것").fill("없음")
    await save(page)

    await expect(entries(page).locator('[data-slot="diary-footer"]')).toHaveText(["내일 또 봐요", DEFAULT_FOOTER])
})

test("주간 회고를 만든다", async ({ page }) => {
    await signUp(page, "e2e-diary")
    await openDiary(page)
    await page.getByLabel("오늘 배운 것").fill("회고용 기록")
    await page.getByLabel("어려웠던 것").fill("어려움")
    await save(page)
    await expect(page.getByText("회고용 기록")).toBeVisible()

    await page.getByRole("button", { name: "회고 만들기" }).click()

    await expect(page.getByText("성장한 점")).toBeVisible()
    await expect(page.getByText("다음 주 제안")).toBeVisible()
})
