"""Rename market price range columns to explicit *_new names

Revision ID: 007_price_new_cols
Revises: 006_market_price_used_ranges
Create Date: 2026-04-01
"""

from alembic import op


revision = "007_price_new_cols"
down_revision = "006_market_price_used_ranges"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("market_prices", "min_price", new_column_name="min_price_new")
    op.alter_column("market_prices", "max_price", new_column_name="max_price_new")


def downgrade() -> None:
    op.alter_column("market_prices", "min_price_new", new_column_name="min_price")
    op.alter_column("market_prices", "max_price_new", new_column_name="max_price")
