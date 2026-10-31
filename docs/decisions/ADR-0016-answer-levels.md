# ADR-0016: 답변 수준 5단계 (CHAT-03)

- 상태: 채택 (2026-10-31)
- 관련: `backend/src/app/core/answer_levels.py`, `backend/src/app/llm/prompts/answer_level.py`, `backend/src/app/domain/answer_level/`, `frontend/components/settings/answer-level-card.tsx`

## 배경
AX 풀스택 입과자(성인)는 배경이 제각각이다. 같은 질문에도 비전공자는 쉬운 말과 비유가, 전공자는 정확한 용어와 깊이가 필요하다.
사용자가 수준을 고르면 채팅 답변의 어휘와 이해 수준이 그에 맞게 바뀌어야 한다.

## 결정 (사용자 확인 2026-10-31)
| 단계 | 기본 이름 | 대상 | 답변 방식 |
|---|---|---|---|
| 1 | 왕초보 | 컴퓨터·IT 용어가 낯선 분 | 중학생도 아는 쉬운 말, 일상 비유 먼저, 용어는 바로 풀이, 코드는 최소로 |
| 2 | 입문 | 비전공으로 막 입과한 분 | 핵심 용어 소개와 한 줄 풀이, 비유 다음 짧은 코드와 주석, 흔한 실수 |
| 3 | 기초 | 변수·함수·조건문을 익힌 분 | 아는 용어는 그대로, 새 개념만 풀이, 단계별 예제와 이유 |
| 4 | 실전 | 웹 프로젝트를 만드는 분 | 동작 원리·설계 이유·장단점, 실무형 코드와 디버깅 방법 |
| 5 | 심화 | 전공자·실무 경험자 | 기초 생략, 정확한 용어로 간결하게, 내부 동작·트레이드오프·공식 문서 |

- 어느 단계든 성인 대상 존댓말. 대화 중 "더 쉽게/더 깊게"처럼 직접 요청하면 그 요청이 먼저다.
- **기본값**: 아직 고르지 않은 사용자(`users.answer_level` NULL)는 2단계로 답하고, 첫 채팅 화면에 "어떤 수준으로 설명해 드릴까요?"를 보여 준다.
  "나중에"는 그 화면에서만 숨기고, 고를 때까지 다음 방문에 다시 묻는다.
- **적용 범위**: 채팅 답변, 일기 초안, 주간 회고. 일기·회고는 정해진 형식과 분량이 먼저이고 어휘·용어 풀이·설명 깊이만 단계에 맞춘다
  (`with_answer_level(..., for_writing=True)`). 5단계의 "간결하게"가 일기의 "자세히"를 덮지 않게 하려는 것이다.
- **바꾸는 곳**: 설정 화면 "계정 정보" 바로 아래 "답변 수준" 카드(단계 설명과 'API' 설명 예시), 채팅 입력칸 + 메뉴의 "답변 수준" 묶음.
- **단계 이름은 관리자가 바꾼다**(`/admin` → 답변 수준 이름). 화면에 보이는 이름만 바뀌고, 모델 지시는 단계 번호로 정해져 그대로다.

## 구현
- 저장: `users.answer_level SMALLINT NULL CHECK 1~5`, `answer_level_names(level PK CHECK 1~5, name)` — 바꾼 이름만 저장, 기본 이름과 같으면 지운다.
- 단계 번호·대상·방식·예시는 코드(`core/answer_levels.py`)가 단일 출처이고 `GET /api/answer-levels`로 화면에 내려준다.
- 프롬프트: 페르소나 시스템 프롬프트 뒤에 `[답변 수준]` 지시를 붙인다. ChatPromptTemplate가 중괄호를 변수로 읽으므로 지시문에 중괄호를 쓰지 않는다(테스트).
- 라우터가 `effective_answer_level(current_user.answer_level)`을 서비스에 넘긴다(NULL·알 수 없는 값 → 2).
- 관리자 "이 계정으로 테스트" 중에는 `PUT /api/auth/me/answer-level`이 `/api/auth/*` 쓰기라 막힌다(사용자의 설정을 바꾸지 않게).

## API
- `GET /api/answer-levels` → `[{level, name, default_name, audience, style, example}]`
- `PUT /api/auth/me/answer-level` `{answer_level: 1~5}` → UserRead(`answer_level` 포함)
- `PATCH /api/admin/answer-levels/{level}` `{name}`(1~20자), `DELETE /api/admin/answer-levels/{level}/name`(기본 이름으로)

## 대안과 기각
- **4단계(0 중학생 ~ 3 고급)**: 사용자가 5단계와 직관적인 이름을 요청했다.
- **지시문까지 관리자 편집**: 프롬프트가 깨질 위험(중괄호 등)과 품질 관리 부담이 크다. 필요해지면 검증과 함께 추가한다.
