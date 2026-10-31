# ADR-0014: 요금제(free/pro/max)별 LLM 라우팅 (ADMIN-03)

- 상태: 채택 (2026-10-31)
- 관련: ADR-0012(관리자 LLM 공급자 설정), ADR-0013(사용자 계정으로 테스트), `backend/src/app/core/plans.py`, `backend/src/app/domain/admin/`

## 배경

앞으로 구독제(free/pro/max)를 붙이면 요금제마다 다른 모델을 써야 한다(무료는 싼 모델, 유료는 좋은 모델).
ADMIN-01의 `llm_provider_settings`는 공급자 한 줄에 키·모델·순서가 함께 있어 요금제별로 나눌 수 없었다.

## 결정

### 키와 라우팅을 분리한다
| 테이블 | 역할 |
|---|---|
| `llm_providers` | 공급자별 **API 키**(암호화). 공급자당 1행, 전역 |
| `llm_plan_routes` | **요금제별 라우트**: plan, priority, provider(FK), model, enabled, forced. 요금제당 forced는 1행(부분 유니크 인덱스) |
| `users.plan` | 사용자 요금제(기본 `free`). 지금은 관리자가 수동 지정 |
| `messages.plan` | 답할 때의 요금제. 요금제별 비용 분석용 |

기존 `llm_provider_settings` 행은 마이그레이션(`804e78cdbab8`)이 키 → `llm_providers`, 모델·순서·사용·강제 → `free` 라우트로 옮기고 테이블을 지운다.

### 호출 규칙 `active_provider_chain(plan)`
1. 그 요금제의 라우트 중 **켜져 있고 공급자 키가 있는 것**만 우선순위대로
2. 강제 라우트가 있으면 그것 하나만
3. 하나도 없으면 **free 라우트**로(새 요금제를 아직 설정하지 않았을 때 자연스럽게 기본으로)
4. 그것도 없으면 빈 목록 → `.env`의 공급자 하나(설정을 건드린 적 없는 Fork는 동작이 그대로)

chat/diary 라우터가 `current_user.plan`을 서비스에 넘기고, 답변 메시지에 `provider`·`model`·`plan`을 기록한다.
관리자가 "이 계정으로 테스트" 중이면 대상 사용자의 요금제를 탄다(재현에 맞다).

### 요금제 지정
- `PATCH /api/admin/users/{id}/plan` (`free|pro|max`). `admin_plan_changed admin= target= plan= previous=` 로그.
- `/api/auth/me`에 `plan`. 계정 메뉴에 "요금제 Free/Pro/Max" 표시.
- 요금제 이름은 `app/core/plans.py`의 Literal 하나로 관리한다. 새 등급은 여기와 프론트 `lib/llm-labels.ts`만 늘린다.

### 관리자 화면(`/admin`)
① 사용자(검색 · **요금제 선택** · 이 계정으로 테스트) ② 지금 동작(요금제별 한 줄) ③ 공급자 API 키(3장, 키만)
④ 요금제별 라우팅(Free/Pro/Max 탭 → 라우트 목록: 모델 수정, 위/아래, 사용, 강제, 삭제 + 라우트 추가)

## API
- `GET/PATCH /api/admin/llm-providers[/{provider}]` → `{provider, has_api_key, updated_at}`; PATCH 본문 `{api_key}`(빈 값=삭제)
- `GET/POST /api/admin/llm-routes`, `PATCH/DELETE /api/admin/llm-routes/{id}` → `{id, plan, priority, provider, model, enabled, forced, has_api_key}`
- `PATCH /api/admin/users/{id}/plan`

## 나중(구독 결제) 설계 메모
- `subscriptions`(user_id, plan, 시작·만료, 상태, 결제사 고객/구독 id) 테이블이 `users.plan`을 채우고, 만료 시 `free`로 되돌린다
- 요금제별 한도(일일 메시지·토큰)는 `plan_limits`(plan, 항목, 값)로 두고 chat 서비스 앞단에서 검사한다
- 라우팅은 위 구조 그대로 쓴다. 요금제가 늘어도 테이블은 바뀌지 않는다

## 대안과 기각 이유
- **요금제별로 모델 이름만 다르게**: 공급자 순서·강제가 전역이라 "max는 Claude 먼저" 같은 차이를 못 둔다.
- **한 테이블에 plan 컬럼 추가**: 키가 요금제 수만큼 복제되고, 키 교체 때 여러 행을 고쳐야 한다.

## 후속 (2026-10-31, ADMIN-04): 요금제별 기본 라우트 = 모델 사다리

사용자 요청: 교육용에 맞는 모델 중에서 Free에 비해 Pro·Max는 한 단계씩 비싼 모델이 기본으로 설정되게.

| 공급자 | Free | Pro | Max |
|---|---|---|---|
| Gemini | gemini-2.5-flash ($0.30/$2.50) | gemini-2.5-pro ($1.25/$10) | gemini-2.5-pro |
| OpenAI | gpt-4o-mini ($0.15/$0.60) | gpt-4.1-mini ($0.40/$1.60) | gpt-4.1 ($2/$8) |
| Claude | claude-haiku-5-5 ($0.10/$0.50) | claude-sonnet-5-5 ($2/$10) | claude-opus-5-5 ($4/$20) |

- 순서: Free·Pro는 Gemini → OpenAI → Claude, Max는 GPT-4.1 → Gemini 2.5 Pro → Claude Opus. 1순위 입력 단가 Free $0.30 → Pro $1.25 → Max $2.00.
- 값은 `app/domain/admin/defaults.py` 한 곳(프론트 `lib/llm-labels.ts`의 `DEFAULT_ROUTE_MODELS`가 같은 값)과, 그때의 값을 복사한 데이터 마이그레이션 `708a27953136`.
- **라우트가 하나도 없는 요금제에만** 넣는다. 운영의 free처럼 이미 설정된 요금제는 건드리지 않는다(로컬에서 운영 상태를 재현해 확인).
  목록 조회가 몰래 채우지는 않는다(관리자가 지운 요금제가 되살아나지 않게). 빈 요금제는 화면의 "기본 라우트 채우기"(`POST /api/admin/llm-routes/defaults`).
- 라우트 추가 폼은 요금제·공급자에 맞는 기본 모델을 미리 채운다.
- 선택 이유: Gemini는 2.5 Pro 위로 안정판이 없어 Max도 2.5 Pro. OpenAI GPT-5 계열은 temperature를 기본값만 받아 제외.
  처음 표에 있던 claude-opus-4-1은 2026-08-05에 퇴역(호출 실패), claude-sonnet-4-5는 2026-11-30 퇴역 예정이라 5.5 계열로 바꿨다.
- **Claude에는 temperature를 보내지 않는다**(`llm/providers._provider_kwargs`). 설치된 anthropic SDK 2.3.0은 API 버전 `2026-10-21`을 쓰는데,
  이 버전은 temperature·top_p·top_k를 보내면 모든 모델에서 400이다. 5.5 계열은 그 전부터 기본값만 받고, langchain-anthropic은 요청 전에 ValueError를 냈다.
  이 수정 전에는 Claude 키를 넣어도 모든 Claude 라우트가 실패해 다음 공급자로 넘어갔다. OpenAI·Gemini에는 `LLM_TEMPERATURE`를 그대로 보낸다.
- 테스트: 공급자마다 Free < Pro ≤ Max(OpenAI·Claude는 Pro < Max), 요금제 1순위 입력 단가 Free < Pro < Max, 기본 모델이 모두 단가표에 있음, Claude 요청 본문에 temperature 없음.
