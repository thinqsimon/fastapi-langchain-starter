"""대화 체인. 서비스 계층은 이 모듈만 호출하고 LangChain 세부는 모른다."""

import logging
from collections.abc import AsyncIterator, Callable, Sequence
from dataclasses import dataclass

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage

from app.core.exceptions import LLMError
from app.llm.prompts.chat import build_chat_prompt
from app.llm.providers import ProviderAttempt, get_chat_model

logger = logging.getLogger(__name__)

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
    providers: Sequence[ProviderAttempt] = (),
) -> AsyncIterator[str]:
    """응답을 토큰 단위로 흘려보낸다.

    사용량은 보통 마지막 청크에만 실려 오므로, 받는 즉시 `on_usage`로 알린다.
    공급자가 사용량을 주지 않으면 호출되지 않는다.

    providers: 관리자가 "서버 설정" 화면(ADMIN-01)에서 정한 우선순위. 비어 있으면 `.env` 설정
    하나만 쓴다(기존 동작과 같다). 앞쪽 공급자가 호출 중 오류(한도 초과 등)를 내면 다음 공급자로
    자동 전환한다. 단, 이미 한 글자라도 보낸 뒤에는 전환하지 않는다(응답이 섞이는 것을 막는다).
    """
    prompt = build_chat_prompt(system_prompt) if system_prompt else build_chat_prompt()
    attempts: Sequence[ProviderAttempt] = providers or (ProviderAttempt(),)

    last_error: Exception | None = None
    for index, attempt in enumerate(attempts):
        sent_any = False
        try:
            # 모델 생성도 여기서 한다. API 키 누락 같은 초기화 실패까지 LLMError로 묶기 위해서다.
            chat_model = (
                get_chat_model()
                if not attempt.provider
                else get_chat_model(
                    provider=attempt.provider, model=attempt.model, api_key=attempt.api_key
                )
            )
            chain = prompt | chat_model

            async for chunk in chain.astream(
                {"input": user_input, "history": _to_messages(history)}
            ):
                sent_any = True
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
            return
        except Exception as exc:  # 공급자별 예외가 제각각이라 한 곳에서 묶는다.
            last_error = exc
            if sent_any or index == len(attempts) - 1:
                raise LLMError("LLM 응답을 받지 못했습니다.") from exc
            logger.warning(
                "llm_provider_failed provider=%s index=%s error=%s",
                attempt.provider or "(설정 기본값)",
                index,
                exc,
            )
            continue

    # attempts가 비어 있을 일은 없지만(위에서 기본값 하나를 넣는다), 타입 체커를 위해 남긴다.
    raise LLMError("LLM 응답을 받지 못했습니다.") from last_error
