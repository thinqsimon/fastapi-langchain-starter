"""Seed default per-plan LLM routes (model ladder) for plans that have none (ADMIN-04).

Revision ID: 708a27953136
Revises: 26e30a2e49cb

Free는 가장 싼 모델, Pro·Max는 공급자마다 한 단계씩 비싼 모델.
값은 app/domain/admin/defaults.py에서 복사해 둔다(앱 코드가 바뀌어도 그때의 값으로 돌아야 한다).
이미 라우트가 있는 요금제(운영의 free 등)는 건드리지 않는다.
키가 없는 공급자의 라우트는 쓰이지 않는다.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "708a27953136"
down_revision: str | Sequence[str] | None = "26e30a2e49cb"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

DEFAULT_ROUTES: dict[str, list[tuple[str, str]]] = {
    "free": [
        ("google_genai", "gemini-2.5-flash"),
        ("openai", "gpt-4o-mini"),
        ("anthropic", "claude-haiku-5-5"),
    ],
    "pro": [
        ("google_genai", "gemini-2.5-pro"),
        ("openai", "gpt-4.1-mini"),
        ("anthropic", "claude-sonnet-5-5"),
    ],
    "max": [
        ("openai", "gpt-4.1"),
        ("google_genai", "gemini-2.5-pro"),
        ("anthropic", "claude-opus-5-5"),
    ],
}


def upgrade() -> None:
    conn = op.get_bind()
    # 공급자 행이 없으면(새 설치) 키 없이 만들어 둔다. 라우트가 FK로 참조한다.
    for provider in ("openai", "anthropic", "google_genai"):
        conn.execute(
            sa.text(
                "INSERT INTO llm_providers (provider) SELECT CAST(:p AS VARCHAR) "
                "WHERE NOT EXISTS (SELECT 1 FROM llm_providers WHERE provider = :p)"
            ),
            {"p": provider},
        )
    for plan, routes in DEFAULT_ROUTES.items():
        existing = conn.execute(
            sa.text("SELECT count(*) FROM llm_plan_routes WHERE plan = :plan"), {"plan": plan}
        ).scalar_one()
        if existing:
            continue
        for priority, (provider, model) in enumerate(routes, start=1):
            conn.execute(
                sa.text(
                    "INSERT INTO llm_plan_routes (plan, priority, provider, model) "
                    "VALUES (:plan, :priority, :provider, :model)"
                ),
                {"plan": plan, "priority": priority, "provider": provider, "model": model},
            )


def downgrade() -> None:
    # 데이터만 넣는 마이그레이션이라 되돌리지 않는다(관리자가 바꾼 값과 구분할 수 없다).
    pass
