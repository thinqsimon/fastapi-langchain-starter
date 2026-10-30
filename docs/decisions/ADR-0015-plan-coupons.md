# ADR-0015: 요금제 쿠폰 (COUPON-01)

- 상태: 채택 (2026-10-31)
- 관련: ADR-0014(요금제별 라우팅), `backend/src/app/domain/coupon/`, `frontend/components/admin/coupon-admin.tsx`, `frontend/components/settings/plan-coupon-card.tsx`

## 배경
구독 결제가 붙기 전에도 Pro/Max를 나눠 줄 수단이 필요하다. 카카오톡 선물처럼 **코드를 만들어 보내고, 받은 사람이
기한 안에 등록하면 그날부터 기간만큼** 요금제가 적용되는 쿠폰을 둔다.

## 결정

### 데이터
| 항목 | 내용 |
|---|---|
| `coupons` | `code`(하이픈 없는 12자, unique), `plan`(pro/max), `duration`(7d/15d/1m/3m/6m/12m), `expires_at`(등록 기한), `memo`, `batch_id`, `created_by`, `redeemed_by/at`, `plan_until`, `revoked_at` |
| `users.plan_expires_at` | 쿠폰으로 생긴 요금제 만료 시각. NULL = 기한 없음(관리자가 직접 지정) |
| 상태 | 컬럼이 아니라 계산: 취소 > 사용됨 > 만료(`expires_at` 지남) > 미사용 |

- 코드 글자: `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`(0/O, 1/I 제외) 12자리. 입력은 하이픈·공백·대소문자를 정규화한다.
- 기간은 **등록 시각부터** 센다. 개월은 달력 기준(10/31 + 1개월 = 11/30).
- 등록 기한은 발급 때 7·14·30·90일 중 선택(기본 30일). 수량 1~20장, 같은 요청은 `batch_id`로 묶인다.

### 등록 규칙 (사용자 결정)
| 지금 요금제 | 쿠폰 | 결과 |
|---|---|---|
| Free(또는 기한 지남) | Pro/Max | 지금부터 기간 적용 |
| Pro (기한 있음) | Pro | 남은 기간 **뒤에** 이어 붙임 |
| Pro | Max | **확인 필요**(409 `CONFIRM_REQUIRED`) → `confirm: true`면 지금부터 Max, 남은 Pro는 소멸 |
| Max | Pro | 거부(409). 쿠폰은 살아 있다 |
| 기한 없는 Pro(관리자 지정) | Pro | 거부("필요 없어요") |

### 만료 처리
- 배치 없이 `get_current_user`가 요청마다 `expire_plan_if_due()`로 확인한다. 기한이 지난 뒤 첫 요청에서 free로 내려가고 `plan_expired` 로그가 남는다.
- 미사용 쿠폰의 만료는 `expires_at` 비교로 계산한다(저장 상태 없음).

### 화면
- 관리자(`/admin` → 쿠폰): 발급 폼(요금제·기간·등록 기한·수량·메모) → 발급된 코드 목록과 **복사 / 모두 복사**(안내문에 코드·등록 기한·적용 내용·사용처 주소 포함) → 쿠폰 목록(상태 필터, 복사, 미사용만 취소).
- 사용자(`/settings` → 요금제와 쿠폰): 현재 요금제·만료일, 코드 입력 → 등록. 상위 요금제 쿠폰이면 "남은 기간이 사라져요" 대화상자.
- 계정 메뉴에 "Pro · 2026. 11. 30.까지".

### 로그
`coupon_issued`, `coupon_revoked`, `coupon_redeemed`, `plan_expired`. 코드 원문은 남기지 않는다(관리자 목록으로 조회).

## 대안과 기각
- **다회용 코드(인원 제한)**: 이벤트용으로는 편하지만 누가 썼는지 추적이 어렵고 유출 시 피해가 크다. 1회용 N장 발급으로 대신한다.
- **항상 지금부터 새로 시작**: 단순하지만 같은 요금제를 연장하는 사용자가 손해를 본다.
- **크론으로 만료 처리**: 배치 인프라가 없다. 요청 시 확인이 간단하고 정확하다.

## 나중
구독 결제가 들어오면 `subscriptions`가 `users.plan/plan_expires_at`을 채우고, 쿠폰은 결제 할인(무료 체험) 형태로 연결한다.
