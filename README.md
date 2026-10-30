# AX Chat Starter

FastAPI · PostgreSQL(pgvector) · Next.js · LangChain 기반 **챗봇형 AI 서비스 스타터킷**.

Fork하면 인증, 대화 이력, LLM 스트리밍, 토큰 사용량 집계, CI/CD, 브라우저 테스트가 갖춰진 상태에서
새 AI 서비스를 시작할 수 있습니다. 샘플 서비스로 **AI 배움일기 코치**가 들어 있습니다.

## 서비스 브랜치와 실행 프로필

`service/diary-coach`에서 배움일기 코치를 발전시킵니다. 같은 코드에서 `starter`는
인증·채팅·사용량만, `diary-coach`는 일기·회고·전용 개인 설정까지 제공합니다.
두 프로필 모두 기존 DB와 마이그레이션 이력을 보존합니다.

```sh
# 각 명령은 별도 터미널. 먼저 아래 빠른 시작의 의존성·DB 준비가 필요합니다.
node scripts/dev.mjs starter backend
node scripts/dev.mjs starter frontend
# 배움일기 서비스는 starter 대신 diary-coach
```

선택 지점과 빌드 환경 변수: [실행 프로필 가이드](docs/guides/application-profiles.md).
팀원이 실제 LLM을 연결할 때는 [LLM 연동 인수인계](docs/guides/llm-handoff.md)를 기준으로 시작하세요.
운영 배포 설정은 main 기준이며 서비스 브랜치 push는 검증만 수행합니다.

```
사용자 → Next.js → FastAPI → PostgreSQL / LangChain → LLM API → SSE 스트리밍 응답
```

**배포된 샘플 서비스 (이 브랜치, 배움일기 코치 2):** https://dc.1pk.kr
· 백엔드 API: https://fastapi-langchain-starter.onrender.com ([문서](https://fastapi-langchain-starter.onrender.com/docs))
· `main` 브랜치의 코치 1: https://1pk.kr (백엔드 https://diary-coach.onrender.com)

무료 플랜이라 백엔드는 15분간 요청이 없으면 중지됩니다. 첫 요청은 깨어나는 데 약 1분 걸립니다.

## 무엇이 들어 있나

| 영역 | 내용 |
|---|---|
| 인증 | 회원가입·로그인·리프레시 토큰 회전·로그아웃, 보호 라우트, 계정 정보 수정(이름·이메일·비밀번호) |
| 화면 공통 | 우측 계정 사이드 메뉴, 설정 화면, 헤더 캐치프레이즈(넘치면 전광판), 로고·파비콘·홈 화면 아이콘(`npm run icons`) |
| 모바일 | 반응형(대화 목록 접기·서랍), 터치 기기 대응, 아이폰 안전 영역, 입력칸 자동 높이(3줄까지) |
| 대화 | 대화·메시지 저장, SSE 스트리밍, 대화 목록 사이드바 |
| LLM | LangChain 연동, 프롬프트 템플릿 분리, `.env`만으로 공급자 교체, 키 없이 쓰는 테스트용 공급자 |
| 사용량 | 토큰 수 기록과 비용 추정 (`GET /api/usage/me`) |
| 품질 | 계층 규칙 자동 검사, 테스트 190개(커버리지 게이트 90%), 서비스 E2E 55개·스타터 E2E 3개, 단일 검증 명령 |
| 자동화 | GitHub Actions CI(E2E 포함), 배포 게이트 |
| 샘플앱 | [배움일기 코치](samples/diary-coach/) — 구름 코치와 대화 → 일기 → 주간 회고 보관·어려웠던 내용 복습 |
| AI 협업 | `CLAUDE.md`, 서브에이전트·스킬, 작업 목록([harness/](harness/)) |

## 빠른 시작

준비물: **Python 3.13+**와 [uv](https://docs.astral.sh/uv/), **Node 22+**, **Docker Desktop**

```bash
git clone <Fork한 저장소 주소> && cd <저장소>
make init            # .env 생성 · 의존성 설치 · DB 기동 · 마이그레이션
```

`.env`를 열어 LLM 키를 넣습니다. `OPENAI_API_KEY` 또는 `LLM_API_KEY` 중 하나면 됩니다.
키 없이 먼저 둘러보려면 `LLM_PROVIDER=fake`로 두세요(정해진 응답이 돌아옵니다).

```bash
make dev-backend     # http://localhost:8000  (API 문서: /docs)
make dev-frontend    # http://localhost:3000
```

브라우저에서 http://localhost:3000 을 열고 회원가입하면 바로 대화할 수 있습니다.

### 잘 돌아가는지 확인

```bash
curl http://localhost:8000/health        # {"status":"ok"}
make verify                              # 린트·타입·테스트·빌드
./scripts/e2e.sh                         # 실제 브라우저로 가입→대화→일기까지
```

## 주요 명령어

| 목적 | 명령 |
|---|---|
| 최초 셋업 | `make init` |
| DB 기동 / 마이그레이션 | `make db` / `make migrate` |
| 모델 변경 후 마이그레이션 생성 | `make migration m="설명"` |
| 개발 서버 | `make dev-backend` · `make dev-frontend` |
| 품질 검사(커밋 전) | `make verify` |
| 브라우저 E2E | `./scripts/e2e.sh` |
| 테스트 계정 정리 | `make clean-test-accounts` (목록) · `make clean-test-accounts args="--delete"` (삭제) |
| 재사용성 검증 | `make fork-verify` |

## 새 서비스로 바꾸기

[사용 및 운영 가이드](docs/guides/usage.md)에 단계별로 적어 두었습니다. 요약하면:

1. `.env`의 `APP_NAME`, 프론트엔드 빌드 환경의 `NEXT_PUBLIC_APP_NAME`(화면·탭·홈 화면 이름)을 바꾸고,
   로고 원본 `frontend/public/brand/logo.svg`를 교체한 뒤 `npm run icons`로 파비콘·아이콘을 다시 만듭니다
2. `backend/src/app/llm/prompts/`에 서비스에 맞는 프롬프트를 둡니다
3. `backend/src/app/domain/<이름>/`에 도메인을 추가하고 `make migration`
4. `frontend/app/(main)/<이름>/`에 화면을 추가합니다
5. `make verify`와 `./scripts/e2e.sh`로 확인합니다

실제로 이 과정을 거친 예시가 [samples/diary-coach](samples/diary-coach/)입니다.

## 문서

| 문서 | 내용 |
|---|---|
| [아키텍처](docs/architecture.md) | 전체 구조, 요청 흐름, 배포 흐름 |
| [사용 및 운영 가이드](docs/guides/usage.md) | 실행·커스터마이징·배포·장애 점검 |
| [LLM 연동 인수인계](docs/guides/llm-handoff.md) | 현재 구현 범위·팀원 실행·제공자 연결 지점·수동 확인 순서 |
| [코딩 규칙](docs/conventions.md) | API·DB·LLM·프론트엔드 규칙 |
| [설계 결정(ADR)](docs/decisions/) | 왜 이렇게 만들었는지 |
| [설계·계획](docs/plans/) | 범위, 설계서, 일정 |
| [CLAUDE.md](CLAUDE.md) | AI 에이전트와 함께 작업하는 방법 |

## 기술 선택 이유 (요약)

- **UUID 기본키** — ID로 가입자 수가 드러나지 않고, 외부 시스템과 합치기 쉽습니다
- **리프레시 토큰 회전** — 한 번 쓴 토큰은 폐기해 탈취된 토큰의 재사용을 막습니다
- **SSE 스트리밍** — 단방향 토큰 전송에 충분하고 프록시·배포 환경과 잘 맞습니다
- **테스트용 가짜 LLM** — API 키 없이도 CI가 통과합니다. Fork 직후 바로 초록불입니다
- **계층 규칙 자동 검사** — 문서가 아니라 `import-linter`가 막습니다

자세한 배경은 [docs/decisions/](docs/decisions/)에 있습니다.
