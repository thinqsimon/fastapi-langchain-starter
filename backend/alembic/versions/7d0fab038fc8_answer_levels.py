"""Answer levels: users.answer_level (1~5, NULL = not chosen) and renamed level names (CHAT-03).

Revision ID: 7d0fab038fc8
Revises: 708a27953136

users의 CHECK 제약은 autogenerate가 비교하지 않아 직접 적었다.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "7d0fab038fc8"
down_revision: str | Sequence[str] | None = "708a27953136"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "answer_level_names",
        sa.Column("level", sa.SmallInteger(), autoincrement=False, nullable=False),
        sa.Column("name", sa.String(length=20), nullable=False),
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
        sa.CheckConstraint("level BETWEEN 1 AND 5", name="ck_answer_level_names_level_range"),
        sa.PrimaryKeyConstraint("level"),
    )
    op.add_column("users", sa.Column("answer_level", sa.SmallInteger(), nullable=True))
    op.create_check_constraint(
        "ck_users_answer_level_range", "users", "answer_level BETWEEN 1 AND 5"
    )


def downgrade() -> None:
    op.drop_constraint("ck_users_answer_level_range", "users", type_="check")
    op.drop_column("users", "answer_level")
    op.drop_table("answer_level_names")
