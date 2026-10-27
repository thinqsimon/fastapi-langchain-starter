---
name: handoff
description: 작업 세션을 마칠 때 사용. progress.md 인수인계 기록, feature passes 갱신, 커밋까지 수행한다.
---
# 세션 종료 인수인계

1. `./scripts/verify.sh` 실행. 실패하면 passes를 바꾸지 말고 실패 내용을 기록한다
2. 세션 중 curl·화면으로 수동 확인하며 만든 계정을 지운다: `make clean-test-accounts args="--delete"`
   (계정은 `@example.com`만 써야 지워진다. 원격 DB는 `--remote` 필요, 팀원 계정이 아닌지 먼저 확인)
3. 이번 세션 기능의 acceptance가 모두 확인됐을 때만 `harness/feature_list.json`의 `passes`를 `true`로
4. `harness/progress.md` 맨 아래에 추가:
   ```
   ## YYYY-MM-DD · 세션 N · <feature id> <제목>
   **한 일** / **막힌 점**(문제·원인·해결·재발방지) / **다음 할 일**
   ```
5. 변경 사항 커밋: `<type>(<scope>): <요약> [<feature id>]` (type: feat/fix/docs/chore/test/ci)
6. 사용자에게 3줄 요약 + 다음 추천 기능을 보고한다
