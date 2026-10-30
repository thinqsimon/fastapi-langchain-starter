import { expect, test } from "@playwright/test"

import { sendChatMessage, signUp } from "./helpers"

/** LLM-02: 답변마다 어떤 공급자·모델이 답했는지 표시하고, 사용량 툴팁에 모델별 내역이 보인다. */

test("답변 아래에 답한 모델이 표시되고 새로고침 뒤에도 남는다", async ({ page }) => {
    await signUp(page, "e2e-model-label")
    await sendChatMessage(page, "어떤 모델이 답하나요?")

    // E2E는 fake 공급자라 "테스트 응답"으로 표기된다. 사용자 말풍선에는 붙지 않는다.
    const label = page.locator('[data-slot="message-model"]')
    await expect(label).toHaveCount(1)
    await expect(label).toHaveText("테스트 응답")
    await expect(page.locator('[data-role="user"] [data-slot="message-model"]')).toHaveCount(0)

    // 새로고침하면 대화가 선택돼 있지 않으므로 목록에서 다시 연다. 서버에 저장된 값으로 표기돼야 한다.
    await page.reload()
    await page.getByRole("navigation", { name: "대화 목록" }).getByRole("button", { name: "어떤 모델이 답하나요?", exact: true }).click()
    await expect(page.locator('[data-slot="message-model"]')).toHaveText("테스트 응답")
    // 사용량 배지의 모델별 툴팁은 fake 공급자가 토큰 수를 주지 않아 여기서 볼 수 없다(API 테스트 test_message_model.py가 확인).
})
