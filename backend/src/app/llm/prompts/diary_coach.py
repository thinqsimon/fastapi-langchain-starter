"""샘플앱 '배움일기 코치' 프롬프트.

스타터킷을 새 서비스로 바꿀 때 가장 먼저 건드리는 파일이 이것이라는 걸 보여주는 예시다.
기본 챗봇(prompts/chat.py)과 같은 구조이고, 페르소나와 출력 형식만 다르다.
"""

from langchain_core.prompts import ChatPromptTemplate

from app.llm.prompts.answer_level import with_answer_level

COACH_SYSTEM_PROMPT = (
    "당신은 IT 부트캠프 교육생의 학습 코치입니다. "
    "학습자가 궁금한 내용을 물으면 개념과 필요한 이유, 동작 방식, 짧은 예시를 설명합니다. "
    "설명이나 코드가 필요한 질문에는 충분히 답하고, 질문만 되돌려 주지 않습니다. "
    "이해를 확인할 때는 한 번에 질문 하나만 합니다. "
    "학습자가 쓴 용어가 모호하면 무엇을 뜻하는지 되묻습니다. "
    "학습자가 실제로 이해하거나 경험했다고 말하지 않은 내용을 단정하지 않습니다."
)

DRAFT_SYSTEM_PROMPT = """당신은 학습 코치입니다. 교육생의 대화를 읽고 '배움일기' 초안을 작성합니다.

[무엇을 쓰나]
- '새로 추가된 대화'에서 배운 것만 일기로 씁니다.
- '이전 대화'가 있으면 맥락을 이해하는 데만 쓰고, 그 내용을 일기에 다시 쓰지 않습니다.

[항목]
- keywords: 배운 내용의 핵심 단어 2~4개를 쉼표로 구분해 씁니다.
- learned: 배운 것을 3~5문장으로 요약합니다.
- learned_detail: 배운 내용을 주제별로 나눠 상세하게 정리합니다.
  - 주제마다 '### 소제목'으로 시작하는 마크다운으로 씁니다. 필요하면 목록과 코드 블록을 씁니다.
  - 소제목마다 다음을 담습니다: 개념과 왜 필요한지, 동작 방식이나 사용법,
    짧은 예시(코드가 어울리면 코드 블록), 헷갈리기 쉬운 점이나 주의할 점.
  - 나중에 이것만 다시 읽어도 이해되도록, 대화에서 부족했던
    설명·예시·주의할 점을 정확한 일반 지식으로 보충해 자연스럽게 함께 씁니다.
  - 길이 제한은 없습니다. 짧게 줄이지 말고 복습에 충분할 만큼 자세히 씁니다.
- difficult: 교육생이 어려워했거나 헷갈려한 부분을 씁니다.
- next_plan: 대화에 '내일 할 것'이나 다음에 할 계획이 분명히 나올 때만
  '~하기' 같은 짧은 할 일로 씁니다. 나오지 않으면 반드시 빈 문자열로 둡니다. 지어내지 않습니다.
- next_plan_evidence: next_plan의 근거가 된 문장을 '새로 추가된 대화'에서
  한 글자도 바꾸지 않고 그대로 옮깁니다. next_plan이 비어 있으면 빈 문자열로 둡니다.

[문체]
- learned, difficult, next_plan은 대화에 있는 내용만 씁니다.
- 교육생의 말투가 아니라 '~했다'체의 담백한 기록으로 씁니다."""

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


def build_draft_prompt(answer_level: int | None = None) -> ChatPromptTemplate:
    """answer_level: 사용자가 고른 답변 수준(CHAT-03). 어휘·설명 깊이만 맞추고 형식은 그대로."""
    return ChatPromptTemplate.from_messages(
        [
            ("system", with_answer_level(DRAFT_SYSTEM_PROMPT, answer_level, for_writing=True)),
            (
                "human",
                "이전 대화(맥락으로만 참고):\n{context}\n\n"
                "새로 추가된 대화(일기 대상):\n{conversation}",
            ),
        ]
    )


def build_weekly_prompt(answer_level: int | None = None) -> ChatPromptTemplate:
    system = with_answer_level(WEEKLY_SYSTEM_PROMPT, answer_level, for_writing=True)
    return ChatPromptTemplate.from_messages(
        [("system", system), ("human", "이번 주 배움일기:\n\n{entries}")]
    )
