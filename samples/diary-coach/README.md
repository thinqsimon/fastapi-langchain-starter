# 샘플앱: AI 배움일기 코치

스타터킷을 Fork해 새 서비스를 만드는 **실제 예시**. 교육생이 코치와 대화하며 오늘 배운 것을 정리하고,
대화에서 배움일기 초안을 만들어 저장하며, 한 주를 회고합니다.

## 스타터킷에서 그대로 쓴 것
인증(가입·로그인·토큰 재발급), 대화·메시지 저장, SSE 스트리밍, 공통 예외·로깅, CI/CD, E2E 기반.
즉 **새로 만든 것은 아래 표가 전부**입니다.

## 새로 만들거나 바꾼 것

| 변경 지점 | 위치 | 설명 |
|---|---|---|
| 코치 페르소나·일기 프롬프트 | `backend/src/app/llm/prompts/diary_coach.py` | 기본 챗봇 프롬프트(`prompts/chat.py`)와 같은 구조, 내용만 교체 |
| 구조화 출력 체인 | `backend/src/app/llm/chains/diary.py` | `with_structured_output`으로 일기 3항목·회고 3항목을 받음 |
| `DiaryEntry` 모델 | `backend/src/app/domain/diary/models.py` | 사용자·날짜 유니크(하루 한 편), 대화 삭제 시 일기는 보존 |
| 일기 서비스·API | `backend/src/app/domain/diary/` | 초안 생성, 작성·수정·삭제, 주간 회고 |
| 일기 화면 | `frontend/app/(main)/diary/`, `frontend/components/diary/` | 작성·수정, 지난 일기, 주간 회고 |
| 일기 상태 | `frontend/store/diary.ts` | 채팅 스토어와 같은 구조 |

## Fork 후 같은 방식으로 새 서비스를 만들려면
1. `/add-domain-model <이름>`으로 도메인 폴더와 모델을 만든다
2. `llm/prompts/<이름>.py`에 페르소나를 쓴다
3. 필요하면 `llm/chains/<이름>.py`에 구조화 출력을 정의한다
4. `frontend/app/(main)/<이름>/`에 화면을 추가한다
5. `./scripts/verify.sh`와 `./scripts/e2e.sh`로 확인한다

기획 상세: [docs/plans/04_샘플앱_배움일기코치_기획.md](../../docs/plans/04_샘플앱_배움일기코치_기획.md)
