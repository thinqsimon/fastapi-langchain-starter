#!/usr/bin/env bash
# 브라우저 E2E 테스트. 백엔드(+DB)를 띄우고 Playwright를 실행한다.
# 프론트엔드 개발 서버는 playwright.config.ts의 webServer가 관리한다.
# 개발용 8000 포트와 겹치지 않도록 전용 포트를 쓴다(BACKEND_PORT로 변경 가능).
set -euo pipefail
cd "$(dirname "$0")/.."

BACKEND_PORT="${BACKEND_PORT:-8010}"
BACKEND_URL="http://localhost:${BACKEND_PORT}"
export NEXT_PUBLIC_API_BASE_URL="$BACKEND_URL"
export APP_PROFILE="${APP_PROFILE:-diary-coach}"
export NEXT_PUBLIC_APP_PROFILE="$APP_PROFILE"
# E2E 프론트엔드는 3100에서 뜨므로 백엔드 CORS에 그 출처를 허용한다.
# 실제 LLM을 호출하지 않는다. 키 없이도 돌고 결과가 일정하다.
export LLM_PROVIDER="fake"
# .env가 원격 DB를 가리켜도 E2E는 로컬 DB에서 돈다(운영 데이터 보호).
export DATABASE_URL="${E2E_DATABASE_URL:-postgresql+psycopg://app:app@localhost:5432/app}"
export CORS_ORIGINS='["http://localhost:3100","http://127.0.0.1:3100"]' 

backend_pid=""
cleanup() {
  [ -n "$backend_pid" ] && kill "$backend_pid" 2>/dev/null || true
  # `uv run`이 자식 프로세스를 남기므로 포트를 기준으로 한 번 더 정리한다.
  lsof -ti tcp:"$BACKEND_PORT" 2>/dev/null | while read -r pid; do kill "$pid" 2>/dev/null || true; done
}
trap cleanup EXIT

if lsof -ti tcp:"$BACKEND_PORT" > /dev/null 2>&1; then
  echo "✗ 포트 ${BACKEND_PORT}이 이미 사용 중입니다. 정리 후 다시 실행하세요:"
  echo "  lsof -ti tcp:${BACKEND_PORT} | xargs kill"
  exit 1
fi

echo "→ 백엔드 기동 (:${BACKEND_PORT})"
(cd backend && uv run uvicorn app.main:app --port "$BACKEND_PORT" > /tmp/ax-e2e-backend.log 2>&1) &
backend_pid=$!

for _ in $(seq 1 40); do
  curl -sf "$BACKEND_URL/health" > /dev/null 2>&1 && break
  sleep 0.5
done

curl -sf "$BACKEND_URL/health" > /dev/null || {
  echo "✗ 백엔드가 뜨지 않았습니다. DB가 떠 있는지 확인하세요(make db)."
  tail -20 /tmp/ax-e2e-backend.log
  exit 1
}

echo "→ Playwright 실행"
(cd frontend && npm run -s e2e -- "$@")
echo "✓ e2e passed"
