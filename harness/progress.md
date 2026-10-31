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

---

## 2026-10-21 · 세션 14 · DIARY-05 전체 복사 서식을 교육 플랫폼에 맞춤

**요청**(플랫폼에 붙여 넣은 스크린샷): 프리뷰처럼 나오지 않는다. 항목 사이를 줄간격으로 구분하고 항목 제목 크기를 균일하게.
(사용자가 크롬 연동으로 페이지를 보라고 했으나 이 세션에는 브라우저 도구가 연결돼 있지 않아 스크린샷으로 분석)

**원인**
- 붙여 넣는 편집기는 우리 CSS(크기·여백)를 버리고 태그만 받아 자기 스타일로 다시 그린다
- 플랫폼은 h2·h3를 둘 다 아주 크게 그려 항목 제목(h2)과 상세 소제목(h3)이 구분되지 않았고, 제목 앞 여백이 없어 항목이 붙어 보였다

**한 일**
- 붙여 넣기용 HTML을 프리뷰와 분리(`components/diary/diary-paste-document.tsx`)
  - 항목 제목은 모두 h3, 상세 안 소제목은 '▶ 굵은 글씨' 문단, 항목·푸터 앞에 빈 문단(`<p><br></p>`)
- `lib/diary-markdown.ts`: 항목 목록(`diarySections`)을 마크다운·붙여 넣기 HTML이 함께 쓰도록 분리
- E2E: 복사된 HTML의 구조(항목 제목 단계, 소제목, 빈 줄 수) 확인. 플랫폼 크기를 흉내 낸 화면으로 모양 확인
- 실제 플랫폼 확인은 사용자 몫(배포 후 다시 붙여 넣기)
- 후속(사용자 확인 후): 플랫폼에서 상세의 소제목이 앞 문단에 붙어 보여, 두 번째 소제목부터 앞에 빈 줄을 넣음
  (맨 앞 소제목은 바로 위가 항목 제목이라 제외). E2E로 고정, 전체 37/37
- 코드 블록 안 회색 글자는 플랫폼이 직접 입히는 강조 색이라 붙여 넣는 쪽에서 바꿀 수 없음

---

## 2026-10-21 · 세션 15 · 문서 동기화

**요청**: 최근 변경(세션 9~14)이 스타터킷·프로젝트 문서에 반영됐는지 확인하고 필요하면 수정.

**한 일**
- README: 화면 공통(로고·아이콘)·모바일 행 추가, E2E 22→37개, '새 서비스로 바꾸기'의 이름·로고 교체 위치
- architecture.md: 채팅 스트리밍 경로 오류 수정(`/api/chat/{id}/stream` → `/api/conversations/{id}/stream`, 이전부터 틀려 있었음)
- conventions.md·frontend/CLAUDE.md: 모바일(min-w-0, hover/pointer 판단, 16px, 안전 영역, 서랍 닫기), 클립보드·붙여 넣기 서식, 아이콘 생성, E2E 정확히 일치 규칙
- usage.md ⑥: 이름·로고 바꾸기(`brand-logo.tsx`, `public/brand/logo.svg` → `npm run icons`)
- troubleshooting.md: 7번 '아이폰에서만 보내기 버튼이 밀림' 신설, 그 밖의 문제 6건, 발견 수단 표에 실기기·WebKit, test-verifier 추가
- 샘플앱 README·기획 04: 프리뷰·전체 복사, 모바일, 로고 반영 / 루트 CLAUDE.md 구조에 public/brand
- 요구사항 점검표·발표 메모: 현재 지표(165개·E2E 37개) 갱신, 슬라이드 갱신 필요 항목 표시
- new-project.sh: 샘플 제거 목록에 `diary-preview.spec.ts`·`lib/diary-markdown.ts`, 로고·이름 교체 안내

- 발표 슬라이드 8장 갱신: 아키텍처·모듈 표·프론트엔드·CI/CD(165개·E2E 37개)·배포(배포 훅)·샘플 서비스(하루 한 편 → 채팅 단위·여러 편·프리뷰/복사)·트러블슈팅(아이폰 사례)·배운 점(완료된 RAG·컨테이너를 개선 방향에서 교체)

---

## 2026-10-26 · 세션 16 · SEP-01 공통 스타터킷과 서비스 분리

**사용자 요청**: 승인한 기획에 따라 `service/diary-coach` 브랜치를 생성하고 공통 기반과
배움일기 코치 분리부터 진행. 기존 DOC-02 대신 이 요청을 우선 수행하며 기존 인수조건은 유지한다.

**한 일**
- main `7490625`에서 서비스 브랜치 생성. `starter` / `diary-coach` 실행 프로필과 조립 지점 추가
- starter에서 일기·전용 개인 설정 API 비등록, 일기 화면 404, 서비스 설정 요청·메뉴 비노출
- 공통 ChatService에 프로필의 프롬프트 주입. 학습 질문에 설명과 예시를 제공하는 코치로 연결
- 서비스 UI 슬롯을 분리하고 이름·설명·메뉴를 프로필 설정으로 관리
- Node 개발 런처, 초기화 도구, Compose 환경 전달, 실행 가이드와 ADR-0007 추가
- 초기화는 샘플 파일 삭제 대신 프로필 선택. Render 생성 템플릿에도 선택한 프로필과 이름 반영
- 전체 ORM 모델과 기존 Alembic 이력을 보존. 운영 DB·배포 플랫폼·Secret은 변경하지 않음
- 서비스 브랜치 push CI와 서비스/스타터 E2E matrix 추가. 두 실패 리포트의 artifact 이름도 분리

**검증 결과**
- ruff, mypy(64파일), import-linter(3계약), 프론트엔드 포맷·린트·타입 검사 통과
- 새 프로필/초기화 테스트: 로컬 7 passed, 1 skipped(DB 통합)
- 로컬 Docker 엔진이 없어 DB를 쓰는 전체 검증과 E2E는 GitHub CI에서 확인한다
- test-verifier 정적 검토의 Render 프로필 누락 지적을 수정하고 회귀 테스트 추가
- 첫 CI의 starter E2E가 일기 화면의 HTTP 200을 발견했다. Next.js는 렌더링 중 notFound를
  호출해도 스트리밍을 시작한 뒤라면 200을 유지한다. 인수조건을 완화하지 않고 요청 전
  proxy 가드에서 404로 처리하도록 수정하고 하위 경로 검사도 추가했다
- 서비스 job의 브라우저 설치가 6분 가까이 지연돼 CI에 필요한 headless shell만 설치하고
  설치 단계 5분 제한을 추가했다. 테스트 수나 통과 기준은 유지한다
- 검증 코드 `3f900486f4de4545cdab950e46bbf5c1d32b058a`의
  [CI 40254954116](https://github.com/thinqsimon/fastapi-langchain-starter/actions/runs/40254954116) 전체 성공:
  DB를 포함한 백엔드 **173 passed**(skip 없음), 커버리지 **97.38%**, verify.sh 전체 및 두 프로필 빌드 통과.
  서비스 E2E **37 passed**, starter E2E **3 passed**
- 최신 proxy 포함 로컬 starter 운영 빌드와 임시 서버 HTTP 검사:
  `/sign-in` 200·AX Chat Starter 제목, `/diary` 및 하위 경로 404 확인. 임시 서버 종료
- 독립 test-verifier가 CI 세 job 로그와 인수조건 6개를 직접 확인해 모두 PASS로 판정.
  SEP-01만 passes:true로 갱신한다. 이번 완료 기록은 검증 결과와 하네스 상태만 바꾸며
  검증한 코드에는 변경이 없어 CI 재실행을 생략한다

**후속**: 구름 캐릭터 UI·채팅에서 일기 바로 만들기·회고 저장·복습은 다음 기능으로 진행.
독립된 제3자 실행·배포 재현(DOC-02)은 별도 미완료 항목으로 유지한다.

---

## 2026-10-26 · 세션 17 · COACH-01 구름 코치 UI·채팅에서 일기 만들기

**사용자 요청**: `service/diary-coach`에서 제공된 구름 이미지를 활용하고 현재 채팅을
바로 배움일기로 만드는 흐름 구현. DOC-02보다 우선하며 기존 인수조건은 유지한다.

**한 일**
- 구름 이미지 원본을 보관하고 서비스 시작 화면·추천 질문·응답 아바타·일기 버튼 추가
- 공통 채팅에는 조립 지점으로 UI만 주입. starter의 기본 시작 화면과 메뉴 유지
- 현재 대화 ID로 기존 초안 API 호출 후 작성 화면 연결. 출처·날짜를 수정·저장까지 보존
- 자동 저장 없이 미저장 교체 확인, 오류·중복 요청·지연 응답·계정 세대 보호
- 독립 test-verifier가 발견한 저장 중 입력 수정에 따른 중복 POST 경로를 입력 잠금으로 차단
- 기존 일기 화면에도 교체 확인을 적용. 로그아웃 API 실패 시에도 로컬 세션 정리 보장
- 코치 E2E 10개와 starter UI 격리 검사 추가. CI에 데스크톱·모바일 화면 artifact 보관
- ADR-0008·샘플앱·사용 가이드 갱신. DB·API 계약과 의존성 변경 없음

**검증 결과**
- 로컬 프론트엔드 포맷·린트·타입 검사 및 운영 빌드 성공
- 검증 코드 `5ca08b5a901f96151b6c61514ad40123ae33bbdf`의
  [최종 CI 40258031595](https://github.com/thinqsimon/fastapi-langchain-starter/actions/runs/40258031595) 전체 성공
- 실제 PostgreSQL을 사용한 백엔드 **173 passed**, 커버리지 **97.38%**,
  전체 verify.sh·mypy 64파일·계층 계약 3개·두 프로필 빌드 통과
- 서비스 E2E **47 passed**, starter E2E **3 passed**. 최종 실행은 재시도·skip 없음
- 데스크톱 시작/대화, 모바일 시작/일기 화면 4개를 직접 확인. 원본 이미지 SHA-256 일치 확인
- 독립 test-verifier가 세 job 로그와 인수조건 7개를 확인해 모두 PASS 판정. COACH-01만 passes:true

**문제·해결·재발 방지**
- 새 대화 영역의 접근성 이름이 입력칸과 겹쳐 기존 테스트가 실패해, region 이름을 '대화 내용'으로 구분
- 다른 대화의 늦은 스트림 실패가 현재 일기 버튼을 막지 않도록 대화 ID로 오류도 격리
- 신규 테스트에서 대화 전환/제목 갱신 전 검사를 발견. 메시지 배열과 실제 sidebar 제목을 기다려
  기대 조건을 유지하면서 테스트 준비 경합을 제거. 최종 CI에서 재시도 없이 확인
- 마지막 커밋은 검증 결과·기능 상태·설계 설명·테스트 수 문서만 갱신하므로 CI 재실행 생략

**다음 할 일**: 주간 회고 저장·어려웠던 내용 복습 기능 확장.
독립된 제3자 실행·배포 재현(DOC-02)은 별도 미완료 항목으로 유지한다.

---

## 2026-10-26 · 세션 18 · COACH-02 회고 보관·어려웠던 내용 복습

**사용자 요청**: 서비스 브랜치에서 주간 회고 저장과 어려웠던 내용 복습 구현.
DOC-02보다 이 요청을 우선하며 기존 인수조건은 유지한다.

**한 일**
- diary 도메인에 주별 회고 snapshot과 일기별 복습 메모·완료 상태 추가
- 선택한 주 회고 생성·저장·목록·삭제 API, 복습 조회·저장 API 추가. 기존 GET weekly 유지
- 계정·주별 유일 제약과 복습 PK/FK, 소유자 필터 및 계정별 격리 적용
- 추가 Alembic e317b6a91d42와 기존 일기 보존 downgrade/upgrade 검증 추가
- 주간 회고 보관함과 원문 보기·메모·완료/다시 복습 UI, 일기 상단 바로가기 구현
- 어려움 원문을 고치면 완료만 해제하고 메모 보존. 원본 삭제 시 복습은 CASCADE 삭제
- Zustand 세션·조회 버전 보호와 저장 중 입력 잠금, 실패 시 메모 유지
- 독립 test-verifier가 찾은 지연 저장→원본 수정 경합 수정. 오래된 PUT 대신 최신 서버 상태 조회
- 신규 API/마이그레이션 테스트와 E2E 8개 추가, starter 격리 검사 확장
- 사용자 요청에 필요한 추가 DB/API 설계는 ADR-0009에 기록하고 브랜치에서만 검증.
  운영 DB·배포·Secret·의존성 변경 없음

**검증 결과**
- 로컬 ruff·mypy 64파일·계층 계약 3개·프론트엔드 전체 품질 검사와 운영 빌드 성공
- 로컬 신규 기능 관련 테스트 11 passed/12 skipped(DB 미기동). DB 통합은 아래 CI에서 skip 없이 실행
- 검증 코드 `684ed34d086ecf83833aad2949c1091f0f7c64b6`의
  [최종 CI 40261121799](https://github.com/thinqsimon/fastapi-langchain-starter/actions/runs/40261121799) 전체 성공
- 실제 PostgreSQL을 사용한 백엔드 **190 passed**, 커버리지 **97.84%**.
  기존 일기 보존 downgrade/upgrade, 소유권·중복 주 저장·복습 진행 검증 포함
- 서비스 E2E **55 passed**, starter E2E **3 passed**. 재시도·skip 없음
- 독립 test-verifier가 세 job 로그·화면 3개·인수조건 8개를 확인해 모두 PASS 판정. COACH-02만 passes:true
- 전체 verify.sh와 두 프로필 빌드 통과. 데스크톱 회고·복습 및 모바일 화면 3개 직접 검토
- 첫 CI의 회고 복원 비교는 innerText 캡처와 textContent 검증의 차이로 실패.
  내용 기준을 유지하고 두 검증에 useInnerText를 명시해 새로고침·재로그인 경로까지 재검증
- 마지막 기록 커밋은 README 테스트 수와 완료 상태·검증 기록만 갱신하며 코드 변경은 없다

**다음 할 일**: 기존 환경 실행 시 Alembic upgrade head 적용, 실제 LLM으로 팀 사용성 점검.
독립된 제3자 실행·배포 재현(DOC-02)은 별도 미완료 항목으로 유지한다.

---

## 2026-10-26 · 세션 19 · 로컬 DB 마이그레이션·체험 환경 실행

**사용자 요청**: 서비스 브랜치의 마이그레이션을 적용하고 회고·복습을 로컬에서 직접 확인할 수 있게 실행.
기능 추가 대신 로컬 실행을 우선하며 기존 기능 인수조건과 DOC-02 상태는 바꾸지 않는다.

**한 일**
- Docker Desktop 부팅 후 프로젝트 pgvector/pgvector:pg17 DB와 영구 볼륨 실행
- 로컬 DB에 Alembic upgrade head 적용. current=e317b6a91d42, check에서 추가 변경 없음
- Windows cp949 INI 읽기 오류를 주석 3줄의 ASCII 영문화로 해결. 활성 설정은 변경하지 않음
- Windows 예약 포트 7921~8020을 확인해 API를 127.0.0.1:18000, UI를 127.0.0.1:3000으로 실행
- fake LLM으로 외부 API 키 없이 체험하도록 구성하고 전용 로컬 예시 계정·일기 3편·회고 2편 준비
- 복습 대기 2개·완료 1개. 브라우저에서 메모 저장/새로고침 유지, 완료/다시 복습 전환 확인
- 로그인된 localhost 회고·복습 탭을 사용자에게 남기고 채팅 산출물로 시작·종료 도우미와 안내 제공
- 서버는 숨김 백그라운드 프로세스, 로그/PID는 작업용 runtime 폴더에 기록.
  종료 도우미는 PID 생성 시각을 비교하고 DB 볼륨을 보존한다

**검증**
- DB health, API readiness, UI/sign-in HTTP 200
- 읽기 전용 SQL로 새 테이블·head·유일 제약·FK 확인
- 독립 test-verifier가 로컬 로그인/조회/DB 메타데이터와 cp949 INI 파싱을 확인해 PASS
- 왕복 마이그레이션 테스트의 downgrade 대상을 고유한 임시 DB로 격리해 공유 로컬 데이터 보호
- 격리한 왕복 테스트 로컬 1 passed. 실행 뒤 로컬 일기 3편·회고 2편이 유지됨을 SQL로 재확인
- 검증 코드 `daf09e65af675b9f4293ca508ed9dd333142ab8d`의
  [최종 CI 40278025625](https://github.com/thinqsimon/fastapi-langchain-starter/actions/runs/40278025625) 전체 성공:
  백엔드 190 passed(97.84%), 서비스 E2E 55 passed, starter 3 passed, 두 프로필 빌드 통과. 재시도 없음
- 독립 test-verifier가 임시 DB 격리와 최종 CI를 확인해 PASS. 이 완료 기록만의 커밋은 CI 재실행 생략
- 저장소 변경은 INI 주석·테스트 격리·문서이며 앱 기능과 설정값은 유지

**다음 할 일**: 사용자가 로컬 체험 후 실제 LLM 연결과 배포 여부를 결정.
독립된 제3자 Fork 실행·배포 검증(DOC-02)을 완료한 것으로 간주하지 않는다.

---

## 2026-10-26 · 세션 20 · LLM 연동 팀원 인수인계

**최종 사용자 요청**: 실제 LLM 연결은 함께 작업하는 팀원이 담당한다.
현재 구현까지 서비스 브랜치에 정리해 올리고, 담당자가 이어서 연동·실행할 수 있도록 인수인계한다.

**한 일**
- 기능 코드·제공자·모델은 변경하지 않고 `service/diary-coach`를 인수인계 기준으로 유지
- LLM 연결 파일·환경 변수·필요 어댑터·스트리밍/구조화 출력 수동 검증 순서 문서화
- 키 없이 실행하는 절차와 Windows용 18000 API 포트, 프론트엔드 공개 설정 예제 제공
- 테스트 DB 분리 및 자동 테스트의 fake 강제, 기존 회고 snapshot 동작을 안내
- README·샘플앱에서 인수인계 가이드로 연결
- 실제 API 키 입력·저장·외부 LLM 호출은 수행하지 않았다. 개인 PC의 로컬 실행 상태는 유지

**검증**
- 문서 경로·명령·공개 예제 값·비밀 파일 ignore 규칙을 확인했고 `git diff --check` 통과
- 독립 test-verifier가 실행 절차·연동 지점·fake 강제·비밀 파일 제외 규칙을 검토해 PASS
- 인수인계 커밋 `4323d23724fc9a4528ddf88db62afeb6fe0c8e1e`가 원격 서비스 브랜치에 반영됨
- [CI 40280442756](https://github.com/thinqsimon/fastapi-langchain-starter/actions/runs/40280442756) 전체 성공:
  백엔드 190 passed(97.84%)·서비스 E2E 55 passed·starter 3 passed·두 프로필 빌드 통과
- 최종 결과 링크와 이 기록만의 후속 커밋은 CI 재실행 생략. 기능 코드와 공개 설정 예제는 위 검증 대상과 동일

**막힌 점**: 최초 코치 CI는 브라우저 시스템 의존성 다운로드가 5분 제한을 초과해 테스트 전에 실패했다.
실패한 작업만 한 번 재실행했고 설치와 E2E 55개가 모두 통과했다. 앱·테스트·CI 설정 변경은 없었다.

**다음 할 일**: 담당 팀원이 제공자·모델·Base URL·인증을 설정하고 세 LLM 흐름을 실제 호출로 확인한다.
기존 기능 인수조건과 DOC-02 상태는 변경하지 않는다.

## 2026-10-27 · 세션 21 · TEST-01 테스트 계정 정리(하네스)

**요청**: Supabase `users`에 `rag-real-450e87@example.com`이 남아 있는 것을 보고, 테스트 계정이 DB에 쌓이지 않도록
하네스에 반영. 원격의 해당 계정은 사용자가 직접 삭제하기로 함.

**원인 분석**
- 백엔드 pytest는 트랜잭션 롤백이라 안 남는다. 쌓이는 경로는 ① Playwright E2E(매 실행 새 계정, 정리 없음 → 로컬 DB에 512개 누적)
  ② 수동 curl 스모크(`rag-real-*`처럼 서버가 가리키는 DB에 그대로 남음)
- 모든 테스트 계정이 `@example.com`(RFC 2606 예약 도메인)을 쓰고, users 참조 테이블이 전부 `ON DELETE CASCADE`라 users 행 삭제만으로 정리 가능

**한 일**
- `backend/scripts/clean_test_accounts.py` + `scripts/clean-test-accounts.sh` + `make clean-test-accounts`:
  기본 dry-run(목록), `--delete`로 삭제, 원격 DB는 `--remote` 없이는 종료 코드 2로 거부. 비밀번호는 출력하지 않음
- `scripts/e2e.sh` 종료 trap에서 `--delete` 자동 호출(로컬 DB 고정, 실패해도 E2E 결과에 영향 없음)
- `backend/tests/test_test_account_hygiene.py` 6개: E2E·백엔드 테스트의 이메일 도메인 검사, e2e.sh 정리 호출 검사,
  원격 거부 검사(subprocess), dry-run이 지우지 않는지 검사(DB 있을 때)
- 규칙·절차: `docs/conventions.md`, `CLAUDE.md`, `/handoff` 스킬(2단계 추가), `test-verifier` 에이전트, README, usage.md ④
- 로컬 테스트 DB(localhost:5432/app)의 `@example.com` 계정 512개 삭제 후 0개 확인

**검증**
- `./scripts/verify.sh` 전체 통과: 백엔드 196 passed(98%), 프론트 포맷·린트·타입·빌드 통과
- `./scripts/e2e.sh e2e/auth.spec.ts` 5 passed, 실행 전·후 `@example.com` 계정 0개(자동 정리 동작 확인)
- `make clean-test-accounts args="--delete"`에 Supabase 형식 URL을 주면 거부(exit 2) 확인

**막힌 점**: `make db`가 5433 포트 충돌로 실패(`diary-coach-local-db-1`이 점유). 테스트 DB는 이미 5432로 접근 가능해 영향 없음.
원격 Supabase에는 접근하지 않았고 `.env`는 읽지 않았다.

**다음 할 일**
- 사용자: Supabase의 `rag-real-450e87@example.com` 직접 삭제(또는 `make clean-test-accounts args="--delete --remote"`)
- LLM 연동 팀원 인수인계 후속(세션 20의 다음 할 일) 유지

## 2026-10-27 · 세션 22 · NOTE-01 학습장(/study-notes 노트 업로드·주제 관리)

**요청**: 이 세션 앞부분에서 만든 글로벌 스킬 `/study-notes`(`~/.claude/skills/study-notes/`, AI 대화를 초보자용 학습 노트 md로
증분 정리)의 결과물을 배움일기에 올려 주제별로 읽고·고치고·학습 완료를 표시하는 **학습장** 메뉴를 채팅과 일기 사이에 추가.
좌측 주제 목록·우측 본문 편집, CRUD. 사용자 결정: 같은 파일명 재업로드는 409, 완료 토글·유형/태그 편집·직접 작성·완료 필터 포함,
파일(학습장)별 그룹, diary-coach 전용(starter는 404).

**한 일**
- 백엔드 새 도메인 `backend/src/app/domain/notebook/`(models·parser·schemas·repositories·services·routers), Alembic `37929cca196b`
  (`notebooks`·`notebook_topics`), `api.py`의 `diary_enabled` 블록에 지연 등록, `main.py` 태그, import-linter containers.
  파서는 펜스(```/~~~) 인식, `## 목차` 제외, 번호 선택, 메타 줄 → 유형·태그·난이도 후 본문에서 제거, H2 없으면 주제 1개, 빈 파일 400
- 프론트 `app/(main)/notebook/`, `components/notebook/` 5개, `store/notebook.ts`(세대·조회·주제 버전 가드), `api/notebook.ts`,
  메뉴(`lib/application.ts`)·`proxy.ts` 게이팅, 사용자 전환 시 reset. 업로드는 브라우저가 읽은 파일을 JSON으로 전송(multipart 없음)
- 테스트: 파서 단위 20개, API 20개(401 9경로·분할·409·400·422·CRUD·cascade·타인 404·경합), 프로필·테이블 목록 테스트 갱신,
  E2E `e2e/notebook.spec.ts` 7개, `starter-profile.spec.ts`에 /notebook·/api/notebooks 404 추가
- 문서: ADR-0010, 샘플 README(사용 흐름 8·변경 표 2행), application-profiles 가이드, `feature_list.json` NOTE-01(phase 8)

**검증**
- `./scripts/verify.sh`: 백엔드 236 passed(커버리지 98%), 프론트 포맷·린트·타입·빌드 통과
- E2E: diary-coach 62 passed(학습장 7·캐치프레이즈 3 포함, 헤더 링크 3개여도 정렬 회귀 없음), starter 3 passed
- 실제 노트 `~/StudyNotes/SpaceXyzDiary/2026-10-27_01.md` 수동 업로드(개발 서버 :3000/:8000): 주제 8개, 목차 제외, 코드 블록 안
  `---`·`## ` 보존, 메타 줄 제거, 필터 끝낸 것 1/공부할 것 7/전체 8, 390px 한 창씩·가로 넘침 없음, 콘솔 오류 0.
  계정 `note-check-*@example.com`은 로컬 5433 DB에서 삭제
- 독립 test-verifier 검토: 인수조건 8개 모두 PASS(8번은 프론트 게이트 로그 확인 후 확정). 지적한 파서 개선점(닫는 펜스는 여는 펜스와
  같은 문자·같거나 긴 길이, CommonMark)을 반영하고 테스트 2개를 추가해 백엔드 게이트 재통과(236 passed, 98%)

**막힌 점**
- 문제: `make migrate`가 **원격 DB(Supabase)** 에 적용됐다. 원인: `backend/.env`의 `DATABASE_URL`이 Supabase 풀러이고
  `alembic/env.py`가 `settings.DATABASE_URL`을 그대로 쓴다(이전 세션은 `.env`를 읽지 않아 대상 DB를 몰랐다). 해결: 추가 전용
  마이그레이션(빈 테이블 2개)이라 데이터 영향 없음. 원격은 더 건드리지 않고 사용자 결정에 맡김(되돌리려면
  `cd backend && uv run alembic downgrade e317b6a91d42`). 개발 서버가 쓰는 로컬 5433과 테스트용 5432에는 각각 적용.
  재발 방지: `make migrate`/`migration`에 `clean-test-accounts`처럼 원격 URL이면 거부하는 가드(`--remote` 필요) 추가 필요
- 문제: Next 16이 같은 폴더에서 두 번째 `next dev`(:3100)를 거부해 `e2e.sh`가 실패. 원인: 사용자 개발 서버(:3000)가 dev 락을
  보유, 다른 사람 프로세스 종료는 권한 정책상 불가. 해결: 프로필별 `next build`(`NEXT_PUBLIC_API_BASE_URL=:8010`) 후
  `next start -p 3100`을 띄우고 Playwright `reuseExistingServer`로 통과. 재발 방지: e2e.sh에 "개발 서버가 떠 있으면 빌드·start 재사용"
  분기 검토
- ruff E501은 한글을 2칸으로 세므로 긴 한글 docstring·description은 줄바꿈이 필요하다

**다음 할 일**
- 사용자: 원격 DB의 `notebooks`·`notebook_topics` 유지(배포 시 그대로 head) 또는 되돌리기(위 downgrade 명령) 결정
- `make migrate` 원격 가드, e2e.sh 개발 서버 공존 처리
- 학습장 개선 후보: 같은 파일 덮어쓰기 옵션, 주제 순서 바꾸기, `~/StudyNotes/index.md` 가져오기
- DOC-02·TEST-01 passes는 바꾸지 않았다(TEST-01은 세션 21 검증 기록이 있으나 false로 남아 있어 확인 후 갱신)

## 2026-10-28 · 세션 23 · NOTE-02 학습장 중복 파일명(스킬 접두사·프로젝트별 유일 기준)

**요청**: 한 프로젝트의 `2026-10-27_01.md`를 올린 뒤 다른 프로젝트의 같은 이름 노트를 올리면 409로 거부됨(스크린샷). 사용자는 "스킬 쪽에서
파일명에 프로젝트명을 넣어 덜 겹치게" 하는 방향을 제시하고 스킬 저장 폴더 구조 확인을 먼저 요청.

**원인 분석**
- `/study-notes`(원본 git 저장소 `~/Documents/claude-study-notes`, `~/.claude/skills`·`~/.codex/skills`는 복사본)는 모든 프로젝트의 노트를
  `<프로젝트>/YYYY-MM-DD_NN.md`로 만들어 폴더만 다르고 파일명이 같다. 앱의 유일 제약은 `(user_id, filename)`이라 다른 프로젝트까지 막았다
- 기존 노트 이름을 바꾸면 `index.md` 링크와 `.state/*.json`의 파일 목록이 깨지므로 기존 파일은 그대로 두기로 결정

**한 일**
- 스킬 v1.3.0(커밋 `4645368`, push 안 함): `next_note_path`가 `<프로젝트>_YYYY-MM-DD_NN.md`를 만들고 같은 날의 옛 이름도 세어 NN을 이어 붙임,
  `safe_name`으로 파일명 금지 문자 치환, README·plugin.json 갱신, 복사본 2곳 동기화(`--delete` 없이 파일 3개 복사)
- 앱: 유일 제약을 `(user_id, project, filename)`(`uq_notebooks_user_project_filename`)으로 교체(Alembic `4ff89a5fba71`),
  `get_by_project_filename`, 서비스는 `project`가 있을 때만 409("같은 프로젝트의 같은 파일을 이미 올렸습니다…"), 일반 md는 항상 추가.
  그룹 부제에 프로젝트명 표시. 테스트 2개 추가(다른 프로젝트 같은 파일명 201, project 없는 md 반복 201), E2E 시나리오 2 확장
- 문서: ADR-0010 저장 정책 갱신, 샘플 README, feature_list NOTE-02 추가 + NOTE-01 3번 문구 조정(계획 승인으로 확정)

**검증**
- `./scripts/verify.sh` 백엔드 238 passed(98%), 프론트 통과. E2E diary-coach 62 passed(학습장 7 포함), starter 3 passed
- 개발 서버(:3000/:8000, 로컬 5433)에 세 프로젝트의 `2026-10-27_01.md`를 모두 업로드: 주제 8·12·8개, 그룹 3개가
  "프로젝트 · 파일명 · 완료 n/m"으로 표시, 같은 파일 재업로드는 409. 계정은 5433에서 삭제
- 마이그레이션은 로컬 5432·5433에만 적용. **원격 DB는 `37929cca196b`에 머물러 있다**(세션 22 결정 보류 중). 배포 시 `4ff89a5fba71`이 함께 적용된다

**막힌 점**
- 문제: `rsync -a --delete`로 스킬 복사본을 동기화하려던 명령이 권한 정책("되돌릴 수 없는 삭제")에 막힘. 해결: 파일 3개를 `cp`로 덮어쓰고
  `diff -rq`로 동일 확인. 재발 방지: 복사본 동기화는 삭제 옵션 없이
- 문제: 학습장 스펙 실행 직후 전체 E2E를 시작하자 "포트 8010이 이미 사용 중" 실패. 원인: 앞 실행의 백엔드 종료가 끝나기 전에 시작.
  해결: 재실행. 재발 방지: e2e.sh 연속 실행 사이에 포트 해제 확인(`lsof -ti tcp:8010`)
- E2E는 세션 22와 같이 사용자 개발 서버(:3000)가 떠 있어 프로덕션 빌드를 :3100에 띄워 재사용했다

**후속(같은 날)**: 사용자 요청으로 스킬 저장소(`main` `4645368`)와 앱 `feat/note-02`를 push. 원격 DB 적용은 권한 정책(운영 배포)에 막혀
사용자가 직접 `uv run alembic upgrade head`를 실행해 `4ff89a5fba71 (head)`를 확인했다. 세션 22의 원격 DB 보류 결정은 "유지"로 종결.

**다음 할 일**
- `make migrate` 원격 가드, e2e.sh 개발 서버 공존·포트 해제 대기(세션 22 후속)

## 2026-10-28 · 세션 23 후속 · NOTE-03 학습장 목록 너비 끌어서 조절

**요청**: 학습장 주제 목록과 본문 사이를 드래그해 목록을 넓히거나 좁힐 수 있게.

**한 일**: `store/notebook.ts`에 `listWidth`(220~640px, localStorage `notebook_list_width`, `reset()`에도 유지)와
`restoreListWidth`·`setListWidth`·`resetListWidth` 추가. `app/(main)/notebook/page.tsx`에 `role="separator"` 손잡이
(`data-slot="notebook-resizer"`, 포인터 캡처 드래그, 화살표·Home·End 키, 더블클릭 기본값, 본문 최소 320px 보장,
md 미만에서는 숨김). 너비는 CSS 변수 `--notebook-list-width`로 `md:w-[var(...)]`에만 적용해 모바일 `w-full`을 유지.
E2E `notebook.spec.ts`에 넓은 화면 시나리오 추가(끌기 → 새로고침 유지 → 키보드 → 더블클릭).

**검증**: `./scripts/verify.sh frontend` 통과, 학습장 E2E 8 passed(새 시나리오 포함), 개발 서버에서 끌어 넓힌 화면 캡처.
E2E는 세션 22·23과 같이 프로덕션 빌드를 :3100에 띄워 재사용했다.

## 2026-10-28 · 세션 24 · NOTE-04 학습장 보관함(주제 골라 보관, 보관함 보기)

**요청**: 시간이 없을 때 노트를 일단 올려 두고(스테이지), 나중에 공부할 주제만 전체/부분 선택해 '보관' 표시하고 보관함 보기로 모아 공부.
결정: 이름 '보관/보관함'(편집 '저장'과 구분), 마지막 보기 기억, '선택' 버튼으로 체크박스 전환.

**한 일**
- 백엔드: `NotebookTopic.kept`·`kept_at`(Alembic `00bdfc2e5cd9`, 로컬 5432·5433 적용, 원격은 사용자 실행 안내), `TopicUpdate.kept`,
  `PATCH /api/notebooks/topics/keep {topic_ids, kept}`(`/topics/{id}`보다 먼저 선언, 하나라도 남의 것이면 404로 전체 거부), 테스트 3개 추가
- 프론트(frontend-dev 에이전트): 스토어 `view`(localStorage `notebook_view`)·선택 상태·`keepSelected`/`toggleKept`, `restorePreferences`,
  목록 헤더 보기(전체/보관함 N)·상태 칩(공부할 것/끝낸 것 토글)·`선택`, 그룹 '모두 선택'(indeterminate)·행 체크박스, 하단 막대(N개 선택·보관·보관 해제·취소, Esc),
  본문 툴바 보관/보관 해제·메타 '보관됨', 책갈피 아이콘·`data-kept`. E2E 보관 시나리오 추가, 시나리오 3 상태 칩 수정, 390px 선택 막대 확인
- 레이아웃 버그 수정(본 AI): `body`가 `min-h-full`이라 본문이 길면 왼쪽 목록 칸이 본문 높이(1552px)까지 늘어나 하단 막대가 화면 밖으로 나갔다.
  `sticky`는 `main`의 `overflow-hidden` 때문에 창 스크롤에 반응하지 않아 실패. 최종: 넓은 화면에서 페이지 루트를
  `h-[calc(100dvh-var(--notebook-top))]`(ref로 상단 위치 측정, resize 시 재측정)로 묶어 목록·본문이 각각 안에서 스크롤. 모바일은 그대로 문서 스크롤
- 문서: ADR-0010 보관 항목·API, 샘플 README, feature_list NOTE-04(passes)

**검증**
- `./scripts/verify.sh` 백엔드 241 passed(98%), 프론트 통과. E2E 학습장 9(보관·너비 조절 포함)·전체 64·starter 3 passed, 수정 후 학습장+반응형+캐치프레이즈 19 passed
- 개발 서버에서 실제 노트(주제 8개) 선택 2개 → "주제 2개를 보관했어요." → 보관함 2 → 새로고침 유지 → 보관 해제 → 1 → 전체 8. 콘솔 오류 0.
  측정: 목록 칸 710px(뷰포트 안), 하단 막대 보임, 문서 스크롤 0

**막힌 점**: 위 레이아웃 버그(NOTE-01부터 있었으나 본문이 짧은 테스트에선 드러나지 않음). 재발 방지: E2E에 "선택 막대가 뷰포트 안"(390px)과
데스크톱 측정 스크립트. 다른 화면(채팅·일기)도 같은 구조라 긴 본문에서 문서 스크롤이 되는지 확인할 가치가 있다(이번 범위 밖)

**다음 할 일**
- 사용자: 원격 DB `cd backend && uv run alembic upgrade head` (`4ff89a5fba71` → `00bdfc2e5cd9`)
- 채팅·일기 화면의 높이 제한 구조 점검(선택)

## 2026-10-28 · 세션 24 후속 · NOTE-04 보기에 '신규' 추가

**요청**: 보기 모드에 보관함에 없는 주제만 보는 '신규'를 추가하고 순서를 신규/전체/보관함으로.
**한 일**: `NotebookView`에 `"new"` 추가(신규 = `kept === false`), 보기 버튼 순서 신규·전체·보관함(신규·보관함에 개수 표시), 신규/보관함 보기에서는
해당 주제가 있는 학습장만 표시, 빈 상태 문구 분리. 보관함 보기에서 파일을 올리면 신규 보기로(신규·전체 보기는 유지). E2E 보관 시나리오에 신규 보기 확인 추가.
feature_list NOTE-04 2·3번 문구, ADR-0010, 샘플 README 갱신.
**검증**: `./scripts/verify.sh frontend` 통과, 학습장 E2E 9 passed.

## 2026-10-28 · 세션 25 · NOTE-05 학습장 업로드 검증(스킬 노트만 허용)

**요청**: 스킬로 만든 노트가 아닌 파일이 올라가지 않는지 확인 → 확인 결과 회의록 md·txt·json이 모두 201로 올라갔고 NUL 포함 내용은 500. 사용자가 "스킬 노트만 받도록 검증" 승인.
**한 일**: 파서 `strict` 모드(frontmatter title·project, `## 주제` 1개 이상, `유형`/`태그` 메타 줄 1개 이상 없으면 400), NUL 포함 내용은 모드와 무관하게 400,
빈 내용 검사를 파싱 앞으로. 서비스에서 `.md`/`.markdown` 확장자만 허용(400). 화면 스토어에서 확장자 사전 검사(한국어 메시지). 올리기 버튼 title 안내,
`도움말` 버튼 + "학습장 사용 안내" 창(`components/notebook/notebook-help.tsx`: 올릴 수 있는 파일·스킬 링크·보기·보관·완료·너비 조절). 파서 테스트 3개·API 파라미터 테스트 7건 추가,
E2E 시나리오에 확장자·비스킬 md 거부·도움말 창 확인 추가. feature_list NOTE-01 3번·NOTE-02 3번 문구 조정, ADR-0010, 샘플 README.
**검증**: `./scripts/verify.sh` 백엔드 233 passed(98%), 프론트 통과. 학습장 E2E 9 passed. `~/StudyNotes`의 실제 노트 6개 전부 201(주제 8·8·16·7·8·12개), txt·README.md는 400.
**다음 할 일**: 보기 탭·상태 칩·보관/완료 변경 시 열린 주제가 목록에서 사라지면 오른쪽도 비우는 동기화 정책(사용자 요청, 바로 이어서 진행).

## 2026-10-28 · 세션 25 후속 · NOTE-04 목록·본문 동기화 정책

**요청**: 보기 탭(신규/보관함)을 바꿔도 오른쪽에 선택되지 않은 주제의 본문이 남아 있어 목록과 본문이 따로 놂.
**정책**: 보기 탭·상태 칩 변경, 보관/완료 토글, 일괄 보관으로 열린 주제가 현재 목록에서 사라지면 오른쪽도 비우고 "왼쪽에서 주제를 고르세요"를 보여 준다.
목록에 남아 있으면 그대로 둔다(모바일에서 탭을 누르자마자 본문으로 튀지 않게 자동 선택은 하지 않음).
**한 일**: `store/notebook.ts`에 `reconcileSelection`(열린 주제가 `visibleTopics`에 없으면 `clearSelection`)을 두고 `setView`·`setFilter`·`toggleKept`·`toggleCompleted`·`keepSelected`에 적용.
E2E: 보관 주제를 연 채 신규 보기로 바꾸면 본문이 비는지, 보관 해제·공부할 것 칩 적용 뒤 본문이 비는지 확인(기존 두 시나리오의 기대값 조정).
**검증**: `./scripts/verify.sh frontend` 통과, 학습장 E2E 9 passed.

## 2026-10-28 · 세션 25 후속 2 · NOTE-04 조건에 맞는 주제가 없는 학습장 숨김

**요청**: 상태 칩(끝낸 것 등)을 켰을 때 주제가 하나도 없는 학습장 머리글이 "주제가 없습니다"와 함께 줄줄이 남음.
**정책**: 보기(신규/보관함)나 상태 칩이 하나라도 걸려 있으면 보이는 주제가 없는 학습장은 머리글째 숨긴다. 아무 조건도 없는 전체 보기에서만
빈 학습장을 보여 준다(새로 만든 학습장에 주제를 추가할 수 있게). 모두 숨겨지면 조건별 안내 문구(상태 칩/보관함/신규)를 보여 준다.
**한 일**: `notebook-list.tsx`의 `shown`을 `visibleTopics(topics, view, filter)` 기준으로 통일. E2E 시나리오 3의 기대값(머리글 0개 + 안내 문구) 조정.
**검증**: `./scripts/verify.sh frontend` 통과, 학습장 E2E 9 passed.

## 2026-10-30 · 세션 26 · 헤더 고정 수정(af518f0) 서비스 브랜치 반영

**요청**: `2nd_Sample` 세션의 핸드오프(`../handoff-to-SpaceXyzDiary.md`) 1번. 스타터킷 쪽 커밋 `af518f0`(대화가 길어지면 헤더가 밀려나던 문제)을 `service/diary-coach`에 가져오기.
**한 일**
- `git cherry-pick af518f0` → `8a6a651`(충돌 없음). `(main)/layout.tsx`가 `h-dvh` 컨테이너로 고정되고 `main`에 `min-h-0`
- 핸드오프 4번 확인 중 실제 회귀 발견: 화면 높이가 고정되자 설정·일기 화면의 세로 flex 안 카드들이 줄어들며 잘려 스크롤할 내용이 사라짐
  (390×500에서 설정의 '계정 정보' 카드가 이메일 입력에서 끊김). 두 페이지 루트에 `min-h-0 flex-1 *:shrink-0` 추가. 학습장은 이미 자체 높이 고정·스크롤 구조라 변경 없음
- E2E `responsive.spec.ts`에 "화면 높이가 낮아도 설정·일기 내용이 잘리지 않고 안쪽에서 스크롤" 추가(설정은 늦게 불러와 높이가 바뀌므로 스크롤·확인을 `toPass`로 재시도)
**검증**: `./scripts/verify.sh` 전체 통과(백엔드 233 passed), 수정 후 프론트 통과. E2E diary-coach 66 passed, starter 3 passed.
짧은 화면 측정(1280×600, 390×640): 학습장·일기·설정 모두 문서 스크롤 없음, 헤더 top 0, 안쪽 영역 끝까지 도달. 설정 390×500: 수정 전 버튼 도달 불가 → 수정 후 도달
**막힌 점**: 새 E2E가 한 번 실패 — 설정 데이터 로딩 후 높이가 바뀌어 스크롤 직후 위치가 밀림. 재발 방지: 레이아웃 단언은 스크롤과 함께 재시도
**다음 할 일**: push(사용자 확인 대기). `4de3bd7`(발표 자료·STUDY-01 계획)·`f12ddd5`(docs/pt 추적 제외) 문서 커밋은 가져오지 않음 — 필요하면 사용자 결정

## 2026-10-30 · 세션 27 · ADMIN-01 관리자 서버 설정(공급자 키·우선순위·자동 전환·강제 사용)

**요청**: siungryu@gmail.com 관리자로 로그인하면 계정 메뉴의 '설정' 위에 **서버 설정** 버튼. 그 화면에서 OpenAI뿐 아니라 Gemini·Claude API 키와 모델을 각각 설정하고,
우선순위대로 쓰다가 토큰이 소진되면 다음 모델로 자동 전환, 필요하면 특정 키·모델을 강제로 쓰기.
**사용자 결정**: 관리자 판별은 설정 파일 이메일 목록(`ADMIN_EMAILS`, DB 컬럼 없음). 소진 판단은 호출 시 실제 오류(429 등)로 → 다음 공급자 재시도.
**한 일**
- 백엔드 `domain/admin/`: `llm_provider_settings`(공급자당 1행, Fernet 암호화 키, priority/enabled/forced, forced는 부분 유니크 인덱스로 1행만).
  `GET/PATCH /api/admin/llm-providers[/{provider}]`(보낸 필드만 변경, 응답은 `has_api_key`만). `AdminUser` 의존성(403). `/auth/me`에 `is_admin` 계산 필드
- `llm/providers.py`: `get_chat_model(provider, model, api_key)` 인자화 + `ProviderAttempt`. `.env`가 fake면 무엇을 등록했든 fake 반환(테스트·E2E 안전장치)
- `llm/chains/chat.py`·`diary.py`: `providers` 목록을 순서대로 시도, 실패하면 다음(스트리밍은 첫 글자 뒤에는 전환 안 함), 전부 실패 시 `LLMError`
- `AdminLlmSettingsService.active_provider_chain()`: 강제 1개 → 우선순위 목록 → 비면 `.env` 기본. 복호화 실패 행은 건너뜀. chat/diary 서비스가 호출부에 넘김
- 설정 `ADMIN_EMAILS`, `SETTINGS_ENCRYPTION_KEY`(+`.env.example`, README). 의존성 `cryptography`, `langchain-anthropic`, `langchain-google-genai`
- 마이그레이션 `9f11c3af7799`(로컬 5433·5432 적용, `alembic check` 통과). **원격 DB는 미적용**
- 프론트: `api/admin.ts`, `store/admin.ts`, `app/(main)/admin/page.tsx`, `components/admin/server-settings.tsx`(지금 동작 요약 + 공급자 카드 3개: 모델·키·우선순위 저장, 사용 켜기/끄기, 강제 사용/해제, 키 지우기),
  계정 메뉴에 `is_admin`일 때만 '서버 설정' 버튼(설정 위)
- 테스트: `tests/api/test_admin.py` 11개, `tests/test_llm_failover.py` 4개(기존 mock 2곳에 `**kwargs` 허용, 스키마 목록에 테이블 추가). E2E `e2e/admin.spec.ts` 3개(`e2e.sh`에 `ADMIN_EMAILS`·테스트용 암호화 키).
  ADR-0012, feature_list ADMIN-01(phase 9)
**검증**: `./scripts/verify.sh` 백엔드 248 passed(97.9%), 프론트 통과. E2E diary-coach 69개 중 admin 3 포함 68 passed + `coach.spec` 1건 타이밍 플레이크(재실행 10/10), starter 3 passed
**배포(사용자)**: Render는 `preDeployCommand`로 `alembic upgrade head`를 돌리므로 push만 하면 테이블이 생긴다. 서버 설정 화면을 쓰려면 Render 환경 변수
`ADMIN_EMAILS=siungryu@gmail.com`, `SETTINGS_ENCRYPTION_KEY=<python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())">`를 넣고 재배포.
두 값이 없어도 앱은 예전과 같이 동작한다(관리자 없음, `.env` 공급자 하나)
**다음 할 일**: 사용자가 실제 Gemini/Claude 키로 수동 확인(모델 ID는 화면에서 자유 입력). 필요하면 공급자별 사용량 표시·한도 입력(선제 차단)은 ADR-0012 대안 참고

## 2026-10-30 · 세션 27 후속 · Vercel Hobby 함수 12개 제한으로 배포 실패 → 루트 페이지 제거

**증상**: `9a7d743` 푸시 뒤 Vercel(diary-coach) 배포 실패 "No more than 12 Serverless Functions can be added to a Deployment on the Hobby plan". 빌드는 성공, 함수 수에서 막힘. `/admin` 페이지가 13번째.
**조치**: `app/page.tsx`(로그인 여부로 /chat·/sign-in 보내던 클라이언트 페이지)를 지우고 `proxy.ts`에서 `/` → `/chat` 리다이렉트. 비로그인은 `/chat`의 RequireAuth가 `/sign-in`으로 보내므로 동작은 같다.
**주의**: 이제 페이지 수가 다시 한도(12)에 딱 맞는다. **다음에 페이지(라우트)를 하나라도 추가하면 Vercel 배포가 또 실패한다.** 새 화면은 기존 라우트 안에서(쿼리·탭) 만들거나, `manifest.ts`를 정적 파일로 바꾸거나, Vercel Pro로 올려야 한다.
**진짜 원인(후속)**: 함수 13개의 정체는 Next 페이지가 아니라 **`frontend/api/` 폴더**였다. Vercel은 프로젝트 루트의 `api/` 폴더를 서버리스 함수로 자동 배포한다
(axios 모듈 10개 = 함수 10개 + Next 기본 2개 = 12개로 한도에 딱 걸려 있었고, `api/admin.ts`가 13번째). 로컬 `vercel build`로 `.vercel/output/functions`를 확인해 찾았다.
**조치**: `frontend/api/` → `frontend/lib/api/`로 이동, 임포트 `@/api` → `@/lib/api`. 이제 함수는 Next 기본 몇 개뿐이라 페이지를 늘려도 한도와 무관하다. 루트 페이지 제거(proxy 리다이렉트)는 그대로 둔다.
**정정(배포 후 확인)**: Render의 `preDeployCommand`가 원격 DB에 마이그레이션을 적용하지 **않았다**(Supabase에 `llm_provider_settings` 없음 — 무료 인스턴스는 pre-deploy 미지원으로 보임).
원격 마이그레이션은 이전처럼 사용자가 `cd backend && uv run alembic upgrade head`(.env = Supabase)로 직접 돌려야 한다. 새 백엔드가 떠 있는데 테이블이 없으면 채팅·일기 요청이 실패하므로 **푸시 직후 바로** 돌린다.
또한 로컬 `make dev-backend`도 `.env`의 Supabase를 바라본다(5433이 아님).
**재정정**: DB가 **두 개**다. 로컬 `.env`의 Supabase(ap-southeast-2 pooler)는 로컬 개발용이고, Render 백엔드는 **다른 DB**를 쓴다
(같은 이메일의 계정 가입일이 로컬 10/26·운영 10/19로 다르고, 운영 백엔드로 만든 @example.com 계정이 .env DB에는 없다).
Render는 `preDeployCommand`로 자기 DB에 마이그레이션을 적용한다(원래 설명이 맞았다). 위에서 돌린 `uv run alembic upgrade head`는 .env DB(로컬 개발용)에 적용된 것이고, 그것도 필요한 일이었다.
운영 DB의 서버 설정 값은 로컬에서 읽을 수 없다 → dc.1pk.kr/admin의 "지금 동작" 카드로 확인한다.

## 2026-10-30 · 세션 28 · ADMIN-02 관리자가 사용자 계정으로 테스트(오류 재현)

**요청**: 사용자가 오류를 신고하면 관리자가 그 계정으로 들어가 테스트. 결정: 쓰기 허용(재현에 필요)·삭제/계정 변경만 차단, 감사 기록은 서버 로그, 화면·버튼 이름 "관리자".
**한 일**
- `core/security.py`: 액세스 토큰에 `act`(행위자 관리자 id) 클레임. `create_access_token(actor=, expires_minutes=)`, `decode_access_claims()` 추가(기존 `decode_access_token`은 그대로)
- `auth/dependencies.py` `get_current_user`: `act`가 있으면 모든 DELETE와 `/api/auth/*` 쓰기를 403 "테스트 중에는 삭제·계정 변경을 할 수 없습니다."로 막고, 쓰기 요청은 `admin_test_write` 로그. 로그아웃 엔드포인트는 CurrentUser를 쓰지 않아 차단 대상이 아님(프론트가 테스트 토큰을 먼저 버린다)
- `domain/admin`: `GET /api/admin/users?q=`(이메일·이름 부분 일치, `UserRepository.search`), `POST /api/admin/users/{id}/acting-token`(리프레시 없음, `ADMIN_TEST_TOKEN_EXPIRE_MINUTES`=60, 자기 자신 400, 없음/비활성 404, `admin_test_started` 로그). 라우터 prefix `/admin`으로 통합
- 프론트: `tokenStorage.acting/actingAdmin/current`(테스트 토큰 별도 저장, 요청은 `current` 사용. **채팅 스트리밍 fetch도 `current`를 쓰게 수정** — 처음엔 관리자 토큰을 그대로 써서 대상 대화를 못 찾는 버그가 E2E에서 잡혔다). 테스트 토큰 401이면 재발급 대신 `auth:acting-ended` 이벤트 → 관리자 계정 복귀.
  `store/auth.ts` `acting`/`startActing`/`stopActing`(계정 바뀔 때 chat·notebook·diary·learning 스토어 reset, preferences clear), 새로고침 복원.
  `/admin` 제목 "관리자" + `components/admin/user-lookup.tsx`(검색 → 이 계정으로 테스트) + 아래 "LLM 공급자" 구역. `components/acting-banner.tsx`를 `(main)/layout.tsx` 헤더 아래에. 계정 메뉴 버튼 "관리자"(ShieldCheck)
- 테스트: `tests/api/test_admin_acting.py` 4개(공용 fixture는 `tests/api/conftest.py`·`accounts.py`로 이동), E2E `admin.spec.ts`에 대상 사용자 대화 보기·메시지 보내기·삭제 403·돌아가기·사용자 재로그인 확인 시나리오. ADR-0013, feature_list ADMIN-02, `.env.example`
**검증**: `./scripts/verify.sh` 백엔드 252 passed(97.9%), 프론트 통과. E2E admin 4 + auth·account·chat·coach 통과(아래 전체 실행 결과 참고)
**운영 적용**: push하면 Vercel·Render 자동 배포. 새 테이블 없음(마이그레이션 없음). `ADMIN_TEST_TOKEN_EXPIRE_MINUTES`는 기본 60이라 환경 변수 추가 없이 동작
**남은 것**: 테스트 중 만든 대화·일기는 사용자 계정에 남는다 → 필요하면 "테스트 흔적 정리" 기능(ADR-0013 주의 참고). 사용량·비용 표시는 여전히 .env 모델 기준(ADMIN-01 후속)

## 2026-10-30 · 세션 28 후속 · 채팅 상단 버튼을 '사용법 동영상 열기'로, 일기 만들기는 입력칸 + 메뉴로

**요청**: 코치 채팅 상단의 '이 대화로 일기 만들기' 버튼 자리를 **사용법 동영상 열기**(유튜브 클립 아이콘, https://youtu.be/MH6wL-0Qui0 새 탭/기본 앱)로 바꾸고,
'이 대화로 일기 만들기'는 Claude 앱처럼 입력칸 앞 **+ 버튼 메뉴**의 항목으로.
**한 일**: `chat-experience.tsx`에서 초안 로직을 `useDiaryDraftAction()`으로 빼고 `CoachChatHeader`(동영상 링크 `<a target=_blank>` + 초안 진행 상태 문구)와
`CoachComposerMenu`(+ 버튼, shadcn `dropdown-menu` 새로 추가: '이 대화로 일기 만들기'(답변 전엔 비활성 + 안내), '사용법 동영상 열기')로 분리. 초안 생성 중에는 + 버튼이
"일기 초안 만드는 중…"(스피너·비활성)이 되어 기존 E2E 기대를 유지. `MessageInput`에 `leading` 슬롯, `applications/components.tsx`에 `ApplicationComposerMenu`(스타터는 없음).
lucide 1.x에는 브랜드 아이콘(Youtube)이 없어 `SquarePlay`(빨간색) 사용. 문서 3곳(usage·llm-handoff·샘플 README) 갱신.
**검증**: `./scripts/verify.sh frontend` 통과. E2E coach 10(동영상 링크 href/target 검증 추가)·chat·responsive 22 passed.

## 2026-10-31 · 세션 29 · LLM-02 공급자별 응답 형태 정규화 + 답변마다 공급자·모델 기록

**요청**: 운영에서 Gemini 답변이 `[{'type': 'text', 'text': ...}]` 리스트 원문으로 보임. 공급자마다 다른 응답 형태를 감안해 모든 모델에서 정상 문장이 나오게.
**결정(사용자)**: 과거에 깨진 채 저장된 메시지는 복구하지 않음. 답변마다 공급자·모델을 저장해 표기·비용 계산에 쓰는 것까지 포함.
구독제(free/pro/max)별 모델 라우팅은 **다음 기능(ADMIN-03)**으로: 요금제마다 공급자 순서·모델 전부 따로(`llm_providers` 키 / `llm_plan_routes` 라우트 분리),
`users.plan` 추가 + 관리자 수동 지정, `messages.plan` 기록, 라우트 없으면 free → .env 캐스케이드. 설계는 ADR-0012 마지막 절에 기록.
**한 일**
- `llm/chains/chat.py`: `text_of(content)` — 문자열/블록 리스트 모두 텍스트 블록만 이어 붙임(서명·thinking·tool 블록 제외). `on_model` 콜백으로 첫 청크 때 실제 답한 공급자·모델(`ModelInfo`) 알림
- `messages.provider/model` 컬럼(마이그레이션 `9d1e9326fa28`, 로컬 5433·5432 적용). `MessageRead`에 노출. chat 서비스가 저장
- usage: `totals_by_model` 집계 → `UsageSummary.by_model`, 총비용은 모델별 단가 합. `.env` 단가는 `.env` 모델에만 적용. pricing 표에 Gemini 2.0/2.5·gpt-4.1 추가
- 프론트: `lib/llm-labels.ts`(공급자 표시명, fake는 "테스트 응답"), 답변 말풍선 아래 `data-slot="message-model"` 표기, 사용량 배지 툴팁에 모델별 내역
- 테스트: `tests/test_llm_text.py`(Gemini·Claude 형태 + 스트림 통합 + 기본 공급자 기록) 6개, `tests/api/test_message_model.py` 2개. E2E `model-label.spec.ts`. feature_list LLM-02, ADR-0012 후속 절
**막힌 점**: 중단된 실행이 마이그레이션을 먼저 만들어 두 번째 autogenerate가 빈 리비전(`e5ba…`)을 만들었다 → 두 DB를 `9d1e9326fa28`로 내리고 빈 파일 삭제, `alembic check` 통과.
E2E는 새로고침 뒤 대화가 자동 선택되지 않아 목록에서 다시 열도록 수정.
**검증**: `./scripts/verify.sh` 백엔드 260 passed(97.9%), 프론트 통과. E2E chat·coach·admin 18 passed + model-label(수정 후 재실행).
**운영 적용**: push → Render가 배포 전 마이그레이션 적용(컬럼 2개 추가, nullable). 환경 변수 추가 없음.

## 2026-10-31 · 세션 30 · ADMIN-03 요금제(free/pro/max)별 LLM 라우팅 + 사용자 요금제 지정

**요청**: 향후 구독제(free/pro/max)를 감안해 서버가 요금제별로 다른 모델을 적용하도록 설계·구현. 결정(사용자): 요금제마다 공급자 순서·모델 전부 따로, `users.plan` + 관리자 수동 지정, A(LLM-02) 먼저 배포 후 B 진행.
**한 일**
- `core/plans.py`(PlanName/PLANS/DEFAULT_PLAN). 모델 분리: `llm_providers`(공급자 키) / `llm_plan_routes`(plan·priority·provider FK·model·enabled·forced, 요금제당 강제 1행 부분 유니크). `users.plan`(기본 free), `messages.plan`.
  마이그레이션 `804e78cdbab8`: 기존 `llm_provider_settings` → 키는 providers로, 모델·순서·사용·강제는 free 라우트로 이전 후 테이블 삭제(downgrade는 free 첫 라우트 기준 복원)
- `AdminLlmSettingsService`: 키 저장/삭제, 라우트 CRUD(요금제 안 순서, forced 배타), `active_provider_chain(plan)`: 요금제 라우트 → free → .env 캐스케이드, 복호화 실패 건너뜀.
  `AdminUserService.set_plan`(로그 `admin_plan_changed`). chat/diary 라우터가 `current_user.plan`을 넘기고 답변에 plan 기록
- API: `GET/PATCH /admin/llm-providers`, `GET/POST /admin/llm-routes`, `PATCH/DELETE /admin/llm-routes/{id}`, `PATCH /admin/users/{id}/plan`. `/auth/me`·관리자 사용자 응답에 `plan`
- 프론트: `store/admin.ts`(키·라우트·순서 바꾸기), `server-settings.tsx` 재작성(요금제별 '지금 동작', 공급자 키 카드, Free/Pro/Max 탭 라우트 목록+추가), `user-lookup.tsx`에 요금제 select, 계정 메뉴에 요금제(Free/Pro/Max), `lib/llm-labels.ts`에 PLANS/planLabel
- 테스트: `test_admin.py` 재작성(키·라우트·검증·체인 캐스케이드), `test_admin_plan.py`(요금제 지정 + fake에서도 라우트 선택이 메시지에 기록됨), 기존 테스트 갱신. E2E `admin.spec.ts` 재작성(키→라우트→강제→순서→Pro 캐스케이드→새로고침→삭제, 요금제 select→테스트 계정에서 Pro 표시)
- 중간에 CI만 실패하던 원인 수정: Playwright가 `next dev`로 띄운 서버의 **N 배지(dev indicator)**가 390px에서 입력칸 왼쪽 + 버튼을 덮어 클릭을 가로챔 → E2E 서버에만 `NEXT_HIDE_DEV_INDICATORS=1`로 끔(`b4d4c62`). 그 뒤 CI 통과·Render에 LLM-02 반영 확인
- ADR-0014, feature_list ADMIN-03, README
**검증**: `./scripts/verify.sh` 백엔드 262 passed(97.9%), 프론트 통과. E2E admin 4·model-label·account 10 passed, 전체 실행 결과는 아래 커밋 메시지 참고
**운영 적용**: push → Render가 배포 전 마이그레이션 적용(기존 설정은 free 라우트로 자동 이전). 환경 변수 추가 없음. 관리자 화면에서 Pro/Max 탭에 라우트를 넣기 전까지는 free와 같게 동작
**다음**: 구독 결제 연동 시 `subscriptions` 테이블이 `users.plan`을 채우고 만료 시 free로(ADR-0014 메모). 요금제별 한도(`plan_limits`)

## 2026-10-31 · 세션 31 · COUPON-01 요금제 쿠폰(발급·복사·등록·만료)

**요청**: 카카오톡 선물처럼 유효기한 있는 쿠폰. Pro/Max × 7일·15일·1·3·6·12개월(등록일부터). 발급 시 복사 버튼(기능 설명 + dc.1pk.kr 사용처 포함).
**결정(사용자)**: 같은 요금제는 남은 기간 뒤에 이어 붙임, 상위는 확인 뒤 지금부터(남은 기간 소멸), 하위는 거부. 등록 기한 7/14/30/90일(기본 30). 수량 1~20장 + 코드별/모두 복사. 등록은 설정 화면 카드.
**한 일**
- `domain/coupon/`: `coupons` 테이블(코드 12자 unique, plan, duration, expires_at, memo, batch_id, created_by, redeemed_by/at, plan_until, revoked_at), `users.plan_expires_at`. 마이그레이션 `26e30a2e49cb`
- `periods.py`: `add_duration`(개월은 달력 기준·말일 보정), `utcnow`. `services.py`: 코드 생성(혼동 글자 제외 32자)·정규화, 발급/목록(상태 계산)/취소, 등록 규칙(Free→적용, 동일→연장, 상위→409 CONFIRM_REQUIRED 후 confirm, 하위·기한없음→거부), 로그 `coupon_issued/revoked/redeemed`
- `core/exceptions.ConfirmRequiredError`(409). `auth.services.expire_plan_if_due`를 `get_current_user`에서 매 요청 호출 → 기한 지난 유료 요금제는 free로(`plan_expired` 로그). 관리자 수동 요금제 지정은 기한 없음(NULL)
- API: `POST /api/coupons/redeem`, `GET/POST /api/admin/coupons`, `POST /api/admin/coupons/{id}/revoke`. `/auth/me`·관리자 사용자 응답에 `plan_expires_at`
- 프론트: `components/admin/coupon-admin.tsx`(발급 폼, 발급된 코드 복사/모두 복사, 목록·상태 필터·취소), `lib/coupon-text.ts`(안내문: 코드·등록 기한·적용 내용·사용처=현재 사이트 주소, 클립보드 복사 폴백), `components/settings/plan-coupon-card.tsx`(현재 요금제·만료일, 코드 등록, 상위 요금제 확인 대화상자), 계정 메뉴 "Pro · 날짜까지", `store/coupon.ts`, auth store `refreshUser`
- 테스트: `tests/test_coupon_periods.py` 3개, `tests/api/test_coupon.py` 8개. E2E `coupon.spec.ts`(발급→복사 내용 검증(clipboard 권한)→취소→사용자 등록→재사용/취소/없는 코드 거부→Max 확인 대화상자→계정 메뉴). admin.spec의 요금제 표기 기대값 조정(수동 지정은 "기한 없음")
- ADR-0015, feature_list COUPON-01
**검증**: `./scripts/verify.sh` 백엔드·프론트 통과(아래 커밋 참고). E2E coupon·admin·account·auth 통과
**운영 적용**: push → Render가 마이그레이션 적용(coupons 테이블, users.plan_expires_at). 환경 변수 추가 없음

## 2026-10-31 · 세션 32 · ADMIN-04 요금제별 기본 모델 사다리 + Claude temperature 제거

**요청**: 교육에 맞는 모델 중 Free에 비해 Pro·Max는 한 단계씩 비싼 모델이 기본으로. 표를 제시했고 사용자가 "적용 부탁해요".
**바뀐 점(제시한 표 대비)**: claude-api 레퍼런스 확인 결과 claude-opus-4-1은 2026-08-05 퇴역(호출 실패), claude-sonnet-4-5는 2026-11-30 퇴역 예정 → Claude 열을 haiku/sonnet/opus **5.5**로.
같은 확인에서 설치된 anthropic SDK 2.3.0(API 2026-10-21)은 temperature를 보내면 모든 모델에서 400, langchain-anthropic은 5.5 모델에 temperature를 주면 요청 전에 ValueError → **Claude에는 temperature를 보내지 않도록** 수정(이전엔 Claude 키를 넣어도 항상 실패해 다음 공급자로 넘어갔을 것).
**한 일**: `domain/admin/defaults.py`(사다리), 데이터 마이그레이션 `708a27953136`(빈 요금제에만, 운영 상태 재현 확인), `seed_default_routes` + `POST /api/admin/llm-routes/defaults`, `llm/providers._provider_kwargs`,
가격표에 claude-*-5-5 추가(직전에 넣었던 퇴역 opus-4-1 제거), 프론트 "기본 라우트 채우기" 버튼·추가 폼 기본 모델·안내 문구, `.env.example` 주석, 테스트(`tests/test_llm_defaults.py`, test_admin 추가), admin.spec 갱신, ADR-0014 후속
**검증**: 백엔드 281 passed(98.2%), 프론트 통과, E2E 72 passed
**운영 적용**: push → Render가 마이그레이션 적용 → 운영 Pro·Max에 기본 라우트(Free는 그대로). Claude 키가 없어 Claude 라우트는 쓰이지 않음

## 2026-10-31 · 세션 33 · CHAT-03 답변 수준 5단계

**요청**: 성인 대상 과정에서 사용자가 고른 수준(어휘·이해 수준)에 맞춰 답하게, 설정 화면 프로필 아래에. 사용자가 "AX 풀스택 입과자 대상이니 먼저 물어서 확인받아 달라"고 해
중간 작업을 stash로 보관하고 두 번 확인받았다.
**확인된 결정**: 5단계 1 왕초보·2 입문·3 기초·4 실전·5 심화(관리자가 이름 변경 가능), 처음 채팅할 때 직접 고르기(고르기 전엔 2단계), 채팅 + 일기 초안·주간 회고에 적용, 입력칸 + 메뉴에도.
**한 일**
- 백엔드: `core/answer_levels.py`(번호·기본 이름·대상·방식·예시, `effective_answer_level`), `llm/prompts/answer_level.py`(단계별 지시, `for_writing`이면 형식·분량 우선),
  chat·diary·weekly 체인과 서비스·라우터에 단계 전달, `users.answer_level`(NULL 허용, CHECK 1~5) + `PUT /api/auth/me/answer-level`, 새 도메인 `answer_level`(바꾼 이름만 저장, `GET /api/answer-levels`, 관리자 PATCH/DELETE). 마이그레이션 `7d0fab038fc8`(users CHECK는 수동 추가)
- 프론트: 설정 "답변 수준" 카드(계정 정보 아래, 단계 설명·'API' 예시), 첫 채팅 안내(`answer-level-chooser`), + 메뉴 "답변 수준" 라디오 묶음, 관리자 "답변 수준 이름" 카드, `store/answer-level.ts`, 조사 도우미 `josaRo`(이름이 바뀌어도 로/으로가 맞게)
- 테스트: 프롬프트 단위 테스트(중괄호 없음, 형식 우선), API 테스트(저장·검증·이름 변경·채팅/일기에 단계 전달). E2E `answer-level.spec.ts` 4개
**막힌 점**: ① sr-only legend가 위치 기준 없이 문서 밖으로 넘쳐 짧은 화면에서 페이지 전체가 스크롤 → fieldset `aria-label`로 교체 ② 라디오 글자 14px가 폰 16px 규칙 위반 → `text-base`
③ verify.sh의 빌드가 E2E용 빌드를 덮어 E2E가 8000번을 호출(CORS로 막혀 계정 유출은 없음 확인) → verify 뒤에는 항상 E2E용으로 다시 빌드 ④ coach.spec 1건 타이밍 플레이크(반복 30/30 통과)
**검증**: 백엔드 301 passed(98.2%), 프론트 통과, E2E 76 passed(플레이크 1건 별도 재확인)
**운영 적용**: push → Render가 마이그레이션 적용(컬럼·테이블 추가). 기존 사용자는 모두 NULL이라 다음 채팅에서 단계를 고르라는 안내를 본다

## 2026-10-31 · 세션 33-1 · CHAT-03 보완: + 메뉴에 처음부터 현재 단계 체크

**요청**: 폰 스크린샷과 함께 "목록에서 현재 단계에 체크 표시 필요", 고른 뒤에는 체크가 있으니 "처음부터 체크돼 있게".
**한 일**: + 메뉴 라디오 묶음 값을 `고른 단계 ?? 기본 2단계`로. 고르기 전에도 지금 답하는 2단계 입문에 체크가 보인다.
Base UI 메뉴는 이미 체크된 항목을 눌러도 `onValueChange`를 부르므로, 체크된 2단계를 누르면 그대로 확정 저장되고 첫 채팅 안내가 사라진다. 설정 카드는 원래 처음부터 2단계가 선택돼 있어 변경 없음.
**테스트**: E2E `answer-level.spec.ts`에 "고르기 전 2단계 체크·체크 1개·눌러서 확정·설정 카드 '사용 중'" 시나리오 추가(5개)
**검증**: 프론트 verify 통과, E2E answer-level·coach 15 passed, 390px 스크린샷으로 체크 아이콘 확인(고르기 전 2단계, 4단계 고른 뒤 4단계)

## 2026-10-31 · 세션 34 · ADMIN-05 관리자 비밀번호 초기화와 사용자 삭제

**요청**: 비밀번호를 잊은 사용자를 관리자 사용자 검색 화면에서 12345678 같은 기본 암호 또는 입력한 암호로 초기화. 같은 화면에서 특정 사용자 삭제.
**확인된 결정**: 다음 로그인 때 변경은 강제하지 않는다(DB 변경 없음). 기본 암호는 서버 설정 `ADMIN_RESET_PASSWORD_DEFAULT`(비우면 12345678)이고, 사용자마다 직접 입력도 된다.
**한 일**
- 백엔드: `POST /api/admin/users/{id}/password-reset`(비우면 기본 암호, 8~72자, 그 계정의 리프레시 토큰 전부 폐기, 응답·로그에 비밀번호·이메일 없음),
  `GET /api/admin/password-reset/default`, `DELETE /api/admin/users/{id}`(DB CASCADE로 기록 삭제, 쿠폰은 SET NULL로 기록 유지).
  관리자 계정(자기 자신 포함)은 403. 검색 결과에 `is_admin`. 기본 암호 설정이 규칙에 어긋나도 서버는 뜨고, 초기화 때 503으로 알린다
- 프론트: 사용자 행에 '비밀번호 초기화'·'삭제' 버튼(관리자 행은 꺼짐), 초기화 대화상자(기본 암호 값 표시 / 직접 입력), 결과 안내와 '안내문 복사', 삭제 확인 대화상자
- 테스트: `tests/api/test_admin_users.py` 6개, `admin.spec.ts`에 초기화·삭제 E2E 2개와 좁은 화면 사용자 행 확인
- 문서: ADR-0017, README 관리자 문단(예전 이름 "서버 설정"도 "관리자"로), `.env.example`, `scripts/e2e.sh`는 기본 암호 설정을 비워 고정
**막힌 점**: ① 기존 `test_admin_plan`의 "없는 사용자 404" 확인이 `/plan`이 빠진 주소를 쓰고 있었다. 경로가 없어 우연히 404였고, 같은 주소에 DELETE가 생기며 405로 드러나 주소를 고쳤다
② E2E `getByLabel("새 비밀번호")`가 묶음 이름 "새 비밀번호 고르기"와 부분 일치 → 묶음 이름을 "초기화 방식"으로 바꾸고 테스트는 exact
**검증**: `./scripts/verify.sh` 통과(백엔드 307 passed, 98.27%), E2E admin·coupon·account·auth 17 passed, 데스크톱 스크린샷으로 버튼·대화상자 확인
**운영 적용**: 마이그레이션 없음. 기본 암호를 바꾸려면 Render 환경 변수 `ADMIN_RESET_PASSWORD_DEFAULT`(8~72자)

## 2026-10-31 · 세션 35 · 운영 AI 전환 지연과 일기 초안 시간 초과 수정 (최종 발표 영상 촬영 중 발견)

**상황**: 최종 발표 시연 영상을 운영 dc.1pk.kr에서 찍다가 2부가 "이 대화로 일기 만들기"에서 멈췄다. 화면에 "서버에 연결할 수 없습니다".
**측정**: 채팅 답 42초·44초(모두 OpenAI가 답함), 일기 초안 41초. 데모 계정 답변 34개 중 14개가 Gemini 3.5 Flash 실패 뒤 OpenAI로 넘어간 답.
**원인**: ① Gemini SDK 기본 6회 재시도로 실패를 알기까지 약 15초 ② 프론트 axios 기본 제한 30초라 41초 걸린 초안 요청이 끊김
**한 일**: `llm/providers.py` 공급자별 `max_retries`(Gemini 2, OpenAI·Claude 1), 프론트 `LLM_REQUEST_TIMEOUT_MS`(120초)를 일기 초안·주간 회고 요청에만 적용,
테스트(`test_llm_defaults.py`에 실제 모델 객체의 재시도 값 확인), ADR-0012 후속 절. 사용자는 관리자 화면에서 Free 라우트의 OpenAI를 1순위로 올림

## 2026-10-31 · 세션 36 · 첫 화면(로그인·가입)에 '사용법 시연' 영상 버튼

**요청**: 유튜브에 올린 최종 시연 영상(https://youtu.be/wCsDCMeg8WQ)을 홈페이지 첫 화면에 '사용법 시연' 버튼으로 연결.
**한 일**: 첫 화면은 `/` → `/chat` → (로그인 전) `/sign-in`이라, 로그인·가입이 함께 쓰는 `app/(auth)/layout.tsx`의 로고 아래에 버튼을 넣었다.
새 탭으로 열고, 모양은 채팅 상단 '사용법 동영상 열기'와 같은 테두리 버튼·빨간 재생 아이콘. 영상 주소는 `lib/application.ts` 서비스 정의의 `demoVideoUrl`(starter는 `null`이라 버튼이 없다).
앱 안의 '사용법 동영상 열기'(채팅 상단·+ 메뉴, `GUIDE_VIDEO_URL`)는 예전 영상(MH6wL-0Qui0) 그대로 두었다.
**테스트**: E2E `brand.spec.ts`에 "`/`로 들어와 로그인 화면, 그리고 가입 화면에서 버튼 주소·새 탭 확인" 추가, `starter-profile.spec.ts`에 버튼이 없음을 확인
**검증**: 프론트 verify 통과, E2E brand·auth·responsive 17 passed, starter 3 passed, 1280px·iPhone 13 스크린샷(가로 넘침 없음), 버튼을 누르면 새 탭에서 유튜브 영상이 열림

## 2026-10-31 · 세션 36-1 · 사용법 영상 링크를 화면 폭에 따라 PC판·폰판으로

**요청**: 폰 화면판 시연 영상(https://youtu.be/FekXxD6Tv8E)을 올렸으니, 폰 화면인지에 따라 기존 영상 링크가 PC판·폰판 중 하나를 열게.
**한 일**: 영상 주소를 `lib/application.ts`의 `demoVideos`(desktop: wCsDCMeg8WQ, phone: FekXxD6Tv8E) 한곳에 모았다.
나누는 기준은 채팅 목록이 서랍으로 바뀌는 768px(`DESKTOP_QUERY`, Tailwind `md`)이다. 768px 이상은 PC판, 미만은 폰판.
로그인·가입 화면(서버 컴포넌트)은 버튼 두 개 중 하나만 CSS(`md:hidden` / `hidden md:inline-flex`)로 보인다.
채팅 상단 '사용법 동영상 열기'와 + 메뉴 항목은 `useMediaQuery(DESKTOP_QUERY)`로 주소를 고른다. 예전 영상(MH6wL-0Qui0)과 `GUIDE_VIDEO_URL`은 없앴다.
**테스트**: E2E `brand.spec.ts`(넓은 화면 PC판, 390px 폰판), `coach.spec.ts`(데스크톱·모바일에서 상단 버튼과 + 메뉴 주소). 기대 주소는 `e2e/helpers.ts`의 `DEMO_VIDEO`
**검증**: 프론트 verify 통과, E2E brand·coach·responsive·answer-level 27 passed, starter 3 passed
