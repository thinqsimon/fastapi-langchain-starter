# ADR-0002 기술 스택

- 상태: 채택 (2026-10-15)

| 영역 | 선택 | 이유 |
|---|---|---|
| 백엔드 | FastAPI + SQLAlchemy 2.0 + Alembic, uv | 과제 필수, 수업 예제(2026_FullStack_BE)와 동일한 도구 |
| 구조 | `domain/<기능>/` + routers/services/repositories | 수업의 도메인 폴더 관례 + 과제의 데이터 접근 계층 분리 |
| 프론트 | Next.js 16 + shadcn + zustand + axios | 수업 예제(2026-FullStack)와 동일, React 요구 충족 |
| DB | PostgreSQL 17 + pgvector (Docker Compose) | RAG 확장을 별도 벡터 DB 없이 처리 |
| LLM | LangChain `init_chat_model` | .env만으로 공급자 교체, fake 공급자로 키 없는 CI |
| 스트리밍 | SSE | 단방향 토큰 전송에 충분, 프록시·배포 환경 호환 |
| 인증 | PyJWT + bcrypt, access/refresh | 과제 필수, python-jose는 유지보수 중단으로 제외 |
| 배포 | Supabase(DB) + Render(백엔드) + Vercel(프론트) | 2026-10-15 확정. [ADR-0004](ADR-0004-deployment.md) 참고 |
