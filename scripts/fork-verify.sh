#!/usr/bin/env bash
# 재사용성 검증: 커밋된 상태만으로 새 폴더에서 init → verify가 되는지 확인한다.
# (로컬 .env·node_modules·.venv 없이 README 절차를 그대로 재현)
set -euo pipefail
repo="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"

# 개발용 DB(5432)와 겹치지 않게 전용 포트를 쓴다.
export POSTGRES_PORT="${FORK_VERIFY_DB_PORT:-55432}"
export DATABASE_URL="postgresql+psycopg://app:app@localhost:${POSTGRES_PORT}/app"

cleanup() {
  if [ -d "$work/kit" ] && command -v docker > /dev/null 2>&1; then
    (cd "$work/kit" && docker compose down -v --remove-orphans > /dev/null 2>&1) || true
  fi
  rm -rf "$work"
}
trap cleanup EXIT

echo "→ clone to $work"
git clone -q "$repo" "$work/kit"
cd "$work/kit"
./scripts/init.sh
./scripts/verify.sh
echo "✓ fork-verify passed"
