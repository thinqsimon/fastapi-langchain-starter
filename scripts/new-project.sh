#!/usr/bin/env bash
# 스타터킷을 새 서비스로 초기화한다.
#
#   ./scripts/new-project.sh "내 서비스" my-service
#
# 하는 일: 이름 치환, 샘플앱(배움일기 코치) 제거 여부 선택, .env 생성, git 이력 초기화 안내.
# 되돌릴 수 없는 변경이므로 실행 전 확인을 받는다.
set -euo pipefail
cd "$(dirname "$0")/.."

DISPLAY_NAME="${1:-}"
SLUG="${2:-}"

if [ -z "$DISPLAY_NAME" ] || [ -z "$SLUG" ]; then
  echo "사용법: $0 \"<서비스 이름>\" <slug>"
  echo "  예시: $0 \"사내 지식 봇\" knowledge-bot"
  echo ""
  echo "  <서비스 이름>  화면과 API 문서에 보이는 이름"
  echo "  <slug>        소문자·하이픈. 배포 서비스명 등에 쓰입니다"
  exit 1
fi

if ! printf '%s' "$SLUG" | grep -Eq '^[a-z][a-z0-9-]{1,38}[a-z0-9]$'; then
  echo "✗ slug는 소문자로 시작하고 소문자·숫자·하이픈만 쓸 수 있습니다: $SLUG"
  exit 1
fi

echo "다음과 같이 초기화합니다."
echo "  서비스 이름 : $DISPLAY_NAME"
echo "  slug       : $SLUG"
echo ""
read -r -p "샘플앱(배움일기 코치)을 제거할까요? [y/N] " REMOVE_SAMPLE
read -r -p "계속할까요? 되돌릴 수 없습니다. [y/N] " CONFIRM
[ "$CONFIRM" = "y" ] || [ "$CONFIRM" = "Y" ] || { echo "취소했습니다."; exit 0; }

echo "→ 이름 치환"
# .env는 비밀값이 있으므로 건드리지 않는다.
FILES=$(git ls-files '*.md' '*.ts' '*.tsx' '*.py' '*.yml' '*.yaml' '*.json' '.env.example' 2>/dev/null || true)
for f in $FILES; do
  [ -f "$f" ] || continue
  perl -pi -e "s/AX Chat Starter/\Q$DISPLAY_NAME\E/g" "$f"
  perl -pi -e "s/ax-chat-starter/$SLUG/g" "$f"
done

echo "→ .env 준비"
[ -f .env ] || cp .env.example .env

if [ "$REMOVE_SAMPLE" = "y" ] || [ "$REMOVE_SAMPLE" = "Y" ]; then
  echo "→ 샘플앱 제거"
  rm -rf backend/src/app/domain/diary \
         backend/tests/api/test_diary.py \
         frontend/app/\(main\)/diary \
         frontend/components/diary \
         frontend/store/diary.ts \
         frontend/api/diary.ts \
         frontend/e2e/diary.spec.ts \
         samples/diary-coach \
         backend/src/app/llm/prompts/diary_coach.py \
         backend/src/app/llm/chains/diary.py
  echo ""
  echo "⚠ 샘플앱을 지웠으니 아래를 직접 정리하세요(참조가 남아 있습니다)."
  echo "   backend/src/app/api.py        diary_router 등록 줄"
  echo "   backend/src/app/models.py     DiaryEntry import"
  echo "   backend/pyproject.toml        import-linter containers의 app.domain.diary"
  echo "   frontend/api/index.ts         diaryApi 내보내기"
  echo "   frontend/components/app-header.tsx  일기 링크"
  echo "   backend/alembic/versions/     diary_entries 마이그레이션(새로 시작한다면 전체 삭제 후 재생성)"
fi

cat <<NEXT

✓ 초기화 완료

다음 순서로 진행하세요.
  1. docs/ 안의 설계 문서를 새 서비스 내용으로 교체
  2. backend/src/app/llm/prompts/ 에 서비스에 맞는 프롬프트 작성
  3. ./scripts/verify.sh 로 확인
  4. git 이력을 새로 시작하려면: rm -rf .git && git init

NEXT
