"""공통 앱과 샘플 서비스를 조립하는 지점. core/domain에는 서비스 선택을 넣지 않는다."""

from dataclasses import dataclass

from app.core.config import AppProfile


@dataclass(frozen=True)
class ApplicationDefinition:
    profile: AppProfile
    name: str
    system_prompt: str
    diary_enabled: bool


def resolve_application(profile: AppProfile) -> ApplicationDefinition:
    if profile == "starter":
        from app.llm.prompts.chat import DEFAULT_SYSTEM_PROMPT

        return ApplicationDefinition(profile, "AX Chat Starter", DEFAULT_SYSTEM_PROMPT, False)
    if profile == "diary-coach":
        from app.llm.prompts.diary_coach import COACH_SYSTEM_PROMPT

        return ApplicationDefinition(profile, "배움일기 코치", COACH_SYSTEM_PROMPT, True)
    raise ValueError(f"지원하지 않는 앱 프로필입니다: {profile}")
