"""대화용 프롬프트 템플릿.

새 서비스를 만들 때 가장 먼저 바꾸는 파일이다. 페르소나와 규칙만 교체하면 성격이 달라진다.
(샘플앱 '배움일기 코치'는 prompts/diary_coach.py를 따로 둔다.)
"""

from langchain_core.prompts import ChatPromptTemplate

DEFAULT_SYSTEM_PROMPT = (
    "당신은 한국어로 답하는 친절한 AI 어시스턴트입니다. "
    "모르는 것은 모른다고 말하고, 추측할 때는 추측임을 밝힙니다. "
    "답변은 간결하게 하되 필요한 근거는 빠뜨리지 않습니다."
)


def build_chat_prompt(system_prompt: str = DEFAULT_SYSTEM_PROMPT) -> ChatPromptTemplate:
    """시스템 지시 + 지금까지의 대화 + 이번 입력으로 구성한다."""
    return ChatPromptTemplate.from_messages(
        [
            ("system", system_prompt),
            ("placeholder", "{history}"),
            ("human", "{input}"),
        ]
    )
