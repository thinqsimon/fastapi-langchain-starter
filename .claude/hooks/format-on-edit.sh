#!/usr/bin/env bash
# PostToolUse(Edit|Write): 수정된 파일을 즉시 포맷·린트 수정한다. 실패해도 작업은 막지 않는다.
file=$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))')
root="$CLAUDE_PROJECT_DIR"
case "$file" in
  "$root"/backend/*.py)
    # 포맷만 한다. `ruff check --fix`는 여러 번에 나눠 편집하는 도중
    # "아직 안 쓰인" import를 지워버리므로 쓰지 않는다(린트는 verify.sh가 맡는다).
    (cd "$root/backend" && uv run -q ruff format "$file") >&2 || true ;;
  "$root"/frontend/*.ts|"$root"/frontend/*.tsx)
    (cd "$root/frontend" && npx prettier --write --log-level warn "$file") >&2 || true ;;
esac
exit 0
