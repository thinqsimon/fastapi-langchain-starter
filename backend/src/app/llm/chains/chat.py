"""대화 체인. 서비스 계층은 이 모듈만 호출하고 LangChain 세부는 모른다."""

from collections.abc import AsyncIterator, Callable, Sequence
from dataclasses import dataclass

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage

from app.core.exceptions import LLMError
from app.llm.prompts.chat import build_chat_prompt
from app.llm.providers import get_chat_model

# (role, content) 형태의 대화 이력
HistoryItem = tuple[str, str]


@dataclass(frozen=True)
class TokenUsage:
    input_tokens: int
    output_tokens: int


def _to_messages(history: Sequence[HistoryItem]) -> list[BaseMessage]:
    messages: list[BaseMessage] = []
    for role, content in history:
        if role == "assistant":
            messages.append(AIMessage(content=content))
        else:
            messages.append(HumanMessage(content=content))
    return messages


async def stream_reply(
    user_input: str,
    history: Sequence[HistoryItem] = (),
    system_prompt: str | None = None,
    on_usage: Callable[[TokenUsage], None] | None = None,
) -> AsyncIterator[str]:
    """응답을 토큰 단위로 흘려보낸다.

    사용량은 보통 마지막 청크에만 실려 오므로, 받는 즉시 `on_usage`로 알린다.
    공급자가 사용량을 주지 않으면 호출되지 않는다.
    """
    prompt = build_chat_prompt(system_prompt) if system_prompt else build_chat_prompt()

    try:
        # 모델 생성도 여기서 한다. API 키 누락 같은 초기화 실패까지 LLMError로 묶기 위해서다.
        chain = prompt | get_chat_model()

        async for chunk in chain.astream({"input": user_input, "history": _to_messages(history)}):
            usage = getattr(chunk, "usage_metadata", None)
            if usage and on_usage:
                on_usage(
                    TokenUsage(
                        input_tokens=int(usage.get("input_tokens", 0)),
                        output_tokens=int(usage.get("output_tokens", 0)),
                    )
                )

            text = chunk.content
            if text:
                yield text if isinstance(text, str) else str(text)
    except Exception as exc:  # 공급자별 예외가 제각각이라 한 곳에서 묶는다.
        raise LLMError("LLM 응답을 받지 못했습니다.") from exc
