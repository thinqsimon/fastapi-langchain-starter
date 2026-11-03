"""대화 체인. 서비스 계층은 이 모듈만 호출하고 LangChain 세부는 모른다."""

import logging
import re
from collections.abc import AsyncIterator, Callable, Sequence
from dataclasses import dataclass

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage

from app.core.config import settings
from app.core.exceptions import LLMError
from app.llm.prompts.answer_level import with_answer_level, with_reanswer
from app.llm.prompts.chat import DEFAULT_SYSTEM_PROMPT, build_chat_prompt
from app.llm.prompts.suggested_questions import (
    CLOSE_TAG,
    OPEN_TAG,
    QUESTION_COUNT,
    with_suggested_questions,
)
from app.llm.providers import ProviderAttempt, get_chat_model, is_account_exhausted

logger = logging.getLogger(__name__)

# (role, content) 형태의 대화 이력
HistoryItem = tuple[str, str]


@dataclass(frozen=True)
class TokenUsage:
    input_tokens: int
    output_tokens: int


@dataclass(frozen=True)
class ModelInfo:
    """실제로 답한 공급자와 모델. 우선순위 전환이 일어나면 뒤쪽 공급자가 된다."""

    provider: str
    model: str


def text_of(content: object) -> str:
    """공급자마다 다른 응답 content에서 글자만 꺼낸다.

    OpenAI는 문자열을 주지만 Gemini·Claude는 블록 리스트를 준다
    (예: ``[{"type": "text", "text": "안녕"}, {"type": "thinking", ...}]``).
    텍스트 블록만 이어 붙이고 서명·생각·도구 호출 블록은 버린다. 이걸 거치지 않으면
    리스트가 ``str()``로 그대로 화면에 찍힌다(실제로 Gemini에서 겪은 문제).
    """
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict) and block.get("type") == "text":
                parts.append(str(block.get("text", "")))
        return "".join(parts)
    return ""


# 추천 질문 하나의 최대 길이. 형식을 어긴 긴 문단이 질문으로 저장되는 것을 막는다.
QUESTION_MAX_LENGTH = 200
_LIST_MARK = re.compile(r"^\s*(?:[-*•]|\d+[.)])\s*")


def parse_questions(text: str) -> list[str]:
    """태그 안의 목록을 질문 문장으로 바꾼다(CHAT-04).

    '- '·'1. '·'* ' 어떤 목록 표시든 떼고, 닫는 태그가 없어도 끝까지 읽는다. 많으면 앞의 3개만 쓴다.
    """
    body = text.split(CLOSE_TAG, 1)[0]
    questions: list[str] = []
    for line in body.splitlines():
        question = _LIST_MARK.sub("", line).strip().strip("*").strip()
        if question:
            questions.append(question[:QUESTION_MAX_LENGTH])
    return questions[:QUESTION_COUNT]


class QuestionSplitter:
    """흘러오는 답변에서 추천 질문 태그 앞까지만 내보내고, 태그부터는 모아 둔다(CHAT-04).

    태그가 두 조각에 걸쳐 올 수 있어("<follow_" + "up_questions>"), 태그의 앞부분일 수 있는
    끝 글자는 다음 조각을 볼 때까지 잡아 둔다. 그만큼(태그 길이 이내) 화면에 늦게 보인다.
    """

    def __init__(self) -> None:
        self._held = ""
        # 태그 뒤에 온 글. 태그를 만나기 전에는 None이다.
        self._questions_text: list[str] | None = None

    def feed(self, text: str) -> str:
        """이번 조각에서 화면에 내보낼 글을 돌려준다."""
        if self._questions_text is not None:
            self._questions_text.append(text)
            return ""
        held = self._held + text
        index = held.find(OPEN_TAG)
        if index >= 0:
            self._questions_text = [held[index + len(OPEN_TAG) :]]
            self._held = ""
            return held[:index]
        keep = _partial_tag_length(held)
        self._held = held[len(held) - keep :]
        return held[: len(held) - keep]

    def finish(self) -> tuple[str, list[str]]:
        """잡아 둔 나머지 글과 추천 질문을 돌려준다. 태그가 없었으면 질문은 빈 목록이다."""
        rest, self._held = self._held, ""
        if self._questions_text is None:
            return rest, []
        return rest, parse_questions("".join(self._questions_text))


def _partial_tag_length(text: str) -> int:
    """text의 끝이 태그의 앞부분과 겹치는 길이."""
    for length in range(min(len(OPEN_TAG) - 1, len(text)), 0, -1):
        if OPEN_TAG.startswith(text[-length:]):
            return length
    return 0


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
    on_model: Callable[[ModelInfo], None] | None = None,
    answer_level: int | None = None,
    on_questions: Callable[[list[str]], None] | None = None,
    reanswer: bool = False,
) -> AsyncIterator[str]:
    """응답을 토큰 단위로 흘려보낸다.

    사용량은 보통 마지막 청크에만 실려 오므로, 받는 즉시 `on_usage`로 알린다.
    공급자가 사용량을 주지 않으면 호출되지 않는다. `on_model`은 첫 청크가 올 때
    실제로 답한 공급자·모델을 알린다(메시지에 함께 저장해 표기·비용 계산에 쓴다).

    providers: 관리자가 "서버 설정" 화면(ADMIN-01)에서 정한 우선순위. 비어 있으면 `.env` 설정
    하나만 쓴다(기존 동작과 같다). 앞쪽 공급자가 호출 중 오류(한도 초과 등)를 내면 다음 공급자로
    자동 전환한다. 크레딧·지출 한도가 다 된 오류면 그 공급자의 남은 라우트는 건너뛴다.
    단, 이미 한 글자라도 보낸 뒤에는 전환하지 않는다(응답이 섞이는 것을 막는다).

    on_questions: 주면 답변 끝에 추천 질문 3개를 함께 요청한다(CHAT-04). 질문 부분은
    흘려보내지 않고, 답변이 끝나면 질문 목록으로 알린다(모델이 형식을 어겼으면 빈 목록).
    reanswer: 이미 한 질문을 다른 수준으로 다시 묻는 경우(CHAT-04). 앞 답변을 가리키지 말고
    처음부터 다시 설명하라는 지시를 붙인다.
    """
    # answer_level: 사용자가 고른 답변 수준(CHAT-03). None이면 페르소나 그대로 쓴다.
    system = with_answer_level(system_prompt or DEFAULT_SYSTEM_PROMPT, answer_level)
    if reanswer:
        system = with_reanswer(system)
    prompt = build_chat_prompt(with_suggested_questions(system) if on_questions else system)
    attempts: Sequence[ProviderAttempt] = providers or (ProviderAttempt(),)

    last_error: Exception | None = None
    exhausted: set[str] = set()
    for index, attempt in enumerate(attempts):
        if attempt.provider in exhausted:
            continue
        sent_any = False
        splitter = QuestionSplitter() if on_questions else None
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
                if not sent_any and on_model:
                    on_model(
                        ModelInfo(
                            provider=attempt.provider or settings.LLM_PROVIDER,
                            model=attempt.model or settings.LLM_MODEL,
                        )
                    )
                sent_any = True
                usage = getattr(chunk, "usage_metadata", None)
                if usage and on_usage:
                    on_usage(
                        TokenUsage(
                            input_tokens=int(usage.get("input_tokens", 0)),
                            output_tokens=int(usage.get("output_tokens", 0)),
                        )
                    )

                text = text_of(chunk.content)
                if splitter:
                    text = splitter.feed(text)
                if text:
                    yield text
            if splitter and on_questions:
                rest, questions = splitter.finish()
                if rest:
                    yield rest
                on_questions(questions)
            return
        except Exception as exc:  # 공급자별 예외가 제각각이라 한 곳에서 묶는다.
            last_error = exc
            logger.warning(
                "llm_provider_failed provider=%s index=%s error=%s",
                attempt.provider or "(설정 기본값)",
                index,
                exc,
            )
            if is_account_exhausted(exc):
                exhausted.add(attempt.provider)
            if sent_any or index == len(attempts) - 1:
                raise LLMError("LLM 응답을 받지 못했습니다.") from exc
            continue

    # 남은 라우트를 모두 건너뛰면 여기로 온다.
    raise LLMError("LLM 응답을 받지 못했습니다.") from last_error
