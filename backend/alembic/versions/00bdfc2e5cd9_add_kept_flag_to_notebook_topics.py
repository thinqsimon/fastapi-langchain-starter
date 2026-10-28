"""Add kept flag and kept_at to notebook topics (NOTE-04 보관함).

Revision ID: 00bdfc2e5cd9
Revises: 4ff89a5fba71
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "00bdfc2e5cd9"
down_revision: str | Sequence[str] | None = "4ff89a5fba71"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "notebook_topics",
        sa.Column("kept", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )
    op.add_column(
        "notebook_topics", sa.Column("kept_at", sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("notebook_topics", "kept_at")
    op.drop_column("notebook_topics", "kept")
