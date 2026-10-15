#!/usr/bin/env bash
# PreToolUse(Read|Edit|Write): .env 등 비밀 파일 접근을 차단한다 (.env.example은 허용).
file=$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))')
name=$(basename "$file")
if [[ "$name" == .env* && "$name" != ".env.example" ]]; then
  echo "비밀 파일($name)은 에이전트가 읽거나 수정하지 않습니다. 설정 키는 .env.example에 추가하세요." >&2
  exit 2
fi
exit 0
