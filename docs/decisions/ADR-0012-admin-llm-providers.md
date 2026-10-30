# ADR-0012: 관리자 서버 설정 — LLM 공급자 우선순위·자동 전환·강제 사용 (ADMIN-01)

- 상태: 채택 (2026-10-30)
- 관련: ADR-0002(스택), ADR-0003(사용자 스키마), `backend/src/app/domain/admin/`, `backend/src/app/llm/providers.py`

## 배경

지금까지 LLM 공급자는 `.env`의 `LLM_PROVIDER`/`LLM_MODEL`/`LLM_API_KEY` 하나뿐이었다. OpenAI 한도가
바닥나면 서비스 전체가 멈추고, 바꾸려면 배포 환경 변수를 고치고 재시작해야 했다. 운영자(관리자)가 화면에서
OpenAI·Claude(Anthropic)·Gemini(Google) 키와 모델을 등록하고, 우선순위대로 쓰다가 앞 공급자가 실패하면
다음으로 자동 전환되며, 필요하면 특정 공급자만 강제로 쓰게 하고 싶다.

## 결정

### 관리자 판별: 설정 파일의 이메일 목록
- `ADMIN_EMAILS`(쉼표 구분)에 적힌 이메일만 관리자다. `users` 테이블에 컬럼을 추가하지 않는다.
- `/api/auth/me`가 `is_admin`(계산 필드)을 내려 주고, 프론트는 그 값으로 계정 메뉴의 **서버 설정** 버튼을
  '설정' 버튼 위에 보여 준다. `/admin` 주소로 직접 들어와도 화면과 API(403)가 다시 막는다.
- 이유: 지금 관리자는 한 명이고 DB 마이그레이션 없이 배포 환경 변수만으로 추가·제외할 수 있다. 관리자가
  여럿이 되고 화면에서 권한을 주고받아야 하면 그때 `is_admin` 컬럼으로 옮긴다.

### 저장: `llm_provider_settings` (공급자당 한 행, 전역)
| 컬럼 | 뜻 |
|---|---|
| `provider` (unique) | `openai` / `anthropic` / `google_genai` — langchain `init_chat_model`의 이름 그대로 |
| `model` | 그 공급자에서 쓸 모델 ID |
| `encrypted_api_key` | Fernet으로 암호화한 키. NULL이면 키 없음 |
| `priority` | 작을수록 먼저 시도 |
| `enabled` | 꺼두면 목록에서 제외 |
| `forced` | 켜면 이 공급자만 쓴다. 부분 유니크 인덱스로 한 행만 true |

- 키는 `SETTINGS_ENCRYPTION_KEY`로 대칭 암호화해 저장한다(bcrypt 같은 단방향 해시는 호출 때 원문이 필요해
  쓸 수 없다). API 응답은 키 원문을 절대 돌려주지 않고 `has_api_key`만 준다. 키를 바꾸려면 새로 입력한다.
- 처음 목록을 읽을 때 세 공급자 행을 **꺼진 상태·키 없음**으로 만들어 둔다(데이터 마이그레이션 대신 서비스가
  멱등하게 채운다).

### 호출 규칙 (`AdminLlmSettingsService.active_provider_chain()`)
1. 키가 있고 켜진 행 중 `forced`가 있으면 **그것 하나만** 쓴다(자동 전환 없음).
2. 없으면 키가 있고 켜진 행을 `priority` 순으로 모두 시도한다.
3. 그런 행이 하나도 없으면 빈 목록 → `llm/chains/*`가 예전처럼 `.env` 설정 하나만 쓴다.
   관리자가 아무것도 건드리지 않은 Fork는 동작이 달라지지 않는다.
4. 복호화에 실패한 행(암호화 키가 바뀐 경우)은 경고만 남기고 건너뛴다. 요청 전체를 막지 않는다.

### 자동 전환은 "실제 오류"로 판단한다
- `llm/chains/chat.py`·`diary.py`가 공급자 목록을 받아 순서대로 시도한다. 모델 생성이나 호출에서 예외가 나면
  (한도 초과 429, insufficient_quota, 잘못된 키 등) 다음 공급자로 넘어가고, 모두 실패하면 `LLMError` 하나로
  묶는다. 사용량을 우리가 세어 한도를 추정하지 않는다 — 공급자 쪽 실제 잔여 한도를 그대로 따른다.
- 스트리밍은 **한 글자라도 보낸 뒤에는 전환하지 않는다.** 두 공급자의 답이 섞이는 것을 막는다.
  실제 한도 오류는 첫 응답 전에 나므로 충분하다.

### 계층 규칙 유지
- `app.llm`은 여전히 `app.domain`을 모른다. DB를 읽는 건 `domain/admin`이고, `ProviderAttempt`(공급자·모델·키)
  목록을 `llm/chains/*` 함수의 인자로 넘긴다. `get_chat_model()`은 인자를 받되 비우면 `.env`를 쓴다.
- `.env`가 `LLM_PROVIDER=fake`면 관리자가 무엇을 등록했든 항상 테스트용 모델을 돌려준다(테스트·E2E가 실제 API를
  부르지 못하게 하는 안전장치).

## API
- `GET /api/admin/llm-providers` → 공급자 3개(`provider, model, has_api_key, priority, enabled, forced, updated_at`)
- `PATCH /api/admin/llm-providers/{provider}` → 보낸 필드만 변경. `api_key`를 보내지 않으면 유지, 빈 문자열이면 삭제.
  `forced: true`면 다른 행의 forced를 끈다. 관리자가 아니면 403, 비로그인 401.

## 운영 체크리스트
1. 배포 환경 변수에 `ADMIN_EMAILS`, `SETTINGS_ENCRYPTION_KEY`(Fernet 키) 추가 후 재배포
2. `cd backend && uv run alembic upgrade head` (9f11c3af7799)
3. `langchain-anthropic`, `langchain-google-genai`, `cryptography` 의존성이 설치된다(uv sync)
4. `SETTINGS_ENCRYPTION_KEY`를 바꾸면 저장된 키를 복호화할 수 없다 → 화면에서 키를 다시 입력한다

## 대안과 기각 이유
- **사용량 한도를 관리자가 입력해 선제 차단**: 한도를 가늠해 넣어야 하고 너무 낮게 잡으면 멀쩡한 키를 못 쓴다.
  필요해지면 "실제 오류" 방식 위에 추가할 수 있다.
- **키를 `.env`에만 두고 화면은 순서만 바꾸기**: 키를 바꿀 때마다 재배포가 필요해 요구사항(화면에서 키 관리)에 맞지 않는다.
- **`users.is_admin` 컬럼**: 지금은 과하다. 위 '관리자 판별' 참고.

## 후속 (2026-10-31, LLM-02): 응답 형태 정규화와 메시지별 공급자·모델 기록

- **증상**: Gemini는 응답 `content`를 문자열이 아니라 블록 리스트(`[{"type":"text",...}, {"extras":{"signature":...}}]`)로 준다.
  `str()`로 바꿔 흘리던 코드 때문에 리스트 원문이 화면과 DB에 그대로 들어갔다. Claude도 thinking을 켜면 리스트다.
- **결정**: `llm/chains/chat.text_of()`가 문자열/블록 리스트를 모두 받아 **텍스트 블록만** 이어 붙인다(서명·thinking·도구 호출 블록 제외).
  공급자가 늘어도 이 한 곳만 지키면 된다. 이미 깨진 채로 저장된 과거 메시지는 복구하지 않기로 했다(사용자 결정).
- **메시지별 모델 기록**: `messages.provider`, `messages.model`(nullable)을 추가하고, 스트리밍의 첫 청크가 올 때 실제로 답한 공급자·모델을
  저장한다(우선순위 전환이 일어나면 뒤쪽 공급자가 기록된다). 화면은 답변 아래에 "Gemini · gemini-2.5-flash"처럼 표기하고, 사용량은
  **모델별 단가로 합산**한다(`/api/usage/me`의 `by_model`). 컬럼이 생기기 전 답변(NULL)은 예전처럼 `.env`의 `LLM_MODEL`로 본다.
- `.env`의 `LLM_PRICE_*` 단가는 `.env`의 모델에만 적용한다. 다른 모델은 `llm/pricing.py` 기본 표(Gemini 2.0/2.5 추가)를 쓴다.

## 다음 단계로 확정한 설계 (2026-10-31, ADMIN-03 요금제별 라우팅)

사용자 결정: 요금제(free/pro/max)마다 공급자 순서·모델을 전부 따로 두고, `users.plan`을 추가해 관리자가 수동 지정한다. 구독 결제는 나중.
- `llm_providers`(공급자별 API 키, 전역) / `llm_plan_routes`(plan·순서·공급자·모델·사용·강제, 요금제당 강제 1행) / `users.plan`(기본 free) / `messages.plan`
- `active_provider_chain(plan)`: 그 요금제 라우트 → 없으면 free 라우트 → 없으면 `.env`. 지금의 `llm_provider_settings`는 free 라우트로 데이터 이전
- 관리자 화면: 사용자 카드에 요금제 변경, 공급자 키 카드(키만), 요금제 탭별 라우팅 + "지금 동작"
- 나중(구독): `subscriptions`(plan·시작/만료·상태·결제사 id)가 `users.plan`을 채우고, 요금제별 한도는 `plan_limits`로
