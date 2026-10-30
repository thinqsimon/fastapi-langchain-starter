"""요금제(구독 등급) 이름(ADMIN-03). 지금은 관리자가 수동 지정, 나중에 구독 결제가 채운다.

요금제마다 쓰는 LLM 공급자·모델이 다르다(`app.domain.admin` 라우팅). 새 등급을 추가하려면 여기와
프론트 `lib/llm-labels.ts`의 표시명만 늘리면 된다.
"""

from typing import Literal

PlanName = Literal["free", "pro", "max"]

PLANS: tuple[PlanName, ...] = ("free", "pro", "max")
DEFAULT_PLAN: PlanName = "free"
