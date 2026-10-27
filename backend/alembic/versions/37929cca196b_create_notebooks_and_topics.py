"""Create notebooks and notebook_topics for the study notebook (NOTE-01).

Revision ID: 37929cca196b
Revises: e317b6a91d42
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "37929cca196b"
down_revision: str | Sequence[str] | None = "e317b6a91d42"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "notebooks",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("filename", sa.String(length=200), nullable=True),
        sa.Column("project", sa.String(length=100), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
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
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "filename", name="uq_notebooks_user_filename"),
    )
    op.create_index(op.f("ix_notebooks_user_id"), "notebooks", ["user_id"], unique=False)
    op.create_table(
        "notebook_topics",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("notebook_id", sa.Uuid(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("kind", sa.String(length=30), nullable=True),
        sa.Column("tags", sa.Text(), server_default="", nullable=False),
        sa.Column("difficulty", sa.Integer(), nullable=True),
        sa.Column("content", sa.Text(), server_default="", nullable=False),
        sa.Column("completed", sa.Boolean(), server_default=sa.text("false"), nullable=False),
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
        sa.ForeignKeyConstraint(["notebook_id"], ["notebooks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_notebook_topics_notebook_id"), "notebook_topics", ["notebook_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_notebook_topics_notebook_id"), table_name="notebook_topics")
    op.drop_table("notebook_topics")
    op.drop_index(op.f("ix_notebooks_user_id"), table_name="notebooks")
    op.drop_table("notebooks")
