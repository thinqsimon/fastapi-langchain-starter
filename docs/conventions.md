# 코딩 규칙

## 공통
- 단일 품질 게이트: `./scripts/verify.sh` (로컬·에이전트·CI 동일)
- 커밋 메시지: `<type>(<scope>): <요약> [<feature id>]` — type: feat, fix, docs, chore, test, ci, refactor
- 브랜치: `feat/<feature-id>`, main은 CI 통과 PR만 merge

## API
- prefix `/api`, 리소스는 복수형 (`/api/conversations`)
- 에러 응답: `{"error": {"code": "NOT_FOUND", "message": "..."}}` — 검증 실패 시 `details: [{"field", "message"}]` 추가
- 에러 코드: `BAD_REQUEST` `UNAUTHORIZED` `FORBIDDEN` `NOT_FOUND` `CONFLICT` `VALIDATION_ERROR` `LLM_ERROR` `INTERNAL_ERROR`
- 모든 응답에 `X-Request-ID` 헤더. 클라이언트가 보내면 그 값을 쓰고 없으면 서버가 발급하며, 같은 값이 로그에 붙는다
- 500 응답은 내부 메시지를 노출하지 않는다. 원인은 서버 로그(`unhandled_error`)에서 request_id로 찾는다
- 인증: `Authorization: Bearer <access>`; refresh는 `POST /api/auth/refresh`

## SSE 이벤트 (CHAT-02에서 확정)
```
event: token   data: {"content": "..."}
event: done    data: {"message_id": 1, "usage": {"input_tokens": 0, "output_tokens": 0}}
event: error   data: {"code": "LLM_ERROR", "message": "..."}
```

## 백엔드 / 프론트엔드
`backend/CLAUDE.md`, `frontend/CLAUDE.md` 참고.

## 데이터베이스
- PK는 UUID(`server_default=gen_random_uuid()`). URL·토큰에 노출돼도 가입자 수가 추정되지 않는다
- 모든 테이블은 `TimestampMixin`을 상속해 `created_at`/`updated_at`(UTC)을 가진다
- 기본값은 Python(`default=`)과 DB(`server_default=`) 양쪽에 준다. 시드 데이터·psql 수동 작업에서도 채워져야 하므로
- 주의: `updated_at` 자동 갱신은 ORM을 거친 UPDATE에만 적용된다. 대량/raw SQL UPDATE에서는 직접 넣는다
- 사용자는 삭제하지 않고 `is_active=false`로 둔다(대화 이력 보존). 토큰은 사용자 삭제 시 CASCADE
- 리프레시 토큰은 원문이 아니라 SHA-256 해시로 저장한다

## 프론트엔드
- 토큰은 localStorage에 저장하고 `api/client.ts`의 인터셉터가 주입한다
- 401을 받으면 리프레시로 한 번만 재발급 후 원요청을 재시도한다(동시 요청은 한 번만 호출)
- 보호가 필요한 화면은 `app/(main)/` 아래에 둔다(`RequireAuth`가 감싼다)
- E2E: `./scripts/e2e.sh` (백엔드 :8010, 프론트 :3100 전용 포트. 개발 서버와 겹치지 않음)
- 모바일·반응형
  - flex 안에서 줄어들어야 하는 영역에는 `min-w-0`을 함께 둔다(아이폰은 입력칸 기본 너비가 넓어 화면 밖으로 밀렸다)
  - "터치 기기"는 화면 폭이 아니라 입력 방식으로 판단한다: hover 효과는 `[@media(hover:hover)]`, 입력칸 14px은 `md:[@media(pointer:fine)]`에서만
  - 입력칸 글자는 16px 이상(모바일 Safari가 누를 때 확대하지 않게)
  - 화면 아래에 닿는 요소는 `env(safe-area-inset-bottom)` 여백(`viewport-fit=cover`는 `app/layout.tsx`)
  - 서랍·모달은 화면 폭이 바뀌면 닫는다(배경 막만 남아 화면이 막히지 않게)
- 클립보드 복사는 `lib/clipboard.ts`(마크다운 글자 + HTML). 붙여 넣는 편집기는 CSS를 버리고 태그만 받으므로,
  붙여 넣기용 HTML은 크기·여백 대신 태그 단계와 빈 줄로 모양을 잡는다(`components/diary/diary-paste-document.tsx`)
- 로고 원본은 `public/brand/logo.svg` 하나. 파비콘·홈 화면 아이콘은 `npm run icons`로 만든다(손으로 고치지 않는다)

## LLM 사용량·비용
- 토큰 수는 assistant 메시지(`messages.input_tokens/output_tokens`)에 기록한다. 별도 집계 테이블은 두지 않는다
- OpenAI는 `stream_usage=True`를 줘야 스트리밍에서도 사용량이 온다
- 단가는 `llm/pricing.py`의 기본 표를 쓰고, `.env`의 `LLM_PRICE_*_PER_1M`로 덮어쓸 수 있다
- 표에 없는 모델은 비용 0으로 계산하고 경고만 남긴다(사용량 조회가 실패하지 않도록)

## 테스트
- 커버리지 90% 미만이면 게이트에서 막는다(`pyproject.toml`의 `--cov-fail-under`)
- 테스트는 실제 LLM을 부르지 않는다. `LLM_PROVIDER=fake`가 CI·E2E 설정에 박혀 있는지 테스트로 검사한다
- 새 모델을 만들면 `app/models.py`에 import한다. 빠뜨리면 등록 검사 테스트가 실패한다
- DB가 필요한 테스트는 트랜잭션을 열고 끝나면 되돌린다(`db_session` 픽스처). 데이터가 남지 않는다
- 브라우저 흐름은 `./scripts/e2e.sh`(Playwright). 단위 테스트가 놓친 실제 결함을 여기서 여러 번 잡았다

## 로컬·운영 DB 분리
- `DATABASE_URL` = 앱이 쓰는 DB (로컬 개발이든 Supabase든)
- `TEST_DATABASE_URL` = 테스트 전용. 항상 로컬이어야 하며, 원격이면 테스트가 실패한다
- E2E(`scripts/e2e.sh`)와 Fork 검증(`scripts/fork-verify.sh`)도 각자 로컬 DB를 쓴다

## 선택 기능 켜고 끄기
- `RAG_ENABLED=false`면 RAG 라우터가 **등록되지 않아** `/docs`에도 보이지 않는다
- 선택 기능은 import 시점이 아니라 `build_api_router()` 호출 시점에 판단한다
  (import 시점에 정하면 설정을 바꿔도 반영되지 않아 테스트가 어려워진다)
- 벡터 차원을 바꾸면 기존 임베딩과 맞지 않는다. 마이그레이션과 재색인이 필요하다
