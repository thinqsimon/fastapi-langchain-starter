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

## LLM 사용량·비용
- 토큰 수는 assistant 메시지(`messages.input_tokens/output_tokens`)에 기록한다. 별도 집계 테이블은 두지 않는다
- OpenAI는 `stream_usage=True`를 줘야 스트리밍에서도 사용량이 온다
- 단가는 `llm/pricing.py`의 기본 표를 쓰고, `.env`의 `LLM_PRICE_*_PER_1M`로 덮어쓸 수 있다
- 표에 없는 모델은 비용 0으로 계산하고 경고만 남긴다(사용량 조회가 실패하지 않도록)
