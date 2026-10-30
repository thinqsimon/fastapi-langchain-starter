# 배움일기 코치 — LLM 연동 팀원 인수인계

작업 기준 브랜치는 **`service/diary-coach`** 입니다. 공통 스타터킷과 서비스의 프로필 분리,
구름 코치 UI, 일기·주간 회고·복습 저장까지 구현된 상태입니다.
실제 제공자 선정·키 입력·실제 모델 호출 검증은 이어서 담당할 작업입니다.

## 현재 완료한 범위

| 구분 | 구현 내용 |
|---|---|
| 공통 기반 | 인증·토큰 재발급·계정·대화 저장·SSE·사용량, `starter` 실행 프로필 |
| 코치 화면 | 구름 이미지·추천 질문·응답 아바타·모바일 대응 |
| 배움일기 | 현재 채팅에서 초안 생성 → 수정·저장, 출처 보존·중복 방지·미저장 내용 보호 |
| 주간 회고 | 선택 주 생성·저장·조회·삭제. 사용자·주당 한 편, 저장 당시 내용 보존 |
| 복습 | 어려웠던 내용 모음·학습 원문·메모·완료/다시 복습. 일기 변경·삭제와 연계 |
| DB | Alembic `e317b6a91d42`까지. 회고·복습 테이블 포함 |

최신 구현·인수인계 검증은 [CI 40280442756](https://github.com/thinqsimon/fastapi-langchain-starter/actions/runs/40280442756)입니다.
검증 대상 커밋은 `4323d23724fc9a4528ddf88db62afeb6fe0c8e1e`입니다.
백엔드 190개, 서비스 E2E 55개, starter E2E 3개와 두 프로필 빌드가 통과했습니다.
자동 테스트와 지금까지의 화면 검증은 **fake LLM** 기준입니다.

## 1. 브랜치 받기

```sh
git clone --branch service/diary-coach https://github.com/thinqsimon/fastapi-langchain-starter.git diary-coach
cd diary-coach
```

LLM 연동 작업은 이 브랜치를 기준으로 팀원의 작업 브랜치를 만들어 진행하면 됩니다.
구현 경계와 기존 설계는 [프로필 가이드](application-profiles.md),
[ADR-0008](../decisions/ADR-0008-coach-chat-to-diary.md),
[ADR-0009](../decisions/ADR-0009-saved-weekly-review-and-study.md)에 정리돼 있습니다.

## 2. 키 없이 먼저 실행하기

준비물: Python 3.13+, uv, Node 22+, 실행 중인 Docker Desktop.
아래 명령은 저장소 루트 기준입니다. 예제 설정 파일에는 실제 키가 없습니다.

PowerShell:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
if (!(Test-Path frontend/.env.local)) { Copy-Item frontend/.env.example frontend/.env.local }
```

macOS/Linux:

```sh
test -f .env || cp .env.example .env
test -f frontend/.env.local || cp frontend/.env.example frontend/.env.local
```

루트 `.env`에서 첫 실행 값을 맞춥니다. DB 값은 기본 Docker Compose 기준입니다.

```dotenv
APP_PROFILE=diary-coach
APP_ENV=local
DATABASE_URL=postgresql+psycopg://app:app@localhost:5432/app
TEST_DATABASE_URL=postgresql+psycopg://app:app@localhost:5432/app_test
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
LLM_PROVIDER=fake
```

Next.js는 루트 `.env`를 자동으로 읽지 않습니다. 프론트엔드는
`frontend/.env.example`을 복사한 `frontend/.env.local`을 사용합니다.
여기에는 공개 가능한 프로필·앱 이름·백엔드 주소만 넣습니다.

의존성과 DB를 준비합니다:

```sh
cd backend
uv sync --locked
cd ../frontend
npm ci
cd ..
docker compose up -d --wait db
cd backend
uv run alembic upgrade head
uv run alembic current
cd ..
```

서로 다른 터미널에서 실행합니다:

```sh
node scripts/dev.mjs diary-coach backend --host 127.0.0.1 --port 18000
```

```sh
node scripts/dev.mjs diary-coach frontend --hostname 127.0.0.1 --port 3000
```

- 화면: http://localhost:3000
- API 문서: http://127.0.0.1:18000/docs
- DB 연결 확인: http://127.0.0.1:18000/health/ready

회원가입 후 새 계정으로 확인합니다. 개인 PC의 체험 계정·DB 데이터는 저장소에 포함되지 않습니다.
Windows의 8000 포트 예약 문제를 피하기 위해 이 가이드는 18000을 사용합니다.
포트를 바꾸면 `frontend/.env.local`의 API 주소도 맞추고 프론트엔드를 재시작합니다.

## 3. 실제 제공자 연결 지점

| 파일 | 역할 |
|---|---|
| `backend/src/app/core/config.py` | LLM 설정의 단일 진입점·공급자별 키 선택 |
| `backend/src/app/llm/providers.py` | 공통 `get_chat_model()` 팩토리. 모든 체인이 여기서 모델을 받음 |
| `backend/src/app/llm/chains/chat.py` | 코치 대화 스트리밍·사용량 수집 |
| `backend/src/app/llm/chains/diary.py` | 일기·회고의 Pydantic 구조화 출력 |
| `backend/src/app/llm/prompts/diary_coach.py` | 학습 코치·일기·주간 회고 프롬프트 |
| `backend/src/app/application.py` | `starter`/`diary-coach`별 프롬프트 조립 |

루트 `.env` 또는 백엔드 실행 환경에서 설정할 항목:

| 변수 | 설정할 내용 |
|---|---|
| `LLM_PROVIDER` | LangChain 공급자 이름. OpenAI 호환 API는 일반적으로 `openai` |
| `LLM_MODEL` | 제공자가 안내한 정확한 모델 ID |
| `LLM_BASE_URL` | OpenAI 호환 게이트웨이의 API Base URL. 직접 연결이면 제공자 방식에 맞춤 |
| `LLM_API_KEY` | 서버 전용 키. 설정하면 공급자 표준 키보다 우선함 |
| `LLM_TEMPERATURE` | 모델이 지원하는 경우의 생성 설정 |

공급자 표준 키 `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`도 지원하는 구조입니다.
현재 의존성에는 **`langchain-openai` 어댑터만** 포함돼 있습니다. 다른 네이티브 공급자는
담당자가 필요한 LangChain 어댑터를 `backend/pyproject.toml`과 `uv.lock`에 추가해야 합니다.
제공자의 인증 헤더·엔드포인트·지원 파라미터가 다르면 `providers.py`에서 조정합니다.
설정을 추가하면 `core/config.py`와 `.env.example`을 함께 갱신합니다.

키는 서버 설정에만 보관합니다. `.env`, `frontend/.env.local`, 실제 API 키는 커밋하지 않습니다.
`NEXT_PUBLIC_*`에는 LLM 키를 넣지 않습니다. 설정을 바꾼 뒤 **백엔드를 재시작**해야 반영됩니다.

## 4. 연동 후 수동 확인 순서

1. 새 확인용 계정에서 코치에게 학습 질문을 보내고 토큰이 순서대로 보이는지 확인합니다.
2. 입력칸 왼쪽 **+ 메뉴 → 이 대화로 일기 만들기**로 초안을 만들고, 제목·배운 내용·어려움·출처를 확인해 저장합니다.
3. 아직 회고가 없는 주의 일기로 **회고 만들기**를 실행해 저장하고 새로고침 후 다시 엽니다.
4. 복습 메모 저장 → 완료 → 다시 복습을 확인합니다.
5. API 인증 실패·할당량 부족·연결 실패가 나면 서버의 일반 오류 형식과 UI 재시도를 확인합니다.

제공자는 **스트리밍**과 **구조화 출력**을 모두 지원해야 합니다. 채팅이 성공하더라도
일기·회고의 `with_structured_output`까지 각각 확인해야 합니다. 지원 방식이 다르면
공급자 팩토리/체인에서 처리하고 라우터나 프론트엔드에 제공자별 코드를 넣지 않습니다.

이미 저장한 회고는 같은 주에 생성 요청해도 기존 기록을 반환합니다.
새 모델의 생성 결과를 확인하려면 새 계정 또는 아직 저장하지 않은 주를 사용합니다.
키 변경이 기존의 fake 생성 기록을 실제 모델 결과로 자동 교체하지는 않습니다.

## 5. 회귀 검사

테스트 전용 DB `app_test`를 최초 한 번 준비합니다. 이미 있으면 그대로 사용합니다.

```sh
docker compose exec -T db createdb -U app app_test
```

루트 `.env`의 `TEST_DATABASE_URL`을 `app_test`로 지정합니다.
자동 테스트 명령에는 `LLM_PROVIDER=fake`를 명시합니다. 실제 제공자를 export한 터미널에서도
검증은 fake로 실행해야 합니다. E2E 스크립트와 CI의 기존 fake 강제도 유지합니다.

macOS/Linux:

```sh
LLM_PROVIDER=fake ./scripts/verify.sh
E2E_DATABASE_URL=postgresql+psycopg://app:app@localhost:5432/app_test BACKEND_PORT=18010 ./scripts/e2e.sh
```

Windows PowerShell에서는 검증용 터미널에서 fake를 설정한 뒤 실행합니다:

```powershell
$env:LLM_PROVIDER = "fake"
Push-Location backend
uv run ruff format --check .
uv run ruff check .
uv run mypy
uv run lint-imports
uv run pytest -q
Pop-Location
Push-Location frontend
npm run format:check
npm run lint
npm run typecheck
npm run build
Pop-Location
```

전체 브라우저 E2E는 Linux 환경의 GitHub Actions에서도 확인할 수 있습니다.
GitHub Actions는 같은 품질 게이트와 두 프로필 E2E를 실행합니다.
실제 LLM 수동 확인 결과는 사용 제공자·모델·성공한 세 흐름을 기록하되 키는 기록하지 않습니다.

## 담당자가 이어서 결정할 항목

- 제공자·모델·Base URL·인증 방식
- 필요한 어댑터와 스트리밍/구조화 출력 호환 설정
- 실제 호출로 채팅·일기·회고가 성공하는지 확인
- 실제 제공자 단가에 맞는 토큰 비용 설정과 배포 환경 변수
