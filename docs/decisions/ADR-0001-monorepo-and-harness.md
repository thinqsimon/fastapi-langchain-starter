# ADR-0001 모노레포 + 에이전트 하네스

- 상태: 채택 (2026-10-15)

## 맥락
2주 안에 스타터킷·샘플앱·CI/CD·문서를 완성해야 하고, 구현 대부분을 AI 코딩 에이전트와 함께 한다.
에이전트는 세션 사이 기억이 없고, 범위를 넘거나 검증 없이 완료를 선언하는 실수를 한다.

## 결정
- backend·frontend·docs·CI를 한 저장소에 둔다 (Fork 한 번으로 전체 시작)
- 하네스를 저장소에 포함한다: `CLAUDE.md`(목차), `harness/feature_list.json`(인수조건), `harness/progress.md`(인수인계),
  `scripts/verify.sh`(단일 게이트), `.claude/`(hooks·agents·skills), import-linter(계층 규칙 강제)

## 결과
- Fork한 개발자의 에이전트도 같은 규칙으로 커스터마이징 가능 → 스타터킷의 차별점
- progress.md가 트러블슈팅 보고서의 원천 데이터가 된다
