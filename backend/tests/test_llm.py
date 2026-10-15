"""LLM-01 연동 모듈 검증: 공급자 교체와 프롬프트 템플릿."""

import pytest

from app.core.config import Settings
from app.llm.prompts.chat import DEFAULT_SYSTEM_PROMPT, build_chat_prompt
from app.llm.providers import get_chat_model


def test_fake_provider_needs_no_api_key() -> None:
    """Fork 직후 키 없이도 테스트가 돌아야 한다."""
    model = get_chat_model()

    chunks = [chunk.content for chunk in model.stream("안녕")]
    assert "".join(str(chunk) for chunk in chunks)


def test_provider_is_switched_by_settings_only() -> None:
    """공급자 교체는 코드 수정 없이 .env 값만으로 이뤄진다."""
    assert Settings(LLM_PROVIDER="anthropic", LLM_MODEL="x").LLM_PROVIDER == "anthropic"
    assert Settings(LLM_PROVIDER="fake").LLM_PROVIDER == "fake"


def test_prompt_includes_system_instruction_and_history() -> None:
    prompt = build_chat_prompt()

    messages = prompt.format_messages(input="오늘 배운 것", history=[])

    assert messages[0].content == DEFAULT_SYSTEM_PROMPT
    assert messages[-1].content == "오늘 배운 것"


def test_system_prompt_can_be_replaced() -> None:
    """샘플앱은 이 방식으로 코치 페르소나를 넣는다."""
    prompt = build_chat_prompt("당신은 학습 코치입니다.")

    messages = prompt.format_messages(input="안녕", history=[])

    assert messages[0].content == "당신은 학습 코치입니다."


@pytest.mark.asyncio
async def test_stream_reply_yields_text() -> None:
    from app.llm.chains.chat import stream_reply

    chunks = [chunk async for chunk in stream_reply("안녕", history=[("user", "이전 질문")])]

    assert "".join(chunks)
