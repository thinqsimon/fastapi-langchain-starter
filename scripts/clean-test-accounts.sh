#!/usr/bin/env bash
# 테스트·수동 확인용 계정(@example.com)을 DB에서 지운다.
# 사용: ./scripts/clean-test-accounts.sh            # 대상만 표시(dry-run)
#       ./scripts/clean-test-accounts.sh --delete   # 로컬 DB에서 삭제
#       ./scripts/clean-test-accounts.sh --delete --remote   # 원격(Supabase 등)도 허용
# 대상 DB는 DATABASE_URL(환경 변수 > .env). 원격은 --remote 없이는 거부한다.
set -euo pipefail
cd "$(dirname "$0")/../backend"
exec uv run python scripts/clean_test_accounts.py "$@"
