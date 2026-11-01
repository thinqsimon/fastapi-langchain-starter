"""추천 질문(CHAT-04). 답변과 같은 호출에서 '이어서 물어볼 질문'을 함께 받는다.

답변 맨 끝에 정해진 태그로 감싸 받으면, 서버가 그 부분을 화면으로 흘리지 않고 떼어 내 저장한다
(떼어 내는 일은 llm/chains/chat.py의 QuestionSplitter). 따로 한 번 더 부르는 것보다 빠르고 싸지만,
모델이 형식을 지키지 않으면 질문 없이 답변만 남는다.
ChatPromptTemplate가 중괄호를 변수로 읽으므로 지시문에는 중괄호를 쓰지 않는다(테스트가 확인한다).
"""

OPEN_TAG = "<follow_up_questions>"
CLOSE_TAG = "</follow_up_questions>"
QUESTION_COUNT = 3

SUGGESTED_QUESTIONS_INSTRUCTION = (
    "답변을 모두 마친 뒤 맨 끝에, 학습자가 이 답변을 읽고 이어서 물어볼 만한 "
    f"질문 {QUESTION_COUNT}개를 아래 형식 그대로 덧붙이세요.\n"
    f"{OPEN_TAG}\n- 질문\n- 질문\n- 질문\n{CLOSE_TAG}\n"
    "- 질문은 학습자가 직접 묻는 말투의 한 문장으로, 40자 안팎으로 짧게 씁니다.\n"
    "- 본문에서는 이 목록을 언급하거나 소개하지 마세요."
)


def with_suggested_questions(system_prompt: str) -> str:
    """시스템 지시 맨 뒤에 추천 질문 형식을 붙인다."""
    return f"{system_prompt}\n\n{SUGGESTED_QUESTIONS_INSTRUCTION}"
