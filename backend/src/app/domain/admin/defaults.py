"""요금제별 기본 라우트 = 모델 사다리(ADMIN-04).

부트캠프 학습 코치(한국어 설명, 예시 위주) 기준으로 Free는 가장 싼 모델, Pro·Max는 공급자마다
한 단계씩 비싼 모델을 쓴다. 입력/출력 단가(백만 토큰당 USD)는 llm/pricing.py와 같다.

| 공급자 | Free | Pro | Max |
|---|---|---|---|
| Gemini | gemini-2.5-flash (0.30/2.50) | gemini-2.5-pro (1.25/10) | gemini-2.5-pro |
| OpenAI | gpt-4o-mini (0.15/0.60) | gpt-4.1-mini (0.40/1.60) | gpt-4.1 (2/8) |
| Claude | claude-haiku-5-5 (0.10/0.50) | claude-sonnet-5-5 (2/10) | claude-opus-5-5 (4/20) |

- 순서: Free·Pro는 Gemini → OpenAI → Claude, Max는 GPT-4.1 → Gemini 2.5 Pro → Claude Opus.
- Gemini는 2.5 Pro 위로 안정판이 없어 Max도 2.5 Pro를 쓴다.
- OpenAI는 GPT-5 계열을 쓰지 않는다. temperature를 기본값만 받아 우리 설정(0.3)과 맞지 않는다.
- 키가 없는 공급자의 라우트는 만들어 두어도 쓰이지 않는다(키를 넣는 순간부터 쓰인다).
- 관리자는 화면에서 언제든 바꿀 수 있다. 여기 값은 "처음 상태"일 뿐이다.
"""

DEFAULT_ROUTES: dict[str, list[tuple[str, str]]] = {
    "free": [
        ("google_genai", "gemini-2.5-flash"),
        ("openai", "gpt-4o-mini"),
        ("anthropic", "claude-haiku-5-5"),
    ],
    "pro": [
        ("google_genai", "gemini-2.5-pro"),
        ("openai", "gpt-4.1-mini"),
        ("anthropic", "claude-sonnet-5-5"),
    ],
    "max": [
        ("openai", "gpt-4.1"),
        ("google_genai", "gemini-2.5-pro"),
        ("anthropic", "claude-opus-5-5"),
    ],
}

# 라우트 추가 폼이 공급자·요금제에 맞는 모델을 미리 채울 때 쓴다.
DEFAULT_MODEL_BY_PLAN: dict[str, dict[str, str]] = {
    plan: dict(routes) for plan, routes in DEFAULT_ROUTES.items()
}
