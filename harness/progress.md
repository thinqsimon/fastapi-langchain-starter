# Progress Log

세션 인수인계 기록. 새 세션은 맨 아래 항목부터 읽는다. 막힌 문제는 `문제/원인/해결/재발방지`로 남긴다
(→ `docs/guides/troubleshooting.md`의 원천 데이터).

---

## 2026-10-15 · 세션 1 · 저장소 구조 리팩토링 (하네스 스캐폴드)

**한 일**
- 2nd_Sample을 모노레포 루트로 전환, git init. 요구사항 문서를 `docs/requirements/`로 이동
- backend: uv + FastAPI 뼈대(`core/` 설정·DB·예외·로깅, `domain/{auth,chat,usage}` 계층 스텁, `llm/` 공급자 팩토리 + fake LLM), Alembic 초기화, import-linter 계층 계약, 테스트 3개
- frontend: Next 16 + shadcn + zustand + axios, `api/client.ts`, 로그인/회원가입/채팅 페이지 자리
- 하네스: CLAUDE.md, feature_list.json, scripts(init/verify/fork-verify), Makefile, `.claude/`(hooks·agents·skills), CI 워크플로
- `./scripts/verify.sh` 통과 → SETUP-02, SETUP-03 passes=true

**막힌 점**
- 문제: frontend `tsc --noEmit`에서 `LayoutProps`를 찾지 못함
  - 원인: Next 16의 전역 라우트 타입은 `next typegen`(또는 build)으로 생성된다
  - 해결: `typecheck` 스크립트를 `next typegen && tsc --noEmit`으로 변경
  - 재발방지: verify.sh가 같은 스크립트를 사용
- 이 Mac에 Docker가 없어 DB 마이그레이션은 아직 검증하지 못함

**다음 할 일**
- [TBD] 강의 제공 LLM API 종류·키, 배포 대상, 팀 구성
- 다음 기능: SETUP-01(설계 문서 확정) → BE-01 → DB-01 → AUTH-01

---

## 2026-10-15 · 세션 2 · 로컬 DB 환경 구성

**한 일**
- Docker Desktop 4.95.0 설치 (공식 arm64 DMG, Homebrew 없음), engine/CLI 29.8.2, Compose v5.6.0
- `~/.zprofile`에 Docker CLI 경로 추가 (`/Applications/Docker.app/Contents/Resources/bin`)
- `.env.example` → `.env` 생성, `docker compose up -d db` (pgvector/pgvector:pg17, healthy), `make migrate` 성공
- pgvector 확장 0.8.7 사용 가능 확인

**막힌 점**
- 문제: 설치 후 `docker` 명령을 찾지 못함
  - 원인: 초기 설정에서 `/usr/local/bin` 심볼릭 링크가 만들어지지 않음
  - 해결: 앱 번들 bin 경로를 PATH에 추가
  - 재발방지: 사용 가이드 "실행 전 준비"에 PATH 확인 절차 추가 예정 (DOC-01)

**다음 할 일**
- [TBD] 강의 제공 LLM API 종류·키, 배포 대상, 팀 구성
- 다음 기능: SETUP-01(설계 문서 확정) → BE-01 → DB-01 → AUTH-01

---

## 2026-10-15 · 세션 3 · SETUP-01, BE-01 공통 예외 처리·로깅

**한 일**
- SETUP-01: 기존 설계 문서(docs/plans/01·02)의 acceptance를 독립 검증 → passes=true
- BE-01 구현
  - `core/exceptions.py`: 에러 응답 형식을 `{"error":{"code","message","details?"}}`로 통일.
    `AppError` 하위 예외, 입력값 검증(422, 필드별 details), Starlette HTTP 예외, 미처리 예외(500) 4개 핸들러
  - `core/logging.py`: request_id contextvar + 필터, 핸들러 이름으로 중복 등록 방지(pytest caplog 보존)
  - `core/middleware.py`: `RequestContextMiddleware` — request_id 발급/전달, `X-Request-ID` 응답 헤더, 접근 로그
  - 500 응답은 내부 메시지를 숨기고 서버 로그에만 스택을 남김
  - `tests/api/test_exceptions.py` 8개 추가 (총 11개 통과)
  - `docs/conventions.md`에 에러 코드 목록·request_id 규칙 추가

**막힌 점**
- 문제: uvicorn 접근 로그가 우리 접근 로그와 같은 요청을 두 줄로 출력
  - 원인: `uvicorn.access` 로거를 루트로 전파시켜 둬서 미들웨어 로그와 중복
  - 해결: `uvicorn.access`는 propagate=False로 끄고 접근 로그는 미들웨어가 전담
  - 재발방지: 로깅 설정을 `setup_logging()` 한 곳에서만 수정
- 문제: 주석 한 줄이 100자를 넘겨 verify 실패
  - 원인: 긴 한글 주석
  - 재발방지: 게이트가 잡아주므로 커밋 전 `./scripts/verify.sh` 필수

**알려진 사항(후속)**
- 미처리 예외 시 스택이 2회 기록된다(우리 핸들러 1회 + uvicorn의 "Exception in ASGI application" 1회).
  Starlette가 500 응답 생성 후 예외를 다시 올리는 구조 때문. 동작에는 문제 없어 후속 과제로 남김
- 산출물 템플릿 1번의 ②아키텍처·④요청 흐름은 `docs/architecture.md`에 있고, 02 문서로의 통합은 DOC-01에서 마무리

**다음 할 일**
- [TBD] 강의 제공 LLM API 종류·키, 배포 대상, 팀 구성, GitHub 원격 저장소
- 다음 기능: DB-01(users·refresh_tokens 모델·마이그레이션) → AUTH-01 → FE-01

---

## 2026-10-15 · 세션 4 · DB-01 users·refresh_tokens 모델과 첫 마이그레이션

**한 일**
- GitHub 연결: https://github.com/thinqsimon/fastapi-langchain-starter
  원격의 초기 커밋(.gitignore) 위로 rebase, `.gitignore`는 우리 것 + GitHub Node 템플릿의 유용한 항목 병합 후 push
- 스키마 확정(ADR-0003): UUID PK + 최소 필드(email, password_hash, display_name, is_active)
  - `User`, `RefreshToken` 모델, `TimestampMixin`(created_at/updated_at UTC)
  - 리프레시 토큰은 원문이 아니라 SHA-256 해시로 저장, 사용자 삭제 시 CASCADE
  - 기본값을 Python과 DB(`server_default`) 양쪽에 지정
- `alembic.ini`에 post_write_hooks 추가 → 생성되는 마이그레이션이 자동으로 ruff 포맷됨
- `tests/test_migrations.py` 4개 추가(총 15개). DB 없으면 skip, CI는 DB가 있어 항상 실행
- 마이그레이션 불일치 감지가 실제로 동작하는지 모델에 임시 컬럼을 넣어 확인 후 원복

**막힌 점**
- 문제: 편집 중 `func`, `Uuid`, `true`, `Path` import가 사라져 NameError 연쇄 발생
  - 원인: PostToolUse 훅의 `ruff check --fix`가 여러 번에 나눠 편집하는 도중
    "아직 쓰이지 않은" import를 미사용으로 보고 삭제
  - 해결: 훅을 `ruff format`만 수행하도록 변경. 린트는 verify.sh가 담당
  - 재발방지: 자동 수정 도구는 포맷처럼 되돌릴 수 있는 작업만 맡긴다
- 문제: 마이그레이션 파일을 지운 뒤 DB의 alembic_version이 사라진 리비전을 가리켜 upgrade 불가
  - 원인: downgrade가 실패한 상태에서 파일을 먼저 삭제
  - 해결: 테이블과 alembic_version을 비우고 재생성
  - 재발방지: 마이그레이션 파일 삭제 전 `alembic downgrade base` 성공을 먼저 확인
- 문제(검증자 지적): DB 기본값이 Python 쪽에만 있어 psql 직접 INSERT가 not-null 위반으로 실패
  - 해결: `server_default`(gen_random_uuid/now/true) 추가 후 raw INSERT 성공 확인
  - 재발방지: conventions.md "데이터베이스" 절에 규칙으로 명시

**알려진 사항(후속)**
- `updated_at`은 ORM을 거친 UPDATE에서만 자동 갱신됨(문서화 완료, 필요해지면 DB 트리거 검토)
- `refresh_tokens.expires_at` 인덱스 없음 — 만료 토큰 정리 배치를 만들 때 추가

**다음 할 일**
- [TBD] 강의 제공 LLM API 종류·키, 배포 대상, 팀 구성
- 다음 기능: AUTH-01(JWT 회원가입·로그인·리프레시·내 정보) → FE-01
- GitHub Actions CI 첫 실행 결과 확인 필요

---

## 2026-10-15 · 세션 5 · AUTH-01 · FE-01/02 · CHAT-01 · LLM-01 · CHAT-02 · FE-03

**한 일**
- GitHub 연결·push: https://github.com/thinqsimon/fastapi-langchain-starter
- AUTH-01: 가입·로그인·리프레시·로그아웃·내 정보. 리프레시 토큰 회전(쓴 토큰 폐기),
  로그인 실패 메시지 단일화(가입 여부 노출 방지), 운영 환경 설정 검증(약한 JWT 키·LLM 키 누락 차단)
- FE-01/02: 로그인·회원가입 화면, 보호 라우트, 401 시 토큰 자동 재발급(동시 요청은 1회만)
- CHAT-01/LLM-01/CHAT-02: conversations·messages, 프롬프트 템플릿·체인 분리, SSE 스트리밍
- FE-03: 사이드바·말풍선·입력창, 스트리밍 실시간 표시
- Playwright E2E 8개와 `scripts/e2e.sh`(백엔드 8010 / 프론트 3100 전용 포트)

**막힌 점**
- 문제: 브라우저로는 assistant 메시지가 저장되지 않는데 API 테스트는 통과
  - 원인: `scripts/e2e.sh`가 `.env`의 실제 OpenAI 공급자를 사용 → 키가 없어 스트림이 에러로 끝남.
    API 테스트는 `LLM_PROVIDER=fake`라 드러나지 않았다
  - 해결: e2e.sh에서 `LLM_PROVIDER=fake` 강제
  - 재발방지: 모든 자동 검증은 fake 공급자로 돌린다(키 불필요·결정적). conventions.md에 명시
- 문제: SSE 오류 이벤트에 OpenAI 내부 메시지가 그대로 노출
  - 원인: `get_chat_model()`이 try 블록 밖에 있어 초기화 예외가 LLMError로 안 묶였고,
    라우터가 `str(exc)`를 그대로 전송
  - 해결: 모델 생성을 try 안으로, 라우터는 AppError만 메시지 전달하고 그 외는 로그만 남기고 일반 문구 전송
  - 재발방지: 테스트로 내부 문자열 미노출을 단정(BE-01과 동일 정책)
- 문제: E2E가 간헐 실패(새로고침 시 이력 없음)
  - 원인: 스트리밍 중인 말풍선과 저장된 말풍선을 구분할 수 없어 저장 전에 새로고침
  - 해결: 스트리밍 말풍선에 `data-pending` 표시, 테스트는 저장된 것만 기다림
- 문제: 포트 충돌(수업 예제 서버가 8000 사용, 이전 E2E 백엔드가 8010에 잔존)
  - 해결: E2E 전용 포트 + 종료 시 포트 기준으로 자식 프로세스까지 정리, 시작 전 점유 확인

**알려진 사항(후속)**
- `.env.example` 수정이 `.claude/settings.json`의 `Edit(./.env.*)` deny 규칙에 막힘.
  `.env.example`은 예외로 둬야 함(사용자 확인 필요)
- 아직 실제 LLM 키로 호출해 본 적 없음(TBD). OPT-USAGE에서 토큰 사용량 기록 시 함께 확인

**다음 할 일**
- [TBD] 강의 제공 LLM API 키, 배포 대상
- 다음 기능: CI-01(GitHub Actions 확인) → TEST-01 → SAMPLE-01/02 → CD-01

---

## 2026-10-15 · 세션 6 · CI-01 · SAMPLE-01/02 · OPT-USAGE · DOC-01/03 · TEST-01

**한 일**
- CI-01: CI에 브라우저 E2E job 추가. Deploy는 `DEPLOY_TARGET`이 설정됐을 때만 실행
  (배포하지 않았는데 초록불이 켜지던 상태 제거)
- SAMPLE-01/02: 배움일기 코치 완성(코치 프롬프트, 구조화 출력, DiaryEntry, 화면·스토어)
- OPT-USAGE: 스트리밍 응답의 usage_metadata로 토큰 수 기록, 단가표와 비용 추정, 헤더 배지
- DOC-01: README와 사용·운영 가이드. 모든 명령을 실제 실행해 출력까지 확인
- DOC-03: 트러블슈팅 보고서, 발표 자료 15장(Artifact), 시연 체크리스트
- TEST-01: 커버리지 96%(90% 미만이면 게이트 차단), 미검증 경로 보강, 테스트 90개
- 실제 OpenAI 키로 스트리밍·일기 초안 생성 확인

**막힌 점**
- 문제: `.env.example` 수정이 권한 규칙에 막힘
  - 원인: `.claude/settings.json`의 `Edit(./.env.*)`가 비밀이 아닌 예시 파일까지 차단
  - 해결: 사용자 승인 후 `.env`·`.env.local`·`.env.production`만 차단하도록 좁힘
  - 재발방지: 차단 규칙은 실제 비밀 파일만 정확히 지정한다
- 문제: 가짜 LLM이 구조화 출력을 지원하지 않아 일기 기능 테스트 불가
  - 해결: `FakeChatModel.with_structured_output`을 추가해 스키마 필드를 채운 더미 반환
- 문제: 저장 직후 입력칸을 비우는 처리가 사용자의 다음 입력과 겹쳐 글이 지워짐
  - 원인: 목록 갱신보다 초기화가 늦게 도착
  - 해결: 목록을 먼저 읽고 나서 비움. 스트리밍 말풍선에 `data-pending` 표시로 테스트가 저장 완료를 기다리게 함
- 문제: E2E 선택자가 Next.js의 route announcer(`role="alert"`)와 충돌
  - 해결: 화면 요소로 범위를 좁힘. `frontend/CLAUDE.md`에 규칙으로 기록

## 2026-10-15 · 세션 7 · CD-01 배포 (Supabase + Render + Vercel)

**한 일**
- 무료 플랜 조건 조사 후 배포 구성 변경(ADR-0004): Render 무료 DB는 30일 후 만료되어
  제출 이후 산출물이 죽는다 → DB만 Supabase로 분리
- Supabase 연결, 마이그레이션 적용(테이블 5개), 운영 환경 전 과정 확인
- 배포 주소
  - 프론트엔드: https://fastapi-langchain-starter-delta.vercel.app
  - 백엔드: https://diary-coach.onrender.com

**막힌 점**
- 문제: 환경 변수 수정 후 서버가 `SettingsError: error parsing value for field "CORS_ORIGINS"`로 죽음
  - 원인: pydantic-settings가 list[str]을 JSON으로만 해석. 대시보드 입력에서 대괄호·따옴표를 빠뜨리기 쉽다
  - 해결: `NoDecode` + 검증기로 JSON 배열과 쉼표 구분을 모두 수용, 틀렸을 때 고치는 방법 안내
  - 재발방지: 회귀 테스트 4개 추가
- 문제: 루트 경로 404와 "No open ports detected" 경고
  - 원인: 배포 플랫폼이 포트 확인용으로 `/`를 호출하는데 라우트가 없었음
  - 해결: 서비스 정보를 돌려주는 루트 라우트 추가
- 문제: `.env`를 Supabase로 바꾸자 테스트·E2E가 운영 DB를 사용
  - 해결: `TEST_DATABASE_URL`로 분리. 테스트 DB가 원격이면 실패하는 안전장치 추가
- 문제: 저장소 소유자가 아닌 계정이라 Render에서 GitHub 연결 불가
  - 원인: GitHub 앱은 계정 단위 설치라 협업자 권한으로는 설치할 수 없다
  - 해결: Public Git Repository 방식으로 생성. 자동 배포는 Deploy Hook으로 대체
  - 사용 가이드에 방법 A/B로 나눠 기록

**알려진 사항**
- Public Git Repository 방식은 push해도 Render가 자동 배포하지 않는다.
  GitHub Secret `RENDER_DEPLOY_HOOK_URL` 등록 전까지는 Manual Deploy가 필요하다

**다음 할 일**
- [사용자] GitHub에 `RENDER_DEPLOY_HOOK_URL`(Secret), `DEPLOY_TARGET`·`BACKEND_URL`(Variable) 등록
- DOC-02: 다른 사람이 문서만 보고 실행해 보는 검증
- 선택: OPT-RAG, OPT-DOCKER

---

## 2026-10-15 · 세션 8 · 요구사항 점검과 선택 구현 완료

**한 일**
- `docs/update/requirements-checklist.md`: 과제 문서 2건의 전 항목을 실제 실행으로 검증해 기록
- 선택 구현 4건 완료
  - Swagger 고도화: 인증 절차·에러 형식 설명, 태그 그룹, 엔드포인트 요약
  - Docker Compose 전체 스택: `--profile full`(기본은 DB만 유지), Dockerfile 2개
  - `scripts/new-project.sh`: 이름 치환·샘플앱 제거·남은 참조 안내
  - RAG 모듈: pgvector 기반 저장·검색, `RAG_ENABLED`로 on/off (ADR-0005)
- 테스트 90 → 103개, 커버리지 96%

**막힌 점**
- 문제: 생성 스크립트가 한글 이름 문서를 전부 건너뜀
  - 원인: `git ls-files`가 ASCII 밖 경로를 escape된 따옴표 문자열로 출력
  - 해결: `-z`(NUL 구분)로 읽도록 변경. 재검증에서 옛 이름 0건 확인
  - 재발방지: 파일 목록은 항상 NUL 구분으로 읽는다
- 문제: 치환 결과에 백슬래시가 섞임
  - 원인: 치환문에 `\Q`(quotemeta)를 써서 공백까지 escape
  - 해결: 값을 환경 변수로 넘기고 패턴 쪽에만 `\Q` 사용
- 문제: `langchain-postgres` 의존성 해결 실패
  - 해결: 이미 있는 `pgvector` + SQLAlchemy로 직접 구현. 의존성이 줄고 코드도 짧아짐
- 문제: `DeterministicFakeEmbedding`이 numpy를 요구
  - 해결: 해시 기반 결정적 임베딩을 직접 구현. 무작위가 아니라 **검색 순서까지 검증 가능**해짐
- 문제: 테스트에서 RAG 라우터가 등록되지 않음
  - 원인: import 시점에 선택 기능을 판단해 설정 변경이 반영되지 않음
  - 해결: `build_api_router()`로 호출 시점에 구성하도록 구조 변경

**확인된 안전장치**
설정 누락 검사와 모델 등록 검사가 새 설정 4개와 새 테이블 1개의 누락을 실제로 잡아냈다.

**다음 할 일**
- DOC-02: 팀원이 README만 보고 실행해 보기 (사람 필요)
- 발표 표지의 팀원 이름 채우기

---

## 2026-10-20 · 세션 9 · 배움일기 v2 (PREF-01 · ACC-01 · UX-01 · UX-02 · DIARY-01~03)

**요청**: 일기 단위를 채팅으로, 같은 날 여러 편, '배운 내용 상세' 추가, 빈 '내일 할 것'은 항목 제외,
개인 캐치프레이즈(전광판)·푸터, 우측 계정 사이드 메뉴와 설정 화면.
사용자 확인 사항: 계정 수정 범위는 이름·이메일·비밀번호 / 같은 채팅은 마지막 대화 이후 추가분이 있을 때만
다시 발행하고 목록에서 숨김 / AI 보충 설명은 구분 없이 섞음 / 푸터는 저장 시점 값으로 고정.

**한 일**
- feature_list에 phase 5 기능 7개를 인수조건과 함께 추가하고, 테스트로 하나씩 고정
- 백엔드
  - `preferences` 도메인 신설(GET/PUT/DELETE `/api/me/preferences`, 행이 없으면 기본값)
  - 계정 수정 API: `PATCH /api/auth/me`, `PUT /api/auth/me/email`, `PUT /api/auth/me/password`
  - 일기: `GET /api/diary/conversations`(고를 수 있는 채팅), 재발행 조건(409), `day_sequence`, 제목·상세·푸터
  - 마이그레이션 `c85195cc050f`(왕복·`alembic check` 확인), 설계 기록 ADR-0006
- 프론트엔드
  - 계정 사이드 메뉴(shadcn sheet), `/settings`, 헤더 가운데 캐치프레이즈 전광판
  - 일기 화면: 채팅 고르기 → 초안 → 상세 미리보기 → 저장, 지난 일기는 마크다운으로 표시
  - 의존성 추가: `react-markdown`, `remark-gfm`(원본 HTML을 그리지 않는 안전한 렌더링)
- 테스트: 백엔드 165개(커버리지 97%), E2E 22개(계정·설정·전광판·일기 흐름)

**막힌 점**
- 문제: 현재 비밀번호를 틀리면 화면에서 로그아웃될 뻔함
  - 원인: 401을 주면 프론트엔드 인터셉터가 토큰 재발급을 시도하고 실패 시 세션을 지운다
  - 해결: 확인용 비밀번호 오류는 400 `WRONG_PASSWORD`. E2E로 "틀려도 로그아웃되지 않음"을 고정
- 문제: 모델이 대화에 없는 '내일 할 것'을 지어냄(프롬프트 지시만으로는 막을 수 없음)
  - 해결: 근거 문장을 대화에서 그대로 인용하게 하고, 그 문장이 새 대화에 없으면 비움. 단위 테스트로 고정
- 문제: 한국 새벽(00~09시)에 제목 날짜가 하루 전으로 나옴
  - 원인: 서버의 "오늘"이 UTC
  - 해결: 화면이 사용자 기준 날짜를 보내고 서버는 없을 때만 UTC를 쓴다(초안·주간 회고)
- 문제: 초안을 만든 뒤 다른 일기가 먼저 저장되면 제목의 (n)이 어긋남
  - 해결: 저장할 때 날짜로 시작하는 제목의 순번을 실제 값으로 다시 맞춤
- 문제: `alembic current`가 이전 리비전을 보여 혼동
  - 원인: 기본 `DATABASE_URL`이 운영 DB(원격)를 가리킨다. 로컬 확인은 `DATABASE_URL=<로컬> alembic current`
  - 재발방지: 로컬에서 마이그레이션 명령을 칠 때는 항상 대상 DB를 명시한다
- 정리: 실수로 커밋돼 있던 `backend/.coverage`를 추적에서 빼고 `.gitignore`에 추가.
  `new-project.sh`의 샘플 제거 목록에 새 일기 테스트 파일을 넣음

**검증**
- test-verifier: 7개 기능의 인수조건 전 항목 통과 판정(verify.sh, E2E 22/22, 별도 브라우저 탐침)
- 판정 과정에서 나온 보완점을 배포 전에 고침
  - 캐치프레이즈가 좌우 메뉴 사이 공간의 가운데라 헤더 정중앙보다 51px 오른쪽 → 3칸 그리드로 정중앙 배치, E2E로 위치·여백 확인
  - 이메일 변경 경합 시 500 → 409
  - '내일 할 것' 근거에 화자 표시("교육생:")만 인용해도 통과 → 화자 표시를 빼고 메시지 본문 하나 안에서 찾도록
  - 비밀번호 변경 E2E가 새 토큰 저장 여부를 가려내지 못함 → 액세스 토큰을 무효화한 뒤 새로고침해 확인
- 실제 모델(gpt-4o-mini) 확인: 계획 없는 대화는 '내일 할 것' 공백, 계획 있는 대화는 근거 인용과 함께 유지,
  재발행은 새 대화 주제만 정리. 상세가 짧은 편이라 프롬프트에 소제목별 구성(개념·사용법·예시·주의점)을 명시

**알려진 사항**
- 비밀번호를 바꿔도 다른 기기의 액세스 토큰은 만료(30분)까지 유효하다(리프레시는 즉시 막힘)
- 이메일 중복 확인은 대소문자를 구분한다(가입·로그인과 같은 기존 동작)
- 운영 DB 마이그레이션은 main 배포 시 Render 시작 명령에서 적용된다

**다음 할 일**
- 배포 후 운영 화면에서 일기 v2 흐름 확인
- DOC-02: 팀원이 README만 보고 실행해 보기 (사람 필요)

---

## 2026-10-21 · 세션 10 · UX-03 반응형 · UX-04 입력칸 자동 높이

**요청**: 모바일에서도 쓰기 좋게. 좌측 대화 목록을 감추는 아이콘을 좌측 상단에, 다른 화면도 모바일에서 문제없게.
채팅 입력이 다음 줄로 넘어가면 3줄까지 높이가 자동으로 늘어나게.

**한 일**
- 대화 목록 접기: 채팅 화면 헤더 좌측 상단 아이콘. 넓은 화면은 옆 목록을 접고 펼침(기본 펼침),
  768px 미만은 기본 감춤 → 아이콘을 누르면 왼쪽 서랍(sheet)으로 열리고 대화를 고르면 닫힘(`store/layout.ts`)
- 입력칸: 내용에 맞춰 최대 3줄까지 늘고, 넘으면 안에서 스크롤, 보내면 한 줄로 복귀
- 모바일 정리
  - 입력칸 글자 16px(모바일 Safari가 누를 때 화면을 확대하지 않게), 일기 채팅 선택칸도 동일
  - 터치 기기에서 대화 삭제 버튼이 늘 보이게(hover 의존 제거)
  - 긴 주소·단어가 말풍선·일기 카드 밖으로 넘치지 않게(`wrap-anywhere`)
  - 좁은 화면에서 여백 축소, 헤더의 서비스 이름 감춤, 이름 저장 버튼을 아래로, 계정 메뉴 폭 상한
- 한글 입력 중 Enter(글자 확정)로 메시지가 보내지는 문제 방지(`isComposing`)
- E2E 4개 추가(`responsive.spec.ts`), 390px 화면 캡처로 채팅·서랍·일기·설정을 눈으로 확인
- 한글 입력 중 Enter 처리는 위와 같고, E2E는 28개(반응형 6개)로 늘었다

**검증과 보완**
- test-verifier: UX-04 통과, UX-03은 보완 필요 판정 → 고친 뒤 재확인
  - 서랍을 연 채로 화면이 넓어지면 반투명 배경만 남아 화면을 누를 수 없음(심각) → 넓어지면 서랍을 닫고, 넓은 화면에서는 서랍을 열지 않음
  - "터치 기기"를 화면 폭(768px 미만)으로 판단해 터치 태블릿에서 삭제 버튼이 안 보이고 입력칸이 14px
    → hover 가능 여부·포인터 종류(`hover:hover`, `pointer:fine`)로 판단. 공용 Input/Textarea도 같은 기준
  - 일기 '배운 내용 상세' 입력칸이 12px(모바일에서 확대됨) → 16px
  - 토글 버튼에 `aria-expanded` 추가(보조기기가 열림 상태를 읽음)
- E2E에 터치 폰·터치 태블릿 에뮬레이션, 화면 폭 변경, 모든 입력칸 글자 크기 검사를 추가

---

## 2026-10-21 · 세션 11 · DIARY-04 일기 프리뷰 보기·전체 복사

**요청**: 배움일기 전체를 복사해 붙여 넣고 싶다. 작성 화면 제목 오른쪽과 지난 일기 카드마다
'프리뷰 보기'(문서 형태로 보는 창, 닫기·전체 복사 포함)와 '전체 복사'(창 없이 바로 복사) 버튼.
사용자 결정: 복사는 마크다운 글자+서식(HTML) 함께 / 프리뷰는 화면 위에 뜨는 창 / 인쇄 버튼은 넣지 않음.

**한 일**
- `lib/diary-markdown.ts`: 일기 → 마크다운 문서(제목 → 배운 것 → 배운 내용 상세 → 어려웠던 것 → 내일 할 것(있을 때만) → 푸터)
- `lib/clipboard.ts`: `text/plain`(마크다운)과 `text/html`(프리뷰와 같은 모양)을 함께 쓰고, 안 되는 브라우저는 글자만
- `components/diary/diary-document.tsx`: 문서 형태 렌더링(h1~h3 단계를 지켜 붙여 넣을 때도 제목 서식 유지)
- `components/diary/diary-preview-actions.tsx`: 프리뷰 창(shadcn dialog, 버튼은 위에 고정·본문만 스크롤)과 복사 버튼(완료 시 '복사됨')
- 작성 중인 일기의 프리뷰에는 저장 시 붙을 푸터(수정 중이면 그 일기의 푸터)를 넣는다
- E2E 3개(`diary-preview.spec.ts`): 문서 순서·소제목·목록, 클립보드의 마크다운 원문과 HTML, 카드 버튼

**막힌 점**
- 문제: 카드에서 복사 직후 클립보드를 읽으면 간헐적으로 `Clipboard data has changed`
  - 원인: 테스트가 복사(비동기 쓰기)가 끝나기 전에 읽음
  - 해결: '복사됨' 표시를 기다린 뒤 읽는다

**검증과 보완**
- test-verifier: 인수조건 5개 모두 통과 판정(verify.sh, E2E 31/31)
- 지적 반영: 그냥 쓴 글(배운 것 등)에 `# …`나 `---` 줄이 있으면 문서 제목·푸터 구분선으로 바뀌어 구조가 깨짐
  → 그런 줄만 이스케이프(목록·인라인 코드는 그대로). E2E로 고정, 전체 32/32
- 남겨 둔 것: 평문 HTTP에서는 클립보드 API가 막혀 '복사 실패'(운영은 HTTPS라 해당 없음)

---

## 2026-10-21 · 세션 12 · 아이폰 웹앱 하단 여백·보내기 버튼

**요청**(아이폰 홈 화면 웹앱 스크린샷): 아래쪽이 너무 붙음 → 안전 영역 경계부터. 보내기 버튼이 오른쪽에서 잘림 → 고치고 종이비행기 아이콘으로.

**한 일**
- `viewport-fit=cover`(app/layout.tsx `viewport`)로 안전 영역 값을 받고, 하단에 닿는 곳마다 `env(safe-area-inset-bottom)` 여백:
  채팅 입력칸, 일기·설정 화면 끝, 계정 메뉴 아래 버튼, 대화 목록 서랍. 가로 모드 노치는 body 좌우 여백
- 보내기 버튼: 글자 없이 종이비행기 아이콘(`aria-label="보내기"` 유지)
- E2E: 375px 터치 폰에서 입력칸 기본 너비가 넓어도 보내기 버튼이 화면 안에 있는지(수정 전 코드로 실패 확인)

**막힌 점**
- 문제: 아이폰에서만 보내기 버튼이 화면 밖으로 밀림(크롬 E2E 390px에서는 정상)
  - 원인: 실제 아이폰은 글꼴 때문에 입력칸 기본 너비가 넓게(약 305pt) 계산되는데, 채팅 영역(section)에
    `min-w-0`이 없어 그 너비 아래로 줄지 못하고 화면보다 넓어졌다. 바깥이 `overflow-hidden`이라 가로 스크롤 검사에도 안 걸렸다
  - 확인: WebKit(iPhone 프로필)에서 입력칸 `cols`를 늘려 재현(영역 722px)
  - 해결: 채팅 영역에 `min-w-0`. 회귀 테스트는 같은 조건(입력칸 `cols=60`)으로 고정
  - 재발방지: flex 안에서 줄어들어야 하는 영역에는 `min-w-0`을 함께 둔다
- 안전 영역 여백은 에뮬레이터에서 값이 0이라 자동 검증 불가 → 실기기 확인 필요

---

## 2026-10-21 · 세션 13 · BRAND-01 로고·파비콘

**요청**: 로고 시안 3가지(학원 배움일기 플랫폼 느낌, 열정·자기애·성공) → 사용자가 A안(열정 노트: 펼친 노트 위 불꽃) 선택.
웹앱 화면에 로고 배치와 파비콘 적용.

**한 일**
- 로고 원본: `public/brand/logo.svg`(자세히), `logo-small.svg`(32px 이하용, 줄무늬·불꽃 속 생략)
- `npm run icons`(`scripts/generate-icons.mjs`): 원본 SVG를 Playwright 크로미움으로 그려
  `app/favicon.ico`(16·32·48), `app/icon.svg`, `app/apple-icon.png`(180, 아이폰용 꽉 찬 정사각형), 매니페스트 아이콘 192·512 생성. 새 의존성 없음
- `app/manifest.ts`(이름·아이콘·start_url /chat·standalone), 메타데이터 제목과 `appleWebApp` 이름을 '배움일기 코치'로
- 배치: 헤더 왼쪽(로고+이름, 누르면 채팅. 좁은 화면은 로고만), 로그인·가입 화면 위쪽(로고+이름+영문), 빈 채팅 화면
- E2E 3개(`brand.spec.ts`): 탭 제목·파비콘·apple-touch-icon·매니페스트 연결과 파일 응답, 로그인 화면 로고, 헤더 로고 링크

**막힌 점**
- 문제: 로고 링크 이름 '배움일기 코치 홈'이 기존 E2E의 '일기' 링크 찾기(부분 일치)에 함께 걸려 12개 실패
  - 해결: 테스트에서 '일기' 링크를 정확히 일치로 찾는다(로고의 보이는 이름은 그대로 둠)

**검증과 보완**
- test-verifier: 인수조건 5개 모두 통과 판정(verify.sh, E2E 36/36, ICO·apple-icon 형식 확인, 아이콘 재생성 시 결과 동일)
- 지적 반영: 작은 크기용 로고가 손으로 복사한 별도 파일 → 원본의 `data-detail` 요소를 빼서 스크립트가 생성(원본은 정말 하나)
- 쓰이지 않던 Next 기본 이미지(public/next.svg 등 5개) 삭제
- 남겨 둔 것: 안드로이드 적응형(maskable) 아이콘은 아직 없음(둥근 모서리 아이콘이 작게 보일 수 있음)
