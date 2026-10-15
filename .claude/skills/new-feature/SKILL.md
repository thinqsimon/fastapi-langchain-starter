---
name: new-feature
description: harness/feature_list.json의 기능 하나를 시작할 때 사용. 다음 기능 선택, 브랜치 생성, 필요 시 새 도메인 폴더 스캐폴드까지 수행한다.
---
# 새 기능 시작

1. `harness/progress.md` 마지막 항목과 `harness/feature_list.json`을 읽는다
2. 인자로 feature id가 없으면 `passes:false` 중 phase가 가장 낮은 첫 항목을 고르고 사용자에게 알린다
3. `git switch -c feat/<id 소문자>` (이미 있으면 switch)
4. 새 도메인이 필요하면 `add-domain-model` 스킬 절차로 폴더를 만든다
5. acceptance를 체크리스트로 출력하고, 담당 owner 서브에이전트(backend-dev 등)에 작업을 위임하거나 직접 구현한다
6. 구현 후 test-verifier로 판정 → 통과 시 `handoff` 스킬
