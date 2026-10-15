# AX Chat Starter

FastAPI · PostgreSQL(pgvector) · Next.js · LangChain 기반 **챗봇형 AI 서비스 스타터킷**.
Fork하면 인증, 대화 이력, LLM 스트리밍, CI/CD가 갖춰진 상태에서 새 AI 서비스를 시작할 수 있습니다.
샘플 서비스: **AI 배움일기 코치** (`samples/diary-coach/`).

> 🚧 개발 중. 진행 상황은 [harness/feature_list.json](harness/feature_list.json) 참고.

## 빠른 시작

준비물: Python 3.13+와 [uv](https://docs.astral.sh/uv/), Node 20+, Docker Desktop

```bash
git clone <Fork한 저장소 주소> && cd <저장소>
make init            # .env 생성, 의존성 설치, DB 기동, 마이그레이션
# .env의 LLM_API_KEY 입력 (키 없이 해보려면 LLM_PROVIDER=fake)
make dev-backend     # http://localhost:8000/health → {"status":"ok"}
make dev-frontend    # http://localhost:3000
```

품질 검사: `make verify`

## 문서
- 설계·계획: [docs/plans/](docs/plans/)
- 아키텍처: [docs/architecture.md](docs/architecture.md) · 코딩 규칙: [docs/conventions.md](docs/conventions.md)
- 사용·운영 가이드: `docs/guides/` (4단계에서 작성)
- AI 에이전트로 작업하기: [CLAUDE.md](CLAUDE.md)
