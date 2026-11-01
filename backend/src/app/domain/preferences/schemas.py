"""preferences 도메인 - 요청/응답 스키마."""

from pydantic import BaseModel, Field


class PreferencesRead(BaseModel):
    catchphrase: str
    diary_footer: str
    # 채팅 답변에 추천 질문 3개를 함께 받는지(CHAT-04). 문구의 '기본값으로'와 상관없다.
    suggest_questions: bool = False


class PreferencesUpdate(BaseModel):
    # 빈 값도 허용한다. 사용자가 일부러 비울 수 있어야 한다.
    catchphrase: str = Field(max_length=300)
    diary_footer: str = Field(max_length=300)


class SuggestQuestionsUpdate(BaseModel):
    enabled: bool
