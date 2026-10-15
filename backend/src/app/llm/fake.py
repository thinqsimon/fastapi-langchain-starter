"""테스트·CI용 가짜 LLM. API 키 없이 스트리밍과 구조화 출력을 흉내 낸다.

실제 모델을 부르지 않으므로 결과가 항상 같고 비용도 들지 않는다.
`LLM_PROVIDER=fake`로 켠다.
"""

from collections.abc import Iterator
from typing import Any

from langchain_core.language_models import BaseChatModel
from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage
from langchain_core.runnables import Runnable, RunnableLambda
from pydantic import BaseModel

DEFAULT_REPLY = "안녕하세요! 테스트 응답입니다."


class FakeChatModel(GenericFakeChatModel):
    """스트리밍은 물론 `with_structured_output`도 지원하는 테스트 더미."""

    def with_structured_output(self, schema: Any, **kwargs: Any) -> Runnable[Any, Any]:  # noqa: ANN401
        """스키마의 모든 문자열 필드를 채운 인스턴스를 돌려준다.

        실제 모델처럼 내용을 생성하지는 않지만, 호출 쪽의 형식 처리와 저장 경로를 검증할 수 있다.
        """

        def build(_: Any) -> Any:  # noqa: ANN401
            if isinstance(schema, type) and issubclass(schema, BaseModel):
                return schema(**{name: f"테스트 {name}" for name in schema.model_fields})
            return {}

        return RunnableLambda(build)


def build_fake_chat_model(reply: str = DEFAULT_REPLY) -> BaseChatModel:
    def replies() -> Iterator[AIMessage]:
        while True:
            yield AIMessage(content=reply)

    return FakeChatModel(messages=replies())
