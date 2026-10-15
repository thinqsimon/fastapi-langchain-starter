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

**1. 이름 바꾸기**
`.env`의 `APP_NAME`, `frontend/components/app-header.tsx`의 표시 문구.

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
`main`에 push하거나 PR을 올리면 GitHub Actions가 자동 실행됩니다.

```
git push origin main
→ CI: 린트·타입·테스트·빌드 (verify)
→ CI: 브라우저 E2E
→ 둘 다 통과해야 배포 단계로 넘어갑니다
```

로컬과 CI는 **같은 스크립트**(`scripts/verify.sh`, `scripts/e2e.sh`)를 실행합니다.
테스트가 실패하면 배포는 실행되지 않습니다.

### 배포 (Render)

배포 대상은 **Render**입니다. 아래 설정이 끝나기 전까지 Deploy 워크플로는 건너뜁니다
(아무것도 배포하지 않았는데 초록불이 켜지는 것을 막기 위함입니다).

**GitHub에 등록할 값** — Settings → Secrets and variables → Actions

| 종류 | 이름 | 값 |
|---|---|---|
| Variable | `DEPLOY_TARGET` | `render` |
| Variable | `BACKEND_URL` | 배포된 백엔드 주소 |
| Secret | `RENDER_DEPLOY_HOOK_URL` | Render 서비스의 Deploy Hook 주소 |

**Render에 등록할 환경 변수**

| 이름 | 값 |
|---|---|
| `APP_ENV` | `production` |
| `DATABASE_URL` | Render PostgreSQL의 Internal Database URL |
| `JWT_SECRET_KEY` | `openssl rand -hex 32` 결과 |
| `OPENAI_API_KEY` | 실제 키 |
| `CORS_ORIGINS` | 프론트엔드 주소 (예: `["https://내앱.onrender.com"]`) |

> 운영에서는 기본 `JWT_SECRET_KEY`나 LLM 키 누락을 **설정 단계에서 막습니다**.
> 값이 빠지면 서버가 아예 뜨지 않으니, 배포가 실패하면 먼저 환경 변수를 확인하세요.

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
| 프론트엔드에서 API 호출 실패 | CORS 설정에 주소가 없음 | `.env`의 `CORS_ORIGINS`에 프론트엔드 주소 추가 |
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
