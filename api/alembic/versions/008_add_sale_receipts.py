"""Add sale_receipts JSONB column to products

Revision ID: 008_add_sale_receipts
Revises: 007_price_new_cols
Create Date: 2026-04-12
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB


revision = "008_add_sale_receipts"
down_revision = "007_price_new_cols"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "products",
        sa.Column(
            "sale_receipts",
            JSONB,
            nullable=True,
            server_default="[]",
        ),
    )


def downgrade() -> None:
    op.drop_column("products", "sale_receipts")
