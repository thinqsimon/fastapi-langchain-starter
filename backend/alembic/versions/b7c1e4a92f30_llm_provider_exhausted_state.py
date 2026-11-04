"""Remember which LLM provider ran out of credit, for every user (LLM-03).

Revision ID: b7c1e4a92f30
Revises: 6eb9227c02e8

칸만 추가하므로 기존 공급자는 NULL(소진 아님)로 남고, 예전 코드도 그대로 돈다.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b7c1e4a92f30"
down_revision: str | Sequence[str] | None = "6eb9227c02e8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("llm_providers", sa.Column("exhausted_at", sa.DateTime(timezone=True)))
    op.add_column("llm_providers", sa.Column("exhausted_checked_at", sa.DateTime(timezone=True)))


def downgrade() -> None:
    op.drop_column("llm_providers", "exhausted_checked_at")
    op.drop_column("llm_providers", "exhausted_at")
