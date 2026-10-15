#!/usr/bin/env bash
# 재사용성 검증: 커밋된 상태만으로 새 폴더에서 init → verify가 되는지 확인한다.
# (로컬 .env·node_modules·.venv 없이 README 절차를 그대로 재현)
set -euo pipefail
repo="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

echo "→ clone to $work"
git clone -q "$repo" "$work/kit"
cd "$work/kit"
./scripts/init.sh
./scripts/verify.sh
echo "✓ fork-verify passed"
