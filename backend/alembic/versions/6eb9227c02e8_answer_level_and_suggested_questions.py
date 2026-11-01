"""Per-answer level and suggested questions, and the suggest-questions preference (CHAT-04).

Revision ID: 6eb9227c02e8
Revises: 7d0fab038fc8

messages의 CHECK 제약은 autogenerate가 비교하지 않아 직접 적었다.
추가만 하므로 기존 메시지는 answer_level·suggested_questions가 NULL로 남는다(예전 답변).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "6eb9227c02e8"
down_revision: str | Sequence[str] | None = "7d0fab038fc8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "answer_preferences",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "suggest_questions", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
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
        sa.PrimaryKeyConstraint("user_id"),
    )
    op.add_column("messages", sa.Column("answer_level", sa.SmallInteger(), nullable=True))
    op.add_column("messages", sa.Column("suggested_questions", sa.JSON(), nullable=True))
    op.create_check_constraint(
        "ck_messages_answer_level_range", "messages", "answer_level BETWEEN 1 AND 5"
    )


def downgrade() -> None:
    op.drop_constraint("ck_messages_answer_level_range", "messages", type_="check")
    op.drop_column("messages", "suggested_questions")
    op.drop_column("messages", "answer_level")
    op.drop_table("answer_preferences")
