#!/usr/bin/env bash
# 서비스 이름·프로필을 설정한다. 샘플 코드·DB 이력·Git 이력은 삭제하지 않는다.
set -euo pipefail
cd "$(dirname "$0")/.."

DISPLAY_NAME="${1:-}"
SLUG="${2:-}"
if [ -z "$DISPLAY_NAME" ] || [ -z "$SLUG" ]; then
  echo "사용법: $0 \"<서비스 이름>\" <slug>"
  exit 1
fi
if ! printf '%s' "$SLUG" | grep -Eq '^[a-z][a-z0-9-]{1,38}[a-z0-9]$'; then
  echo "✗ slug는 소문자로 시작하는 3~40자의 소문자·숫자·하이픈이어야 합니다."
  exit 1
fi

read -r -p "일기 기능을 끄고 공통 스타터킷으로 시작할까요? [y/N] " STARTER
PROFILE=diary-coach
if [ "$STARTER" = "y" ] || [ "$STARTER" = "Y" ]; then PROFILE=starter; fi
echo "서비스 이름: $DISPLAY_NAME / slug: $SLUG / 프로필: $PROFILE"
read -r -p "설정 예시와 Render 템플릿을 갱신할까요? [y/N] " CONFIRM
[ "$CONFIRM" = "y" ] || [ "$CONFIRM" = "Y" ] || { echo "취소했습니다."; exit 0; }

node scripts/configure-project.mjs "$DISPLAY_NAME" "$SLUG" "$PROFILE"
if [ -f .env ]; then
  echo "기존 .env는 유지했습니다. APP_PROFILE=$PROFILE 및 APP_NAME을 직접 맞춰 주세요."
else
  cp .env.example .env
fi

cat <<NEXT

✓ 초기화 완료 (샘플 코드와 기존 DB·Git 이력 보존)
  백엔드: node scripts/dev.mjs $PROFILE backend
  프론트: node scripts/dev.mjs $PROFILE frontend

프론트엔드 이름은 실행 환경 또는 frontend/.env.local의 NEXT_PUBLIC_APP_NAME으로 설정하세요.
다음으로 docs/guides/application-profiles.md를 참고하고 ./scripts/verify.sh로 확인하세요.
NEXT
