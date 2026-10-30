# 스타터킷 사용 및 운영 가이드

이 문서는 스타터킷을 **처음 접한 개발자**가 Fork한 뒤 문서만 보고 실행·커스터마이징·배포할 수 있도록
쓰였습니다. 명령은 모두 실제로 실행해 본 것이고, 기대 출력도 함께 적었습니다.

---

## ① 실행 전 준비

| 준비물 | 확인 | 비고 |
|---|---|---|
| Python 3.13+ | `python3 --version` | |
| uv | `uv --version` | 없으면 `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| Node 22+ | `node --version` | |
| Docker Desktop | `docker --version` | PostgreSQL을 로컬에서 띄웁니다 |
| LLM API 키 | | 없으면 `LLM_PROVIDER=fake`로 먼저 둘러볼 수 있습니다 |

> **macOS에서 `docker` 명령을 못 찾을 때**
> Docker Desktop을 설치해도 `/usr/local/bin`에 링크가 생기지 않는 경우가 있습니다.
> `~/.zprofile`에 아래를 추가하고 터미널을 새로 여세요.
> ```bash
> export PATH="$PATH:/Applications/Docker.app/Contents/Resources/bin"
> ```

---

## ② Fork 및 실행

```bash
git clone <Fork한 저장소 주소>
cd <저장소>
make init
```

`make init`이 하는 일: `.env` 생성 → 백엔드·프론트엔드 의존성 설치 → DB 컨테이너 기동 → 마이그레이션 적용.
여러 번 실행해도 안전합니다.

이어서 `.env`를 열어 LLM 키를 채웁니다.

```bash
# 둘 중 하나만 채우면 됩니다(LLM_API_KEY가 우선).
LLM_API_KEY=
OPENAI_API_KEY=sk-...
```

서버를 띄웁니다(터미널 2개).

```bash
make dev-backend     # http://localhost:8000
make dev-frontend    # http://localhost:3000
```

---

## ③ 실행 상태 확인

```bash
curl http://localhost:8000/health
```

```json
{"status":"ok"}
```

API 문서는 http://localhost:8000/docs 에서 볼 수 있습니다.

---

## ④ 서비스 정상 동작 확인

```bash
# 1) 회원가입
curl -X POST http://localhost:8000/api/auth/signup \
  -H 'content-type: application/json' \
  -d '{"email":"test@example.com","password":"secret-password","display_name":"테스터"}'
```

```json
{"id":"...","email":"test@example.com","display_name":"테스터","is_active":true,"created_at":"..."}
```

```bash
# 2) 인증 없이 접근하면 막히는지
curl http://localhost:8000/api/auth/me
```

```json
{"error":{"code":"UNAUTHORIZED","message":"인증이 필요합니다."}}
```

```bash
# 3) 로그인해서 토큰 받기
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"test@example.com","password":"secret-password"}' \
  | python3 -c "import json,sys;print(json.load(sys.stdin)['access_token'])")

# 4) 대화 만들고 스트리밍 받기
CONV=$(curl -s -X POST http://localhost:8000/api/conversations \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"title":"첫 대화"}' | python3 -c "import json,sys;print(json.load(sys.stdin)['id'])")

curl -N -X POST http://localhost:8000/api/conversations/$CONV/stream \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"content":"안녕하세요"}'
```

```
event: token
data: 안녕

event: token
data: 하세요

event: done
data:
```

```bash
# 5) 토큰 사용량 확인
curl -s http://localhost:8000/api/usage/me -H "Authorization: Bearer $TOKEN"
```

```json
{"model":"gpt-4o-mini","message_count":1,"input_tokens":78,"output_tokens":10,
 "total_tokens":88,"estimated_cost_usd":"0.000018"}
```

화면에서는 http://localhost:3000 에 접속해 가입 → 채팅 → 일기 순서로 확인합니다.

---

## ⑤ 로그 확인

로그는 표준 출력으로 나갑니다. 각 줄에 **요청 ID**가 붙어 있어 한 요청에서 나온 로그를 모아 볼 수 있습니다.

```
2026-10-15 11:53:24 INFO  [app.access] [019d21a2f644] POST /api/auth/login -> 200 (259.0ms)
```

- 응답 헤더 `X-Request-ID`에 같은 값이 들어갑니다. 사용자가 겪은 오류를 로그에서 찾을 때 이 값을 쓰세요.
- 프론트엔드 오류는 브라우저 개발자 도구 콘솔에서 확인합니다.

---

## ⑥ 새 서비스로 커스터마이징

샘플앱 [배움일기 코치](../../samples/diary-coach/)가 실제로 이 절차를 거쳐 만들어졌습니다.

**1. 이름·로고 바꾸기**
- 이름: `.env`의 `APP_NAME`(백엔드), `frontend/components/brand-logo.tsx`의 `APP_NAME`(화면·브라우저 탭·홈 화면 이름)
- 로고: `frontend/public/brand/logo.svg`를 교체한 뒤 `cd frontend && npm run icons`.
  파비콘(`app/favicon.ico`·`icon.svg`), 아이폰 홈 화면 아이콘(`app/apple-icon.png`), 웹앱 매니페스트 아이콘이 다시 만들어집니다
- 32px 이하에서 뭉개지는 세부는 SVG 요소에 `data-detail` 속성을 달면 작은 아이콘에서 빠집니다

**2. 프롬프트 교체** — 성격이 바뀌는 지점입니다.
`backend/src/app/llm/prompts/`에 새 파일을 만들고, 기존 `chat.py`와 같은 구조로 작성합니다.

**3. 도메인 추가**
```bash
# backend/src/app/domain/<이름>/ 에 routers·services·repositories·models·schemas 생성
# 등록 3곳: app/api.py, app/models.py, pyproject.toml의 import-linter containers
make migration m="create <이름>"
make migrate
```

**4. 화면 추가**
`frontend/app/(main)/<이름>/page.tsx`, API 함수는 `frontend/api/<이름>.ts`,
상태는 `frontend/store/<이름>.ts`에 둡니다.

**5. 확인**
```bash
make verify
./scripts/e2e.sh
```

> **LLM 공급자 교체**는 코드를 고치지 않습니다. `.env`의 `LLM_PROVIDER`와 `LLM_MODEL`만 바꾸세요.
> (`openai` / `anthropic` / `google_genai` / `fake`)

---

## ⑦ CI/CD 확인 및 배포

### CI
`main`·`service/**` 브랜치에 push하거나 PR을 올리면 GitHub Actions가 자동 실행됩니다.

```
git push origin service/diary-coach   (또는 main)
→ CI: 린트·타입·테스트·빌드 (verify)
→ CI: 브라우저 E2E
→ 둘 다 통과해야 배포 단계로 넘어갑니다
```

로컬과 CI는 **같은 스크립트**(`scripts/verify.sh`, `scripts/e2e.sh`)를 실행합니다.
테스트가 실패하면 배포는 실행되지 않습니다.

### 배포 게이트는 브랜치마다 다른 서비스로 배포합니다

브랜치 하나가 서비스 하나입니다. 배포에 필요한 값은 GitHub **Environment**(Settings → Environments)에
브랜치별로 둡니다. 자세한 이유는 [ADR-0011](../decisions/ADR-0011-deploy-per-branch.md)에 있습니다.

| 브랜치 | Environment | 변수 `BACKEND_URL` | 시크릿 `RENDER_DEPLOY_HOOK_URL` |
|---|---|---|---|
| `main` | `production` | 코치 1 Render 주소 | 코치 1 Render 서비스의 Deploy Hook |
| `service/diary-coach` | `diary-coach` | 코치 2 Render 주소 | 코치 2 Render 서비스의 Deploy Hook |

- 변수 `DEPLOY_TARGET`(값 `render`)이 비어 있으면 배포 job은 건너뜁니다
- `deploy.yml`은 **기본 브랜치의 파일로 실행**됩니다. 두 브랜치의 파일을 같은 내용으로 유지하세요
- 새 서비스 브랜치를 만들면: Environment 생성 → 변수·시크릿 입력 → `deploy.yml`의 `branches`와 Environment 매핑에 추가

### 배포 (Supabase + Render + Vercel)

무료 플랜 조건을 따져 셋으로 나눴습니다. 이유는 [ADR-0004](../decisions/ADR-0004-deployment.md)에 있습니다.

| 역할 | 서비스 | 왜 |
|---|---|---|
| DB | Supabase | 만료 기한이 없고 pgvector를 기본 지원합니다 |
| 백엔드 | Render | FastAPI 배포가 단순합니다 |
| 프론트엔드 | Vercel | Next.js에 최적이고 중지되지 않습니다 |

> **로컬 개발과 운영 DB를 분리하세요.**
> `.env`의 `DATABASE_URL`을 Supabase로 바꿔도 **테스트와 E2E는 항상 로컬 DB**를 씁니다
> (`TEST_DATABASE_URL`). 운영 데이터에 테스트가 붙는 사고를 막기 위한 분리입니다.
> 마이그레이션을 운영 DB에 직접 적용할 때만 `DATABASE_URL`이 그쪽을 가리키면 됩니다.

#### 1단계 · Supabase (DB)

1. 프로젝트를 만듭니다.
2. Project Settings → Database → **Connection string**에서 연결 문자열을 복사합니다.
   연결 수를 아끼기 위해 **Connection pooling(포트 6543)** 주소를 권장합니다.
3. 드라이버에 맞게 앞부분을 바꿉니다.
   ```
   postgresql+psycopg://postgres.<ref>:<비밀번호>@<호스트>:6543/postgres
   ```
4. (RAG를 쓸 때만) SQL Editor에서 `create extension if not exists vector;`
5. 스키마를 올립니다. 배포 시 자동 적용되지만, 미리 확인하고 싶다면:
   ```bash
   DATABASE_URL="<Supabase 주소>" make migrate
   ```
   `users`, `refresh_tokens`, `conversations`, `messages`, `diary_entries`, `user_preferences`,
   `document_chunks`(RAG) 7개 테이블이 생깁니다.

#### 2단계 · Render (백엔드)

**방법 A — Blueprint (권장).** GitHub 저장소를 연결할 수 있을 때 씁니다.

1. New → **Blueprint**를 고르고 이 저장소를 선택합니다. 루트의 `render.yaml`을 읽어 서비스를 만듭니다.
2. 대시보드에서 아래 환경 변수를 입력합니다(`sync: false`로 표시된 값들입니다).

   | 이름 | 값 |
   |---|---|
   | `DATABASE_URL` | 1단계에서 만든 Supabase 주소 |
   | `JWT_SECRET_KEY` | `openssl rand -hex 32` 결과 |
   | `OPENAI_API_KEY` | 실제 키 |
   | `CORS_ORIGINS` | 프론트엔드 주소 (예: `["https://내앱.vercel.app"]`) |

3. 배포되면 `https://<서비스명>.onrender.com/health`가 `{"status":"ok"}`를 돌려줘야 합니다.

> 마이그레이션은 배포할 때마다 자동으로 적용됩니다(`render.yaml`의 `preDeployCommand`).

**방법 B — Public Git Repository.** 저장소 소유자가 아닌 계정으로 작업할 때 씁니다.
GitHub 앱은 계정 단위로 설치되므로, 협업자 권한만으로는 저장소를 연결할 수 없습니다.

New → Web Service → **Public Git Repository**에 저장소 주소를 넣고 아래를 입력합니다.

| 항목 | 값 |
|---|---|
| Root Directory | `backend` |
| Build Command | `pip install uv && uv sync --locked` |
| Start Command | `uv run alembic upgrade head && uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Health Check Path | `/health` |
| Instance Type | **Free** (기본값이 유료이니 반드시 바꿉니다) |
| Region | Singapore |

환경 변수는 방법 A와 같고, 여기에 `APP_ENV=production`, `PYTHON_VERSION=3.13`,
`LLM_PROVIDER=openai`, `LLM_MODEL=gpt-4o-mini`를 더합니다.

> 이 방법은 Render의 자동 배포를 쓰지 않습니다. 대신 GitHub Actions가 CI 통과 후
> Deploy Hook을 직접 호출하므로, 배포 브랜치에 push하면 동일하게 배포됩니다.
> Settings → **Deploy Hook**의 URL을 복사해 해당 브랜치 Environment의 시크릿 `RENDER_DEPLOY_HOOK_URL`로 넣습니다.
> (Blueprint·GitHub 연결로 만든 서비스도 Auto-Deploy를 **끄고** 같은 방식을 쓰면 CI를 통과한 커밋만 배포됩니다.)

#### 3단계 · Vercel (프론트엔드)

1. 저장소를 import하고 **Root Directory를 `frontend`로** 지정합니다.
2. 환경 변수 `NEXT_PUBLIC_API_BASE_URL`에 2단계의 Render 주소를 넣습니다.
3. 배포 후 Render의 `CORS_ORIGINS`에 Vercel 주소를 넣고 백엔드를 재배포합니다.

#### 4단계 · GitHub Actions 연결

Settings → Secrets and variables → Actions

> **어느 저장소인지 확인하세요.** 변수와 시크릿은 **저장소마다 따로** 관리됩니다.
> 비슷한 이름의 저장소가 여럿이면 엉뚱한 곳에 넣기 쉽고, 그러면 Deploy가 계속 건너뛰어집니다.
> 주소로 바로 들어가는 편이 안전합니다:
> `https://github.com/<소유자>/<저장소>/settings/secrets/actions`

| 종류 | 이름 | 값 |
|---|---|---|
| Variable | `DEPLOY_TARGET` | `render` |
| Variable | `BACKEND_URL` | `https://<서비스명>.onrender.com` |
| Secret | `RENDER_DEPLOY_HOOK_URL` | Render → Settings → Deploy Hook 주소 |

이 값들이 없으면 Deploy 워크플로는 **건너뜁니다**. 배포하지 않았는데 초록불이 켜지는 것을 막기 위함입니다.

등록했는데도 계속 건너뛴다면 순서대로 확인하세요.

1. 저장소가 맞는가 (위 경고 참고)
2. `DEPLOY_TARGET`이 **Variables** 탭에 있는가 (Secrets 탭이 아님)
3. 이름의 철자와 대소문자가 정확한가

> **무료 플랜 주의**
> - Render 백엔드는 15분간 요청이 없으면 중지되고, 다시 깨어나는 데 약 1분 걸립니다.
> - Supabase는 7일간 사용이 없으면 일시정지됩니다. 데이터는 남아 있고 대시보드에서 복구합니다.

#### 5단계 · 깨어 있게 유지하기 (선택)

외부 cron 서비스(cron-job.org 등)로 **10분마다** 아래 주소를 호출하면 시연 때 기다리지 않습니다.

```
https://<백엔드 주소>/health/ready
```

`/health`가 아니라 **`/health/ready`** 를 쓰세요. `/health`는 DB를 건드리지 않아
서버만 깨우고 **DB는 유휴로 판단되어 일시정지될 수 있습니다.**

| 엔드포인트 | 확인 범위 | 용도 |
|---|---|---|
| `/health` | 서버 프로세스만 | 배포 플랫폼의 health check |
| `/health/ready` | 서버 + DB (끊기면 503) | 깨우기, 운영 모니터링 |

> Render 무료 플랜은 워크스페이스당 **월 750시간**입니다. 한 달 내내 깨어 있으면 약 730시간이라
> 서비스 하나는 괜찮지만, 무료 서비스를 하나 더 띄우면 한도를 넘습니다.

---

## ⑧ 재배포 또는 업데이트

```
코드 수정 → make verify 통과 → push
→ CI 통과 → 배포
→ DB 모델을 바꿨다면 마이그레이션이 함께 적용됐는지 확인
→ curl <배포주소>/health 로 확인
```

마이그레이션은 되돌릴 수 있게 만듭니다. 적용 전에 생성된 파일을 반드시 읽어 보세요.

```bash
make migration m="설명"     # 생성
# alembic/versions/의 새 파일 내용 확인
make migrate                # 적용
```

---

## ⑨ 장애 발생 시 점검 순서

| 순서 | 확인 | 명령 |
|---|---|---|
| 1 | 백엔드가 떠 있는가 | `curl <주소>/health` |
| 2 | DB에 연결되는가 | `docker compose ps` · `make migrate` |
| 3 | 마이그레이션이 최신인가 | `cd backend && uv run alembic current` |
| 4 | LLM 호출이 되는가 | `curl` 로 스트리밍 테스트(④의 4번) |
| 5 | 애플리케이션 로그 | 표준 출력에서 `X-Request-ID`로 추적 |
| 6 | 프론트엔드 콘솔 | 브라우저 개발자 도구 |
| 7 | 환경 변수·Secret | `.env` / Render 환경 변수 / GitHub Secrets |
| 8 | CI 로그 | GitHub Actions 탭 |

### 자주 겪는 문제

| 증상 | 원인 | 해결 |
|---|---|---|
| 서버가 뜨지 않고 설정 오류 | 운영에서 기본 비밀키나 LLM 키 누락 | `JWT_SECRET_KEY`, LLM 키 확인 |
| 스트리밍이 오류로 끝남 | LLM 키가 없거나 잘못됨 | 서버 로그의 `stream_failed` 확인. 키 없이 테스트하려면 `LLM_PROVIDER=fake` |
| 프론트엔드에서 "서버에 연결할 수 없습니다" | CORS 허용 목록에 프론트엔드 주소가 없음 | `CORS_ORIGINS`에 배포된 프론트엔드 주소 추가 후 재배포 |
| 배포 직후 `SettingsError: error parsing value for field "CORS_ORIGINS"` | 값 형식 오류 | JSON 배열 또는 쉼표 구분으로 적습니다. 따옴표·대괄호가 짝이 맞는지 확인 |
| `alembic check` 실패 | 모델을 바꾸고 마이그레이션을 안 만듦 | `make migration m="설명"` |
| 포트 충돌 | 다른 서버가 이미 사용 중 | `lsof -ti tcp:8000 \| xargs kill` |

---

## ⑩ 재사용성 검증

새 환경에서 문서만으로 실행되는지 자동으로 확인합니다.

```bash
make fork-verify
```

임시 폴더에 저장소를 새로 clone해서 `init` → `verify`를 수행합니다.
커밋되지 않은 파일은 포함되지 않으므로, 실제로 Fork한 사람과 같은 조건에서 검증됩니다.
