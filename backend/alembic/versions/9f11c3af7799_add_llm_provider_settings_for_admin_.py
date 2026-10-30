"""Add LLM provider settings for the admin server-settings screen (ADMIN-01).

Revision ID: 9f11c3af7799
Revises: 00bdfc2e5cd9
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "9f11c3af7799"
down_revision: str | Sequence[str] | None = "00bdfc2e5cd9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "llm_provider_settings",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("model", sa.String(length=100), nullable=False),
        sa.Column("encrypted_api_key", sa.Text(), nullable=True),
        sa.Column("priority", sa.Integer(), nullable=False),
        sa.Column("enabled", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("forced", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("provider"),
    )
    op.create_index(
        "uq_llm_provider_settings_single_forced",
        "llm_provider_settings",
        ["forced"],
        unique=True,
        postgresql_where=sa.text("forced"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_llm_provider_settings_single_forced",
        table_name="llm_provider_settings",
        postgresql_where=sa.text("forced"),
    )
    op.drop_table("llm_provider_settings")
