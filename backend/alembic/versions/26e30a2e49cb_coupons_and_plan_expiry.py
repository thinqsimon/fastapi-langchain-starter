"""Coupons for paid plans and users.plan_expires_at (COUPON-01).

Revision ID: 26e30a2e49cb
Revises: 804e78cdbab8
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "26e30a2e49cb"
down_revision: str | Sequence[str] | None = "804e78cdbab8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "coupons",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("code", sa.String(length=16), nullable=False),
        sa.Column("plan", sa.String(length=16), nullable=False),
        sa.Column("duration", sa.String(length=8), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("memo", sa.String(length=200), nullable=True),
        sa.Column("batch_id", sa.Uuid(), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("redeemed_by", sa.Uuid(), nullable=True),
        sa.Column("redeemed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("plan_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["redeemed_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_coupons_batch_id"), "coupons", ["batch_id"], unique=False)
    op.create_index(op.f("ix_coupons_code"), "coupons", ["code"], unique=True)
    op.create_index(op.f("ix_coupons_redeemed_by"), "coupons", ["redeemed_by"], unique=False)
    op.add_column("users", sa.Column("plan_expires_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "plan_expires_at")
    op.drop_index(op.f("ix_coupons_redeemed_by"), table_name="coupons")
    op.drop_index(op.f("ix_coupons_code"), table_name="coupons")
    op.drop_index(op.f("ix_coupons_batch_id"), table_name="coupons")
    op.drop_table("coupons")
