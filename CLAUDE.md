# AX Chat Starter — 에이전트 가이드

챗봇형 AI 서비스 스타터킷(FastAPI + PostgreSQL + Next.js + LangChain)과 샘플앱 "AI 배움일기 코치".
AX 풀스택 2차 프로젝트 (10/20 ~ 11/03 제출). 요구사항 원문: `docs/requirements/`.

## 세션 절차 (반드시 지킨다)
1. **시작**: `harness/progress.md` 마지막 항목 → `harness/feature_list.json`에서 `passes:false`인 가장 앞 phase의 기능 1개 선택
2. **계획**: 기능의 `acceptance`를 기준으로 변경 파일을 정한다. 설계 변경이면 `docs/decisions/`에 ADR 추가
3. **구현**: 아래 규칙을 따른다. 한 세션에 기능 1개만
4. **검증**: `./scripts/verify.sh` 통과 + acceptance 하나씩 확인 (test-verifier 에이전트 활용)
5. **종료**: `/handoff` — progress.md 기록, 통과한 기능만 `passes:true`, 커밋

## 명령어
| 목적 | 명령 |
|---|---|
| 최초 셋업 | `make init` |
| DB 기동 / 마이그레이션 | `make db` / `make migrate` / `make migration m="msg"` |
| 서버 | `make dev-backend` (:8000, /docs) · `make dev-frontend` (:3000) |
| 품질 게이트 | `./scripts/verify.sh [backend\|frontend]` |
| 재사용성 검증 | `make fork-verify` |

## 구조
```
backend/src/app/
  core/       설정(config.py 단일 진입점)·DB·예외·로깅·보안 — domain/llm을 import 금지
  domain/<x>/ routers → services → repositories → models (+ schemas)  ← 기능 단위 폴더
  llm/        providers(공급자 교체)·prompts·chains·rag·fake — domain import 금지
  api.py      도메인 라우터 등록 / models.py 모델 등록(Alembic용)
frontend/     app/(auth)·app/(main) 라우트, api/ (axios), store/ (zustand), components/ui (shadcn),
              public/brand (로고 원본) → `npm run icons`로 파비콘·앱 아이콘 생성
samples/diary-coach/  샘플앱 변경분 설명 (스타터킷 사용 예)
harness/      feature_list.json(할 일·인수조건) · progress.md(인수인계)
```
상세: `backend/CLAUDE.md`, `frontend/CLAUDE.md`, `docs/conventions.md`, `docs/architecture.md`.

## 핵심 규칙
- 계층 규칙은 import-linter가 강제한다(`pyproject.toml`). 계약을 수정해서 통과시키지 않는다
- 라우터는 얇게: 검증·인증·서비스 호출만. 비즈니스 로직은 services, DB 접근은 repositories
- 서비스는 `HTTPException` 대신 `app.core.exceptions.AppError` 하위 클래스를 던진다
- DB 스키마 변경은 반드시 Alembic 마이그레이션으로 (`create_all` 금지)
- LLM 호출은 `app.llm.providers.get_chat_model()`만 사용. 테스트는 `LLM_PROVIDER=fake`로 실제 API 호출 금지
- 설정 추가 시 `core/config.py`와 `.env.example`을 함께 수정. `.env`는 읽거나 커밋하지 않는다
- 새 도메인은 `/new-feature` 스킬로 스캐폴드한다

## 사람 확인이 필요한 일
DB 스키마·API 계약 확정, feature_list의 acceptance 변경, 배포·Secret 설정, 의존성 대규모 추가.

## TBD
강의 제공 LLM API 종류/키 · 배포 대상(기본안 Render/Railway) · 팀 구성.
