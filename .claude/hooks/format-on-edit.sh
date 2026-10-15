#!/usr/bin/env bash
# PostToolUse(Edit|Write): 수정된 파일을 즉시 포맷·린트 수정한다. 실패해도 작업은 막지 않는다.
file=$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))')
root="$CLAUDE_PROJECT_DIR"
case "$file" in
  "$root"/backend/*.py)
    (cd "$root/backend" && uv run -q ruff format "$file" && uv run -q ruff check --fix -q "$file") >&2 || true ;;
  "$root"/frontend/*.ts|"$root"/frontend/*.tsx)
    (cd "$root/frontend" && npx prettier --write --log-level warn "$file") >&2 || true ;;
esac
exit 0
