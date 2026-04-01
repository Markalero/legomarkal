# Migración 002 — añade sold_date/sold_price, elimina condition_notes, soft-delete de condición USED
"""add sold fields, drop condition_notes, remove USED condition

Revision ID: 002
Revises: 001
Create Date: 2026-04-01
"""
from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Nuevas columnas de venta
    op.add_column("products", sa.Column("sold_date", sa.Date(), nullable=True))
    op.add_column("products", sa.Column("sold_price", sa.Numeric(10, 2), nullable=True))

    # Eliminar condition_notes (nunca se usa)
    op.drop_column("products", "condition_notes")

    # Soft-delete de productos con condición USED (eliminación de datos según spec)
    op.execute(
        "UPDATE products SET deleted_at = NOW() "
        "WHERE condition = 'USED' AND deleted_at IS NULL"
    )


def downgrade() -> None:
    op.drop_column("products", "sold_price")
    op.drop_column("products", "sold_date")
    op.add_column("products", sa.Column("condition_notes", sa.Text(), nullable=True))
    # Nota: no se revierten los soft-deletes de USED
