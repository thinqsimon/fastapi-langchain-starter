# 샘플앱: AI 배움일기 코치

서비스 발전 브랜치: `service/diary-coach`. 실행은 `diary-coach` 프로필을 사용합니다.
이 폴더는 실행 코드를 복제한 별도 앱이 아니라 변경 지점을 설명하는 문서입니다.
실제 API와 UI는 프로필 조립 지점으로 공통 스타터킷과 분리합니다.
[실행 프로필 가이드](../../docs/guides/application-profiles.md),
[ADR-0007](../../docs/decisions/ADR-0007-application-profiles.md).

스타터킷을 Fork해 새 서비스를 만드는 **실제 예시**. 교육생이 코치와 대화하며 오늘 배운 것을 정리하고,
**채팅을 골라** 그 대화로 배움일기 초안을 만들어 저장하며, 한 주를 회고합니다.

## 사용 흐름
1. 채팅에서 코치와 오늘 배운 것을 이야기한다
2. 채팅 상단의 **이 대화로 일기 만들기**를 누르면 현재 대화가 일기 초안이 되고 작성 화면이 열린다.
   자동 저장하지 않으며, 저장하지 않은 일기가 있으면 교체 여부를 확인한다.
   기존처럼 일기 화면에서 **일기로 만들 채팅**을 고르고 "초안 만들기"를 눌러도 된다
   - 제목: `오늘 날짜 + 핵심 단어`. 같은 날 두 번째 일기부터 `2026-10-20(2) …`처럼 순번이 붙는다
   - 배운 것(요약), **배운 내용 상세**(주제별 `### 소제목`, 복습용 보충 설명 포함), 어려웠던 것
   - 내일 할 것: 대화에 있을 때만 채워지고, 비워 두면 항목 없이 저장된다
3. 고쳐서 저장하면 설정의 **푸터**가 맨 끝에 붙는다(저장 시점 문구로 고정)
4. 이미 일기로 만든 채팅은 목록에서 사라지고, 그 채팅에 **대화가 추가되면** 다시 나타난다.
   다시 만드는 일기는 추가된 대화만 다룬다
5. **회고 기준 날짜**를 선택해 "회고 만들기"를 누르면 해당 주 회고가 생성·저장된다.
   **저장된 회고**에서 다시 열 수 있으며 한 주에 한 편을 보관한다. 저장 당시 내용을 유지하므로
   새로 정리하려면 회고를 삭제한 뒤 생성한다
6. 작성 화면 제목 옆과 지난 일기 카드마다 **프리뷰 보기**(문서 형태로 보는 창)와 **전체 복사**가 있다.
   복사하면 마크다운 글자와 서식이 함께 들어가, 교육 플랫폼·노션에는 서식으로, 메모장·카톡에는 마크다운으로 붙는다
7. **어려웠던 내용 복습**에서 학습 원문을 펼쳐 보고 메모를 저장한다. 완료한 항목은 별도로 모아 보며
   **다시 복습**으로 되돌릴 수 있다. 원문의 어려움 수정 시 완료만 해제하고 메모는 보존한다

우측 상단 계정 버튼을 누르면 오른쪽에서 메뉴가 열린다(계정 정보·사용량·설정·로그아웃).
설정에서 이름·이메일·비밀번호와 **캐치프레이즈**(헤더 가운데, 넘치면 전광판처럼 흐름)·푸터를 바꾼다.

## 스타터킷에서 그대로 쓴 것
인증(가입·로그인·토큰 재발급), 대화·메시지 저장, SSE 스트리밍, 공통 예외·로깅, CI/CD, E2E 기반.
즉 **새로 만든 것은 아래 표가 전부**입니다.

## 새로 만들거나 바꾼 것

| 변경 지점 | 위치 | 설명 |
|---|---|---|
| 구름 코치 화면 | `frontend/applications/diary-coach/chat-experience.tsx`, `frontend/public/coach/cloud-coach.png` | 제공된 구름 이미지, 추천 질문, 응답 아바타, 현재 채팅으로 일기 만들기. 프로필 조립 지점에서 주입 |
| 회고 보관·복습 | `frontend/components/diary/learning-workbench.tsx`, `frontend/store/learning.ts`, `frontend/api/learning.ts` | 주별 회고 생성·저장·조회·삭제, 원문 기반 메모·완료·재복습. 계정과 지연 응답 격리 |
| 회고·복습 데이터 | `backend/src/app/domain/diary/`, Alembic `e317b6a91d42` | 계정·주별 회고 snapshot, 일기별 진행 상태. 소유권 검사, 원문 삭제 FK cascade |
| 코치 페르소나·일기 프롬프트 | `backend/src/app/llm/prompts/diary_coach.py` | 새 대화/이전 대화(맥락) 구분, 상세 작성 규칙, '내일 할 것'을 지어내지 않는 규칙 |
| 구조화 출력 체인 | `backend/src/app/llm/chains/diary.py` | `with_structured_output`으로 일기 항목·회고 3항목을 받음. '내일 할 것'은 근거 문장이 대화에 있을 때만 남김 |
| `DiaryEntry` 모델 | `backend/src/app/domain/diary/models.py` | 채팅 단위(`source_last_message_at`), 같은 날 여러 편(`day_sequence`), 제목·상세·푸터 |
| 일기 서비스·API | `backend/src/app/domain/diary/` | 고를 수 있는 채팅 목록, 초안, 재발행 조건(409), 작성·수정·삭제, 주간 회고 |
| 개인 설정 도메인 | `backend/src/app/domain/preferences/` | 캐치프레이즈·일기 푸터. 저장 전에는 기본값 |
| 일기 화면 | `frontend/app/(main)/diary/`, `frontend/components/diary/` | 채팅 고르기, 초안·작성·수정(상세 미리보기), 지난 일기(마크다운), 주간 회고 |
| 일기 상태 | `frontend/store/diary.ts` | 초안 출처 보존, 미저장 입력·지연 응답·로그아웃 보호. 새로고침하면 미저장 초안은 사라짐 |
| 프리뷰·전체 복사 | `frontend/components/diary/diary-preview-actions.tsx`, `diary-document.tsx`, `diary-paste-document.tsx`, `frontend/lib/diary-markdown.ts` | 프리뷰는 문서 형태, 붙여 넣기용 HTML은 항목 제목 단계 통일·빈 줄 구분(플랫폼 편집기용) |
| 로고·이름 | `frontend/public/brand/logo.svg`, `frontend/components/brand-logo.tsx` | A안 '열정 노트'. 파비콘·홈 화면 아이콘은 `npm run icons`로 생성 |

설계 이유: [ADR-0006](../../docs/decisions/ADR-0006-diary-per-chat-and-preferences.md)

### 함께 개선한 스타터킷 공통 기능
샘플앱에만 쓰이는 것이 아니라 다른 서비스에도 그대로 쓸 수 있다.

| 기능 | 위치 |
|---|---|
| 계정 정보 수정 API(이름·이메일·비밀번호) | `backend/src/app/domain/auth/` — `PATCH /api/auth/me`, `PUT /api/auth/me/email`, `PUT /api/auth/me/password` |
| 계정 사이드 메뉴·설정 화면 | `frontend/components/account-menu.tsx`, `frontend/app/(main)/settings/` |
| 캐치프레이즈 전광판 | `frontend/components/catchphrase-marquee.tsx` |
| 마크다운 보기 | `frontend/components/markdown-view.tsx` |
| 반응형·모바일 | `frontend/store/layout.ts`(대화 목록 접기·서랍), `components/chat/message-input.tsx`(3줄 자동 높이), 아이폰 안전 영역 |
| 클립보드 복사(마크다운 + 서식) | `frontend/lib/clipboard.ts` |
| 아이콘 생성 스크립트 | `frontend/scripts/generate-icons.mjs` (`npm run icons`) |

## Fork 후 같은 방식으로 새 서비스를 만들려면
1. `/add-domain-model <이름>`으로 도메인 폴더와 모델을 만든다
2. `llm/prompts/<이름>.py`에 페르소나를 쓴다
3. 필요하면 `llm/chains/<이름>.py`에 구조화 출력을 정의한다
4. `frontend/app/(main)/<이름>/`에 화면을 추가한다
5. `./scripts/verify.sh`와 `./scripts/e2e.sh`로 확인한다

기획 상세: [docs/plans/04_샘플앱_배움일기코치_기획.md](../../docs/plans/04_샘플앱_배움일기코치_기획.md)
