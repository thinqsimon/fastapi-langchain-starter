# ADR-0018: 답변별 수준 표시·다른 수준으로 다시 묻기·추천 질문 (CHAT-04)

- 상태: 채택 (2026-11-02)
- 관련: `backend/src/app/llm/prompts/suggested_questions.py`, `backend/src/app/llm/chains/chat.py`(`QuestionSplitter`),
  `backend/src/app/domain/preferences/`(`answer_preferences`), `frontend/applications/diary-coach/answer-menu.tsx`

## 배경
답변 아래에는 답한 모델만 보였다. 사용자는 (1) 그 답변이 어느 수준으로 만들어졌는지 보고, (2) 방금 질문만 다른 수준으로
다시 받고, (3) 이어서 물어볼 질문을 추천받고 싶어 했다. 추천 질문을 만들면 답변이 늦어지므로 사용자가 켜고 끌 수 있어야 하고 기본은 꺼짐이다.

## 결정 (사용자 확인 2026-11-02)
- **배움일기 코치에만** 넣는다. 공용 `MessageList`는 답변 아래에 `answerFooter` 자리만 열어 두고, 조립 지점(`applications/components.tsx`)이
  코치 메뉴를 꽂는다. starter 화면에는 없다.
- 답변 아래 모델 표시 오른쪽에 `3단계 기초 …` 버튼. 누르면 한 메뉴에 위는 다른 수준 5개(이 답변의 수준은 ✓·'지금 답변'),
  아래는 '이어서 물어보기' 질문 3개.
- 다른 수준을 고르면 **같은 질문을 그 수준으로 한 번 더 보내** 대화 맨 아래에 새 답변이 붙는다. 저장된 답변 수준(`users.answer_level`)은 바꾸지 않는다.
- 추천 질문은 누르면 바로 보낸다.
- 설정 '추천 질문 함께 받기'를 답변 수준 카드 바로 아래에 둔다(기본 꺼짐, 서버에 저장해 PC·폰이 같다).

## 구현
- 추천 질문은 **답변과 같은 호출**에서 받는다. 시스템 지시 맨 끝에 `<follow_up_questions>` 태그 형식을 붙이고, 서버가 흘러오는 글에서
  태그부터는 화면으로 보내지 않고 모아 질문 목록으로 바꾼다(`QuestionSplitter`, 목록 표시·닫는 태그가 달라도 읽고 3개까지).
  태그가 두 조각에 걸쳐 올 수 있어, 태그의 앞부분일 수 있는 끝 글자는 다음 조각까지 잡아 둔다(화면에는 태그 길이 이내로 늦게 보인다).
  모델이 형식을 어기면 질문 없이 답변만 저장한다.
- 저장: `messages.answer_level SMALLINT NULL CHECK 1~5`(그 답변의 수준), `messages.suggested_questions JSON NULL`,
  `answer_preferences(user_id PK, suggest_questions BOOLEAN DEFAULT false)`. 예전 답변은 둘 다 NULL이라 버튼이 '답변 수준 …'으로 보인다.
- 켜기/끄기를 `user_preferences`와 **다른 표**로 둔 이유: 화면 문구의 '기본값으로'가 그 행을 지우므로, 같은 행이면 이 설정까지 꺼진다.
- 채팅 도메인은 코치 전용 설정을 모른다. `app.application`이 `suggest_questions_for(db, user_id)` 함수를 `app.state`로 넘기고
  (starter는 None), `ChatService`가 답변 전에 묻는다. 채팅 시스템 프롬프트를 넘기는 방식과 같다.
- 한 번만 다른 수준: 스트림 요청의 `answer_level`(선택). 라우터가 `payload.answer_level or effective_answer_level(...)`로 정한다.
- 다시 답변 지시(2026-11-02 추가): 운영 모델(gemini-3.5-flash-lite)은 대화에 같은 질문이 있는 것을 보고 "방금 전 질문과 같은 내용을 다시 물어보셨네요!"라고만 답했다. 요청에 `answer_level`이 실려 왔고 같은 질문이 대화 이력에 있으면 서비스가 `reanswer`로 알리고, 체인이 단계 지시 뒤에 `REANSWER_INSTRUCTION`(앞 답변을 가리키지 말고 그 수준으로 처음부터 다시 설명)을 붙인다. 새 질문에 수준만 실어 보내거나 같은 질문을 수준 없이 다시 보내면 붙이지 않는다.
- 테스트용 fake 모델은 시스템 지시에 태그 형식이 있으면 답변 끝에 질문 3개를 붙여, 실제 모델 없이 E2E로 확인한다.

## API
- `POST /api/conversations/{id}/stream` `{content, answer_level?: 1~5}`
- 메시지(`MessageRead`): `answer_level`, `suggested_questions`(없으면 `[]`)
- `GET /api/me/preferences` 응답에 `suggest_questions`, `PUT /api/me/preferences/suggest-questions` `{enabled}`

## 대안과 기각
- **답변 뒤에 따로 한 번 더 불러 질문 만들기**: 형식은 확실하지만 호출 비용이 늘고, 답변이 끝난 뒤 기다림이 따로 생긴다. 같은 호출이 싸고 빠르다.
- **원래 답변을 새 수준 답변으로 바꾸기 / 같은 자리에서 '◀ 1/2 ▶'로 넘겨 보기**: 사용자가 맨 아래에 새로 붙이는 방식을 골랐다(가장 단순하고 비교할 수 있다).
- **추천 질문을 답변 아래에 늘 보이기**: 사용자가 수준 버튼 메뉴 안을 골랐다.
- **켜기/끄기를 브라우저에만 저장**: PC와 폰에서 같게 쓰려고 서버에 저장한다.
