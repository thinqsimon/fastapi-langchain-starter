#!/usr/bin/env bash
# 최초 실행 환경 구성. 여러 번 실행해도 안전하다(idempotent).
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env ] || { cp .env.example .env; echo "→ .env 생성 (LLM_API_KEY를 채우세요)"; }

echo "→ backend 의존성 설치"
(cd backend && uv sync)

echo "→ frontend 의존성 설치"
(cd frontend && npm install)

if command -v docker >/dev/null 2>&1; then
  echo "→ DB 기동 및 마이그레이션"
  docker compose up -d --wait db
  (cd backend && uv run alembic upgrade head)
else
  echo "⚠ docker가 없어 DB 단계를 건너뜁니다. Docker Desktop 설치 후 'make db migrate' 실행"
fi

echo "✓ init 완료: make dev-backend / make dev-frontend"
