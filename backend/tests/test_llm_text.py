"""공급자마다 다른 응답 content(문자열/블록 리스트)를 한 가지 글자 흐름으로 바꾼다(LLM-02)."""

from collections.abc import AsyncIterator
from typing import Any

import pytest
from langchain_core.messages import AIMessageChunk
from langchain_core.runnables import Runnable

from app.llm.chains import chat
from app.llm.chains.chat import ModelInfo, text_of
from app.llm.fake import build_fake_chat_model
from app.llm.providers import ProviderAttempt


def test_plain_string_passes_through() -> None:
    assert text_of("안녕하세요") == "안녕하세요"


def test_gemini_style_blocks_keep_only_text() -> None:
    """Gemini는 텍스트 블록과 서명 블록을 섞어 준다. 서명은 화면에 보이면 안 된다."""
    content = [
        {"type": "text", "text": "안녕하세요! ", "index": 0},
        {"type": "text", "text": "오늘도 화이팅", "index": 0},
        {"type": "text", "text": "", "extras": {"signature": "EsUXCsIXAWkU..."}},
    ]
    assert text_of(content) == "안녕하세요! 오늘도 화이팅"


def test_claude_style_thinking_blocks_are_dropped() -> None:
    content = [
        {"type": "thinking", "thinking": "사용자는 개념 설명을 원한다", "signature": "x"},
        {"type": "text", "text": "변수는 값을 담는 상자예요."},
        {"type": "tool_use", "id": "t1", "name": "search", "input": {}},
    ]
    assert text_of(content) == "변수는 값을 담는 상자예요."


def test_mixed_and_unknown_content() -> None:
    assert text_of(["앞", {"type": "text", "text": "뒤"}]) == "앞뒤"
    assert text_of(None) == ""
    assert text_of({"type": "text", "text": "dict 하나"}) == ""


class _BlockModel(Runnable[Any, AIMessageChunk]):
    """Gemini처럼 블록 리스트를 흘리는 가짜 모델. `prompt | model` 체인의 오른쪽에 들어간다."""

    def invoke(self, input: Any, config: Any = None, **kwargs: Any) -> AIMessageChunk:  # noqa: ANN401
        return AIMessageChunk(content="")

    async def astream(  # type: ignore[override]
        self, input: Any, config: Any = None, **kwargs: Any
    ) -> AsyncIterator[AIMessageChunk]:
        yield AIMessageChunk(content=[{"type": "text", "text": "안녕", "index": 0}])
        yield AIMessageChunk(content=[{"type": "text", "text": "", "extras": {"signature": "s"}}])
        yield AIMessageChunk(content=[{"type": "text", "text": "하세요"}])


@pytest.mark.asyncio
async def test_stream_reply_joins_text_blocks_and_reports_model(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(chat, "get_chat_model", lambda **_kwargs: _BlockModel())
    seen: list[ModelInfo] = []

    chunks = [
        c
        async for c in chat.stream_reply(
            "안녕",
            providers=(ProviderAttempt(provider="google_genai", model="gemini-2.5-flash"),),
            on_model=seen.append,
        )
    ]

    assert "".join(chunks) == "안녕하세요"
    assert "signature" not in "".join(chunks)
    assert seen == [ModelInfo(provider="google_genai", model="gemini-2.5-flash")]


@pytest.mark.asyncio
async def test_default_attempt_reports_env_model(monkeypatch: pytest.MonkeyPatch) -> None:
    """관리자 설정이 없으면 .env의 공급자·모델이 기록된다."""
    monkeypatch.setattr(chat, "get_chat_model", lambda **_kwargs: build_fake_chat_model())
    seen: list[ModelInfo] = []

    async for _ in chat.stream_reply("안녕", on_model=seen.append):
        pass

    assert len(seen) == 1
    assert seen[0].provider == chat.settings.LLM_PROVIDER
    assert seen[0].model == chat.settings.LLM_MODEL
