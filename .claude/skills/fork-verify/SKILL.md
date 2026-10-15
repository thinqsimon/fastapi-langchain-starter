---
name: fork-verify
description: 스타터킷 재사용성 검증(4단계). 커밋된 상태만으로 새 폴더에서 README 절차대로 실행되는지 확인할 때 사용.
---
# Fork 재사용성 검증

1. 작업 트리가 깨끗한지 확인(`git status`). 미커밋 변경은 검증 대상이 아님을 알린다
2. `make fork-verify` 실행 (임시 폴더 clone → init.sh → verify.sh)
3. 추가로 README "빠른 시작"의 명령을 하나씩 따라 하며 문서와 실제가 다른 곳을 찾는다
   - 누락된 준비물, 틀린 명령, 설명 없는 환경 변수
4. 결과를 `docs/guides/fork-verification.md`에 날짜·환경(OS, Python, Node, Docker 버전)·결과·발견 이슈로 기록
5. 문서 수정이 필요하면 docs-writer에게 목록으로 넘긴다
