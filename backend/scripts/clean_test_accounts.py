"""테스트·수동 확인용 계정을 DB에서 지운다.

규칙: 테스트 계정은 반드시 `@example.com` 도메인을 쓴다(docs/conventions.md).
example.com은 RFC 2606 예약 도메인이라 실제 사용자가 가질 수 없으므로 삭제 기준으로 안전하다.
users를 참조하는 모든 테이블이 ON DELETE CASCADE라 users 행만 지우면 관련 데이터도 함께 정리된다.

사용 (backend/ 기준, 보통은 scripts/clean-test-accounts.sh 또는 make clean-test-accounts로 호출):
    uv run python scripts/clean_test_accounts.py            # 대상만 보여준다(dry-run)
    uv run python scripts/clean_test_accounts.py --delete   # 로컬 DB에서 삭제
    uv run python scripts/clean_test_accounts.py --delete --remote   # 원격 DB도 허용

대상 DB는 설정의 DATABASE_URL이다(환경 변수가 .env보다 우선).
원격 DB는 `--remote`를 명시하지 않으면 종료 코드 2로 거부한다(운영 데이터 보호).
"""

from __future__ import annotations

import argparse
import sys
from urllib.parse import urlsplit

from sqlalchemy import create_engine, text

TEST_EMAIL_DOMAIN = "example.com"
EXIT_REMOTE_REFUSED = 2
LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", "db"}  # db = docker compose 서비스 이름


def is_local_database(url: str) -> bool:
    host = urlsplit(url.replace("+psycopg", "")).hostname
    return host in LOCAL_HOSTS


def redacted(url: str) -> str:
    """비밀번호를 빼고 host/db만 보여준다."""
    return url.split("@")[-1]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    parser.add_argument("--delete", action="store_true", help="실제로 삭제한다(없으면 dry-run)")
    parser.add_argument("--remote", action="store_true", help="원격 DB에서도 실행을 허용한다")
    parser.add_argument("--database-url", default=None, help="기본값은 설정의 DATABASE_URL")
    args = parser.parse_args(argv)

    if args.database_url:
        url = args.database_url
    else:
        from app.core.config import settings

        url = settings.DATABASE_URL

    print(f"대상 DB: {redacted(url)}")
    if not is_local_database(url) and not args.remote:
        print("✗ 원격 DB입니다. 정말 지우려면 --remote 를 함께 주세요.", file=sys.stderr)
        return EXIT_REMOTE_REFUSED

    pattern = f"%@{TEST_EMAIL_DOMAIN}"
    engine = create_engine(url)
    with engine.begin() as conn:
        rows = conn.execute(
            text("SELECT email, created_at FROM users WHERE email ILIKE :p ORDER BY created_at"),
            {"p": pattern},
        ).all()
        if not rows:
            print(f"✓ @{TEST_EMAIL_DOMAIN} 계정이 없습니다.")
            return 0

        for email, created_at in rows:
            print(f"  - {email}  ({created_at:%Y-%m-%d %H:%M})")

        if not args.delete:
            print(f"총 {len(rows)}개. 삭제하려면 --delete 를 주세요(dry-run).")
            return 0

        deleted = conn.execute(
            text("DELETE FROM users WHERE email ILIKE :p"), {"p": pattern}
        ).rowcount
    print(f"✓ {deleted}개 계정과 연관 데이터(CASCADE)를 삭제했습니다.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
