"""Plan-based LLM routing: provider keys / per-plan routes, users.plan, messages.plan (ADMIN-03).

Revision ID: 804e78cdbab8
Revises: 9d1e9326fa28

기존 `llm_provider_settings`(공급자당 키+모델+순서)를 둘로 나눈다.
- `llm_providers`: 공급자별 API 키
- `llm_plan_routes`: 요금제별 라우트. 기존 행은 free 요금제의 라우트로 옮긴다.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "804e78cdbab8"
down_revision: str | Sequence[str] | None = "9d1e9326fa28"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "llm_providers",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("encrypted_api_key", sa.Text(), nullable=True),
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
    op.create_table(
        "llm_plan_routes",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("plan", sa.String(length=16), nullable=False),
        sa.Column("priority", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("model", sa.String(length=100), nullable=False),
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
        sa.ForeignKeyConstraint(["provider"], ["llm_providers.provider"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_llm_plan_routes_plan_priority", "llm_plan_routes", ["plan", "priority"], unique=False
    )
    op.create_index(
        "uq_llm_plan_routes_single_forced_per_plan",
        "llm_plan_routes",
        ["plan"],
        unique=True,
        postgresql_where=sa.text("forced"),
    )

    # 기존 설정을 옮긴다: 키는 공급자 테이블로, 모델·순서·사용·강제는 free 요금제의 라우트로.
    # 키가 없고 꺼진 채로만 있던 자리표시 행은 라우트로 만들지 않는다(키 행만 만든다).
    op.execute(
        sa.text(
            """
            INSERT INTO llm_providers (provider, encrypted_api_key, created_at, updated_at)
            SELECT provider, encrypted_api_key, created_at, updated_at
            FROM llm_provider_settings
            """
        )
    )
    op.execute(
        sa.text(
            """
            INSERT INTO llm_plan_routes
                (plan, priority, provider, model, enabled, forced, created_at, updated_at)
            SELECT 'free', priority, provider, model, enabled, forced, created_at, updated_at
            FROM llm_provider_settings
            WHERE encrypted_api_key IS NOT NULL OR enabled
            """
        )
    )

    op.drop_index(
        op.f("uq_llm_provider_settings_single_forced"),
        table_name="llm_provider_settings",
        postgresql_where="forced",
    )
    op.drop_table("llm_provider_settings")
    op.add_column("messages", sa.Column("plan", sa.String(length=16), nullable=True))
    op.add_column(
        "users", sa.Column("plan", sa.String(length=16), server_default="free", nullable=False)
    )


def downgrade() -> None:
    op.drop_column("users", "plan")
    op.drop_column("messages", "plan")
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
    # 되돌릴 때는 free 요금제의 공급자별 첫 라우트만 살린다(공급자당 한 행이었으므로).
    op.execute(
        sa.text(
            """
            INSERT INTO llm_provider_settings
                (provider, model, encrypted_api_key, priority, enabled, forced)
            SELECT p.provider,
                   COALESCE(r.model, 'gpt-4o-mini'),
                   p.encrypted_api_key,
                   COALESCE(r.priority, 99),
                   COALESCE(r.enabled, false),
                   COALESCE(r.forced, false)
            FROM llm_providers p
            LEFT JOIN LATERAL (
                SELECT model, priority, enabled, forced
                FROM llm_plan_routes
                WHERE plan = 'free' AND provider = p.provider
                ORDER BY priority
                LIMIT 1
            ) r ON true
            """
        )
    )
    op.drop_index(
        "uq_llm_plan_routes_single_forced_per_plan",
        table_name="llm_plan_routes",
        postgresql_where=sa.text("forced"),
    )
    op.drop_index("ix_llm_plan_routes_plan_priority", table_name="llm_plan_routes")
    op.drop_table("llm_plan_routes")
    op.drop_table("llm_providers")
