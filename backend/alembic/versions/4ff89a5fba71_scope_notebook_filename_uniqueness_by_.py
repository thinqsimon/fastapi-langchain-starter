"""Scope notebook filename uniqueness by frontmatter project (NOTE-02).

Revision ID: 4ff89a5fba71
Revises: 37929cca196b
"""

from collections.abc import Sequence

from alembic import op

revision: str = "4ff89a5fba71"
down_revision: str | Sequence[str] | None = "37929cca196b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint(op.f("uq_notebooks_user_filename"), "notebooks", type_="unique")
    op.create_unique_constraint(
        "uq_notebooks_user_project_filename", "notebooks", ["user_id", "project", "filename"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_notebooks_user_project_filename", "notebooks", type_="unique")
    op.create_unique_constraint(
        op.f("uq_notebooks_user_filename"),
        "notebooks",
        ["user_id", "filename"],
        postgresql_nulls_not_distinct=False,
    )
