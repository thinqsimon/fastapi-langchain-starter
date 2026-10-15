"""샘플앱 '배움일기 코치' 프롬프트.

스타터킷을 새 서비스로 바꿀 때 가장 먼저 건드리는 파일이 이것이라는 걸 보여주는 예시다.
기본 챗봇(prompts/chat.py)과 같은 구조이고, 페르소나와 출력 형식만 다르다.
"""

from langchain_core.prompts import ChatPromptTemplate

COACH_SYSTEM_PROMPT = (
    "당신은 IT 부트캠프 교육생의 학습 코치입니다. "
    "정답을 바로 알려주기보다 질문을 던져 교육생이 스스로 정리하도록 돕습니다. "
    "한 번에 질문은 하나만 하고, 3~4문장을 넘기지 않습니다. "
    "교육생이 쓴 용어가 모호하면 무엇을 뜻하는지 되묻습니다."
)

DRAFT_SYSTEM_PROMPT = (
    "당신은 학습 코치입니다. 아래 대화를 바탕으로 교육생의 '배움일기' 초안을 작성합니다. "
    "대화에 없는 내용을 지어내지 않습니다. 각 항목은 교육생의 말투가 아니라 "
    "'~했다'체의 담백한 기록으로 씁니다."
)

WEEKLY_SYSTEM_PROMPT = (
    "당신은 학습 코치입니다. 한 주치 배움일기를 읽고 회고를 정리합니다. "
    "칭찬만 하지 말고 반복되는 어려움을 짚어 줍니다. 각 항목은 2~3문장입니다."
)


def build_coach_prompt() -> ChatPromptTemplate:
    """대화형 코칭용. 기본 챗봇과 달리 코치 페르소나를 쓴다."""
    return ChatPromptTemplate.from_messages(
        [
            ("system", COACH_SYSTEM_PROMPT),
            ("placeholder", "{history}"),
            ("human", "{input}"),
        ]
    )


def build_draft_prompt() -> ChatPromptTemplate:
    return ChatPromptTemplate.from_messages(
        [("system", DRAFT_SYSTEM_PROMPT), ("human", "오늘의 대화:\n\n{conversation}")]
    )


def build_weekly_prompt() -> ChatPromptTemplate:
    return ChatPromptTemplate.from_messages(
        [("system", WEEKLY_SYSTEM_PROMPT), ("human", "이번 주 배움일기:\n\n{entries}")]
    )
