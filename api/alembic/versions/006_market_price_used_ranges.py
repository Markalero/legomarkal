"""Add min/max range fields for used market prices

Revision ID: 006_market_price_used_ranges
Revises: 005_products_availability
Create Date: 2026-04-01
"""

from alembic import op
import sqlalchemy as sa


revision = "006_market_price_used_ranges"
down_revision = "005_products_availability"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("market_prices", sa.Column("min_price_used", sa.Numeric(10, 2), nullable=True))
    op.add_column("market_prices", sa.Column("max_price_used", sa.Numeric(10, 2), nullable=True))

    # Backfill inicial: si no hay histórico separado para usados, reutiliza el rango existente (new).
    op.execute(
        """
        UPDATE market_prices
        SET min_price_used = min_price,
            max_price_used = max_price
        WHERE min_price_used IS NULL
           OR max_price_used IS NULL
        """
    )


def downgrade() -> None:
    op.drop_column("market_prices", "max_price_used")
    op.drop_column("market_prices", "min_price_used")
