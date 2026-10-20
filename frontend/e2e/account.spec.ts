import { expect, test } from "@playwright/test"

import { DEFAULT_CATCHPHRASE, logOut, openAccountMenu, openSettings, signIn, signUp } from "./helpers"

/** 계정 사이드 메뉴(UX-01)와 설정 화면: 계정 정보(ACC-01), 캐치프레이즈·푸터(PREF-01) */

test("계정 버튼을 누르면 오른쪽에서 계정 정보·설정·로그아웃 메뉴가 열린다", async ({ page }) => {
    const account = await signUp(page, "e2e-account")

    const menu = await openAccountMenu(page)

    await expect(menu.getByText(account.email)).toBeVisible()
    await expect(menu.getByText(account.displayName)).toBeVisible()
    await expect(menu.getByRole("button", { name: "설정" })).toBeVisible()
    await expect(menu.getByRole("button", { name: "로그아웃" })).toBeVisible()
    // 화면 오른쪽 끝에 붙어 열린다(열리는 효과가 끝난 뒤 위치).
    const width = page.viewportSize()!.width
    await expect.poll(async () => menu.boundingBox().then((box) => Math.round((box?.x ?? 0) + (box?.width ?? 0)))).toBe(width)
})

test("설정에서 이름·캐치프레이즈·푸터를 바꾸고 기본값으로 되돌린다", async ({ page }) => {
    await signUp(page, "e2e-account")
    await openSettings(page)

    const nameForm = page.getByRole("form", { name: "이름 변경" })
    await nameForm.getByLabel("이름").fill("바뀐 이름")
    await nameForm.getByRole("button", { name: "이름 저장" }).click()
    await expect(nameForm.locator('p[role="status"]')).toHaveText("이름을 바꿨습니다.")
    await expect(page.getByRole("button", { name: "계정 메뉴 열기" })).toContainText("바뀐 이름")

    const preferences = page.getByRole("form", { name: "화면 설정" })
    await expect(preferences.getByLabel("캐치프레이즈")).toHaveValue(DEFAULT_CATCHPHRASE)
    await preferences.getByLabel("캐치프레이즈").fill("오늘도 한 걸음")
    await preferences.getByLabel("일기 푸터").fill("내일 또 봐요")
    await preferences.getByRole("button", { name: "설정 저장" }).click()
    await expect(preferences.locator('p[role="status"]')).toHaveText("설정을 저장했습니다.")
    await expect(page.locator('[data-slot="catchphrase"]')).toHaveText("오늘도 한 걸음")

    // 다른 화면에 다녀와도(새로 불러와도) 서버에 저장된 값이 보인다.
    await page.reload()
    await expect(preferences.getByLabel("일기 푸터")).toHaveValue("내일 또 봐요")
    await preferences.getByRole("button", { name: "기본값으로 되돌리기" }).click()
    await expect(preferences.getByLabel("캐치프레이즈")).toHaveValue(DEFAULT_CATCHPHRASE)
    await expect(page.locator('[data-slot="catchphrase"]')).toContainText("풀스택 화이팅")
})

test("이메일을 바꾸면 메뉴에 새 이메일이 보이고, 그 이메일로 로그인한다", async ({ page }) => {
    const account = await signUp(page, "e2e-account")
    const newEmail = account.email.replace("e2e-account", "e2e-renamed")
    await openSettings(page)

    const form = page.getByRole("form", { name: "이메일 변경" })
    await form.getByLabel("이메일").fill(newEmail)
    await form.getByLabel("현재 비밀번호").fill(account.password)
    await form.getByRole("button", { name: "이메일 변경" }).click()
    await expect(form.locator('p[role="status"]')).toContainText("이메일을 바꿨습니다")

    await expect((await openAccountMenu(page)).getByText(newEmail)).toBeVisible()
    await page.keyboard.press("Escape")
    await logOut(page)
    await signIn(page, newEmail, account.password)
    await expect(page).toHaveURL(/\/chat$/)
})

test("비밀번호를 바꿔도 이 화면은 로그인이 유지되고, 다음부터 새 비밀번호로 로그인한다", async ({ page }) => {
    const account = await signUp(page, "e2e-account")
    await openSettings(page)

    const form = page.getByRole("form", { name: "비밀번호 변경" })
    await form.getByLabel("현재 비밀번호").fill(account.password)
    await form.getByLabel("새 비밀번호", { exact: true }).fill("e2e-new-password")
    await form.getByLabel("새 비밀번호 확인").fill("e2e-new-password")
    await form.getByRole("button", { name: "비밀번호 변경" }).click()
    await expect(form.locator('p[role="status"]')).toContainText("비밀번호를 바꿨습니다")

    // 새로 받은 토큰이 저장됐는지 확인한다. 액세스 토큰을 못 쓰게 만들면 리프레시 토큰으로 복구해야 하는데,
    // 예전 리프레시 토큰은 폐기됐으므로 새 토큰이 저장돼 있어야만 화면이 유지된다.
    await page.evaluate(() => localStorage.setItem("access_token", "expired.invalid.token"))
    await page.reload()
    await expect(page).toHaveURL(/\/settings$/)
    await expect(page.getByRole("button", { name: "계정 메뉴 열기" })).toBeVisible()

    await logOut(page)
    await signIn(page, account.email, "e2e-new-password")
    await expect(page).toHaveURL(/\/chat$/)
})

test("현재 비밀번호가 틀리면 오류만 보여주고 로그아웃되지 않는다", async ({ page }) => {
    await signUp(page, "e2e-account")
    await openSettings(page)

    const form = page.getByRole("form", { name: "비밀번호 변경" })
    await form.getByLabel("현재 비밀번호").fill("wrong-password")
    await form.getByLabel("새 비밀번호", { exact: true }).fill("e2e-new-password")
    await form.getByLabel("새 비밀번호 확인").fill("e2e-new-password")
    await form.getByRole("button", { name: "비밀번호 변경" }).click()

    await expect(form.locator('p[role="alert"]')).toHaveText("현재 비밀번호가 올바르지 않습니다.")
    await expect(page).toHaveURL(/\/settings$/)
    await expect(page.getByRole("button", { name: "계정 메뉴 열기" })).toBeVisible()
})
