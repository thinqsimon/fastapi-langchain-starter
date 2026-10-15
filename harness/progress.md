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
