# Progress Log

세션 인수인계 기록. 새 세션은 맨 아래 항목부터 읽는다. 막힌 문제는 `문제/원인/해결/재발방지`로 남긴다
(→ `docs/guides/troubleshooting.md`의 원천 데이터).

---

## 2026-10-15 · 세션 1 · 저장소 구조 리팩토링 (하네스 스캐폴드)

**한 일**
- 2nd_Sample을 모노레포 루트로 전환, git init. 요구사항 문서를 `docs/requirements/`로 이동
- backend: uv + FastAPI 뼈대(`core/` 설정·DB·예외·로깅, `domain/{auth,chat,usage}` 계층 스텁, `llm/` 공급자 팩토리 + fake LLM), Alembic 초기화, import-linter 계층 계약, 테스트 3개
- frontend: Next 16 + shadcn + zustand + axios, `api/client.ts`, 로그인/회원가입/채팅 페이지 자리
- 하네스: CLAUDE.md, feature_list.json, scripts(init/verify/fork-verify), Makefile, `.claude/`(hooks·agents·skills), CI 워크플로
- `./scripts/verify.sh` 통과 → SETUP-02, SETUP-03 passes=true

**막힌 점**
- 문제: frontend `tsc --noEmit`에서 `LayoutProps`를 찾지 못함
  - 원인: Next 16의 전역 라우트 타입은 `next typegen`(또는 build)으로 생성된다
  - 해결: `typecheck` 스크립트를 `next typegen && tsc --noEmit`으로 변경
  - 재발방지: verify.sh가 같은 스크립트를 사용
- 이 Mac에 Docker가 없어 DB 마이그레이션은 아직 검증하지 못함

**다음 할 일**
- [사용자] Docker Desktop 설치 → `make db migrate`
- [TBD] 강의 제공 LLM API 종류·키, 배포 대상, 팀 구성
- 다음 기능: SETUP-01(설계 문서 확정) → BE-01 → DB-01 → AUTH-01
