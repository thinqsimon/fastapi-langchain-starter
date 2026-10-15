# 코딩 규칙

## 공통
- 단일 품질 게이트: `./scripts/verify.sh` (로컬·에이전트·CI 동일)
- 커밋 메시지: `<type>(<scope>): <요약> [<feature id>]` — type: feat, fix, docs, chore, test, ci, refactor
- 브랜치: `feat/<feature-id>`, main은 CI 통과 PR만 merge

## API
- prefix `/api`, 리소스는 복수형 (`/api/conversations`)
- 에러 응답: `{"error": {"code": "NOT_FOUND", "message": "..."}}`
- 인증: `Authorization: Bearer <access>`; refresh는 `POST /api/auth/refresh`

## SSE 이벤트 (CHAT-02에서 확정)
```
event: token   data: {"content": "..."}
event: done    data: {"message_id": 1, "usage": {"input_tokens": 0, "output_tokens": 0}}
event: error   data: {"code": "LLM_ERROR", "message": "..."}
```

## 백엔드 / 프론트엔드
`backend/CLAUDE.md`, `frontend/CLAUDE.md` 참고.
