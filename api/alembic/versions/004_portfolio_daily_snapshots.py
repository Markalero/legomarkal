"""Create portfolio daily snapshots table

Revision ID: 004
Revises: 003
Create Date: 2026-04-01
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "portfolio_daily_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("invested_value", sa.Numeric(12, 2), nullable=False),
        sa.Column("market_value", sa.Numeric(12, 2), nullable=False),
        sa.Column("profit_value", sa.Numeric(12, 2), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.TIMESTAMP(), server_default=sa.text("now()")),
        sa.UniqueConstraint("date", name="uq_portfolio_daily_snapshots_date"),
    )


def downgrade() -> None:
    op.drop_table("portfolio_daily_snapshots")
