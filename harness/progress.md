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
