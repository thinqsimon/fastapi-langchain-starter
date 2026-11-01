"""CHAT-04: 답변 끝의 추천 질문 태그를 떼어 내는 방식과 지시문."""

import pytest
from langchain_core.messages import HumanMessage, SystemMessage

from app.llm.chains.chat import QUESTION_MAX_LENGTH, QuestionSplitter, parse_questions, stream_reply
from app.llm.fake import DEFAULT_REPLY, FAKE_QUESTIONS, build_fake_chat_model
from app.llm.prompts.chat import DEFAULT_SYSTEM_PROMPT, build_chat_prompt
from app.llm.prompts.suggested_questions import (
    CLOSE_TAG,
    OPEN_TAG,
    SUGGESTED_QUESTIONS_INSTRUCTION,
    with_suggested_questions,
)

ANSWER = "## useEffect\n화면이 그려진 뒤에 실행돼요.\n\n"
QUESTIONS = ["의존성 배열을 비우면요?", "클린업은 왜 필요해요?", "useLayoutEffect와 차이는요?"]
BLOCK = OPEN_TAG + "\n" + "\n".join(f"- {question}" for question in QUESTIONS) + "\n" + CLOSE_TAG


def split(chunks: list[str]) -> tuple[str, list[str]]:
    splitter = QuestionSplitter()
    shown = "".join(splitter.feed(chunk) for chunk in chunks)
    rest, questions = splitter.finish()
    return shown + rest, questions


@pytest.mark.parametrize("size", [1, 3, 7, len(ANSWER + BLOCK)])
def test_splitter_shows_only_the_answer_however_the_stream_is_cut(size: int) -> None:
    text = ANSWER + BLOCK
    chunks = [text[start : start + size] for start in range(0, len(text), size)]

    assert split(chunks) == (ANSWER, QUESTIONS)


def test_text_that_only_looks_like_the_tag_start_is_still_shown() -> None:
    """'<follow'처럼 태그의 앞부분만 오고 끝나면, 잡아 두었던 글도 답변이다."""
    assert split(["비교 연산자 <", "follow 와 <fo"]) == ("비교 연산자 <follow 와 <fo", [])


def test_answer_without_tag_has_no_questions() -> None:
    assert split([ANSWER]) == (ANSWER, [])


@pytest.mark.parametrize(
    "body",
    [
        "1. 첫째\n2) 둘째\n* 셋째\n",
        "- **첫째**\n- 둘째\n\n- 셋째\n- 넷째는 버린다\n",
        "• 첫째\n둘째\n- 셋째",
    ],
)
def test_parse_questions_accepts_common_list_styles(body: str) -> None:
    """목록 표시가 달라도, 닫는 태그가 없어도 읽고, 많으면 앞의 3개만 쓴다."""
    assert parse_questions(body) == ["첫째", "둘째", "셋째"]


def test_parse_questions_stops_at_close_tag_and_trims_long_lines() -> None:
    long = "가" * (QUESTION_MAX_LENGTH + 50)

    assert parse_questions(f"- {long}\n{CLOSE_TAG}\n- 버림") == ["가" * QUESTION_MAX_LENGTH]


def test_instruction_has_no_braces_and_comes_last() -> None:
    """ChatPromptTemplate가 중괄호를 변수로 읽어 오류가 나므로 쓰지 않는다."""
    assert "{" not in SUGGESTED_QUESTIONS_INSTRUCTION
    assert "}" not in SUGGESTED_QUESTIONS_INSTRUCTION
    system = with_suggested_questions(DEFAULT_SYSTEM_PROMPT)
    assert system.startswith(DEFAULT_SYSTEM_PROMPT)
    assert system.endswith(SUGGESTED_QUESTIONS_INSTRUCTION)
    build_chat_prompt(system).format_messages(input="질문", history=[])


def test_fake_model_adds_questions_only_when_asked() -> None:
    model = build_fake_chat_model()
    question = HumanMessage(content="안녕")

    plain = model.invoke([SystemMessage(content=DEFAULT_SYSTEM_PROMPT), question])
    asked = model.invoke(
        [SystemMessage(content=with_suggested_questions(DEFAULT_SYSTEM_PROMPT)), question]
    )

    assert plain.content == DEFAULT_REPLY
    assert isinstance(asked.content, str) and OPEN_TAG in asked.content
    assert all(item in asked.content for item in FAKE_QUESTIONS)


@pytest.mark.asyncio
async def test_stream_reply_hides_the_tag_and_reports_questions() -> None:
    found: list[list[str]] = []

    text = "".join([chunk async for chunk in stream_reply("useEffect?", on_questions=found.append)])

    assert text.strip() == DEFAULT_REPLY
    assert found == [list(FAKE_QUESTIONS)]


@pytest.mark.asyncio
async def test_stream_reply_does_not_ask_for_questions_by_default() -> None:
    assert "".join([chunk async for chunk in stream_reply("안녕")]) == DEFAULT_REPLY
