"""배움일기 생성 체인. 구조화된 출력을 받아 서비스가 그대로 저장할 수 있게 한다."""

import re
from collections.abc import Sequence

from pydantic import BaseModel, Field

from app.core.exceptions import LLMError
from app.llm.prompts.diary_coach import build_draft_prompt, build_weekly_prompt
from app.llm.providers import get_chat_model


class DiaryDraft(BaseModel):
    """LLM이 채워야 하는 배움일기 항목."""

    keywords: str = Field(description="배운 내용의 핵심 단어 2~4개, 쉼표로 구분")
    learned: str = Field(description="배운 것 요약(3~5문장)")
    learned_detail: str = Field(
        description="주제별 '### 소제목' 마크다운으로 정리한 상세 내용. 길이 제한 없음"
    )
    difficult: str = Field(description="어려웠던 것")
    next_plan: str = Field(description="대화에 내일 할 것이 분명히 있을 때만. 없으면 빈 문자열")
    next_plan_evidence: str = Field(
        description="next_plan의 근거 문장을 새 대화에서 그대로 옮긴 것. 없으면 빈 문자열"
    )


class WeeklyReview(BaseModel):
    grown: str = Field(description="성장한 점")
    repeated_difficulty: str = Field(description="반복된 어려움")
    suggestion: str = Field(description="다음 주 제안")


SPEAKER_LABELS = {"user": "교육생", "assistant": "코치"}


def _format_conversation(messages: Sequence[tuple[str, str]]) -> str:
    return "\n".join(f"{SPEAKER_LABELS.get(role, role)}: {content}" for role, content in messages)


# 한두 글자("네", "내일")만 인용하면 어디에나 있으므로 근거로 보지 않는다.
MIN_EVIDENCE_LENGTH = 4
# 모델이 인용 앞에 붙이곤 하는 화자 표시("교육생: ")
_SPEAKER_PREFIX = re.compile(rf"^\s*(?:{'|'.join(SPEAKER_LABELS.values())})\s*:\s*")


def _compact(text: str) -> str:
    """공백·따옴표 차이 때문에 인용을 놓치지 않도록 비교용으로 정리한다."""
    return re.sub(r"[\s\"'“”‘’]", "", text)


def keep_grounded_next_plan(draft: DiaryDraft, messages: Sequence[str]) -> DiaryDraft:
    """'내일 할 것'은 대화에 근거가 있을 때만 남긴다.

    모델은 "없으면 비워 두라"는 지시를 받아도 그럴듯한 계획을 지어내곤 한다.
    그래서 근거 문장을 대화에서 그대로 인용하게 하고, 그 문장이 실제 메시지 본문에 없으면 비운다.
    화자 표시는 대화에 쓴 말이 아니므로 근거에서 빼고 본다.
    """
    evidence = _compact(_SPEAKER_PREFIX.sub("", draft.next_plan_evidence))
    grounded = (
        bool(draft.next_plan.strip())
        and len(evidence) >= MIN_EVIDENCE_LENGTH
        and any(evidence in _compact(message) for message in messages)
    )
    if grounded:
        return draft
    return draft.model_copy(update={"next_plan": "", "next_plan_evidence": ""})


async def draft_diary(
    new_messages: Sequence[tuple[str, str]],
    context_messages: Sequence[tuple[str, str]] = (),
) -> DiaryDraft:
    """새로 추가된 대화로 일기 초안을 만든다. 이전 대화는 맥락으로만 넘긴다."""
    conversation = _format_conversation(new_messages)
    try:
        chain = build_draft_prompt() | get_chat_model().with_structured_output(DiaryDraft)
        result = await chain.ainvoke(
            {
                "context": _format_conversation(context_messages) or "(없음)",
                "conversation": conversation,
            }
        )
    except Exception as exc:
        raise LLMError("일기 초안을 만들지 못했습니다.") from exc

    if not isinstance(result, DiaryDraft):
        raise LLMError("일기 초안 형식이 올바르지 않습니다.")
    return keep_grounded_next_plan(result, [content for _, content in new_messages])


async def review_week(entries: Sequence[str]) -> WeeklyReview:
    try:
        chain = build_weekly_prompt() | get_chat_model().with_structured_output(WeeklyReview)
        result = await chain.ainvoke({"entries": "\n\n---\n\n".join(entries)})
    except Exception as exc:
        raise LLMError("주간 회고를 만들지 못했습니다.") from exc

    if not isinstance(result, WeeklyReview):
        raise LLMError("주간 회고 형식이 올바르지 않습니다.")
    return result
