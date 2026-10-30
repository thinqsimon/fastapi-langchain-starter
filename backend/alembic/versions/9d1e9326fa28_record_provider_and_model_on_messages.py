"""Record which provider/model answered each assistant message (LLM-02).

Revision ID: 9d1e9326fa28
Revises: 9f11c3af7799
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "9d1e9326fa28"
down_revision: str | Sequence[str] | None = "9f11c3af7799"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("messages", sa.Column("provider", sa.String(length=32), nullable=True))
    op.add_column("messages", sa.Column("model", sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column("messages", "model")
    op.drop_column("messages", "provider")
