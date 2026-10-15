"""배움일기 생성 체인. 구조화된 출력을 받아 서비스가 그대로 저장할 수 있게 한다."""

from collections.abc import Sequence

from pydantic import BaseModel, Field

from app.core.exceptions import LLMError
from app.llm.prompts.diary_coach import build_draft_prompt, build_weekly_prompt
from app.llm.providers import get_chat_model


class DiaryDraft(BaseModel):
    """LLM이 채워야 하는 배움일기 항목."""

    learned: str = Field(description="오늘 배운 것")
    difficult: str = Field(description="어려웠던 것")
    next_plan: str = Field(description="내일 할 것")


class WeeklyReview(BaseModel):
    grown: str = Field(description="성장한 점")
    repeated_difficulty: str = Field(description="반복된 어려움")
    suggestion: str = Field(description="다음 주 제안")


def _format_conversation(messages: Sequence[tuple[str, str]]) -> str:
    labels = {"user": "교육생", "assistant": "코치"}
    return "\n".join(f"{labels.get(role, role)}: {content}" for role, content in messages)


async def draft_diary(messages: Sequence[tuple[str, str]]) -> DiaryDraft:
    """대화 전체를 읽고 일기 초안을 만든다."""
    try:
        chain = build_draft_prompt() | get_chat_model().with_structured_output(DiaryDraft)
        result = await chain.ainvoke({"conversation": _format_conversation(messages)})
    except Exception as exc:
        raise LLMError("일기 초안을 만들지 못했습니다.") from exc

    if not isinstance(result, DiaryDraft):
        raise LLMError("일기 초안 형식이 올바르지 않습니다.")
    return result


async def review_week(entries: Sequence[str]) -> WeeklyReview:
    try:
        chain = build_weekly_prompt() | get_chat_model().with_structured_output(WeeklyReview)
        result = await chain.ainvoke({"entries": "\n\n---\n\n".join(entries)})
    except Exception as exc:
        raise LLMError("주간 회고를 만들지 못했습니다.") from exc

    if not isinstance(result, WeeklyReview):
        raise LLMError("주간 회고 형식이 올바르지 않습니다.")
    return result
