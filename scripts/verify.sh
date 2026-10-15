#!/usr/bin/env bash
# 단일 품질 게이트. 에이전트·git hook·GitHub Actions가 모두 이 스크립트를 실행한다.
# 사용: ./scripts/verify.sh [backend|frontend]   (인자 없으면 전체)
set -euo pipefail
cd "$(dirname "$0")/.."
target="${1:-all}"

if [[ "$target" == "all" || "$target" == "backend" ]]; then
  echo "== backend =="
  (
    cd backend
    uv run ruff format --check .
    uv run ruff check .
    uv run mypy
    uv run lint-imports
    uv run pytest -q
  )
fi

if [[ "$target" == "all" || "$target" == "frontend" ]]; then
  echo "== frontend =="
  (
    cd frontend
    npm run -s format:check
    npm run -s lint
    npm run -s typecheck
    npm run -s build
  )
fi

echo "✓ verify passed ($target)"
