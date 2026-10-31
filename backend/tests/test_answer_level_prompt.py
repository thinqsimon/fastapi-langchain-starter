"""CHAT-03: 답변 수준별 지시가 프롬프트에 붙는 방식."""

import pytest

from app.core.answer_levels import (
    ANSWER_LEVELS,
    DEFAULT_ANSWER_LEVEL,
    LEVEL_INFO,
    effective_answer_level,
)
from app.llm.prompts.answer_level import LEVEL_INSTRUCTIONS, with_answer_level
from app.llm.prompts.chat import DEFAULT_SYSTEM_PROMPT, build_chat_prompt
from app.llm.prompts.diary_coach import (
    COACH_SYSTEM_PROMPT,
    DRAFT_SYSTEM_PROMPT,
    build_draft_prompt,
    build_weekly_prompt,
)


def test_five_levels_each_have_distinct_instruction_and_screen_text() -> None:
    assert ANSWER_LEVELS == (1, 2, 3, 4, 5)
    assert set(LEVEL_INSTRUCTIONS) == set(LEVEL_INFO) == set(ANSWER_LEVELS)
    assert len(set(LEVEL_INSTRUCTIONS.values())) == 5
    assert [LEVEL_INFO[n].default_name for n in ANSWER_LEVELS] == [
        "왕초보",
        "입문",
        "기초",
        "실전",
        "심화",
    ]
    assert all(info.audience and info.style and info.example for info in LEVEL_INFO.values())


def test_unchosen_or_unknown_level_falls_back_to_level_2() -> None:
    assert DEFAULT_ANSWER_LEVEL == 2
    assert effective_answer_level(None) == 2
    assert effective_answer_level(9) == 2
    assert effective_answer_level(5) == 5


def test_none_keeps_the_persona_unchanged() -> None:
    assert with_answer_level(COACH_SYSTEM_PROMPT, None) == COACH_SYSTEM_PROMPT


@pytest.mark.parametrize("level", ANSWER_LEVELS)
def test_chat_prompt_formats_with_every_level(level: int) -> None:
    """중괄호가 섞이면 ChatPromptTemplate가 변수로 읽어 깨진다."""
    system = with_answer_level(COACH_SYSTEM_PROMPT, level)
    messages = build_chat_prompt(system).format_messages(input="API가 뭐예요?", history=[])

    assert messages[0].content.startswith(COACH_SYSTEM_PROMPT)
    assert "[답변 수준]" in messages[0].content
    assert LEVEL_INSTRUCTIONS[level] in messages[0].content
    assert "직접 요청하면 그 요청을 먼저" in messages[0].content


@pytest.mark.parametrize("level", ANSWER_LEVELS)
def test_diary_prompts_keep_format_rules_and_add_writing_level(level: int) -> None:
    draft = build_draft_prompt(level).format_messages(context="(없음)", conversation="교육생: 안녕")
    weekly = build_weekly_prompt(level).format_messages(entries="일기")

    for system in (draft[0].content, weekly[0].content):
        assert "[작성 수준] 형식과 분량은 위 지시를 그대로 따르고" in system
        assert LEVEL_INSTRUCTIONS[level] in system
    assert draft[0].content.startswith(DRAFT_SYSTEM_PROMPT)


def test_diary_prompts_without_level_are_unchanged() -> None:
    assert build_draft_prompt().format_messages(context="a", conversation="b")[0].content == (
        DRAFT_SYSTEM_PROMPT
    )


def test_default_chat_prompt_also_takes_a_level() -> None:
    system = with_answer_level(DEFAULT_SYSTEM_PROMPT, 1)
    assert (
        LEVEL_INSTRUCTIONS[1]
        in build_chat_prompt(system).format_messages(input="x", history=[])[0].content
    )
