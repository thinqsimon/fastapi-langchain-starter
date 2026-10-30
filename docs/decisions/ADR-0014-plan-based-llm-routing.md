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
