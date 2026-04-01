"""Replace is_listed with availability on products

Revision ID: 005_products_availability
Revises: 004
Create Date: 2026-04-01
"""

from alembic import op
import sqlalchemy as sa


revision = "005_products_availability"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "products",
        sa.Column("availability", sa.String(length=20), nullable=False, server_default="available"),
    )
    op.create_check_constraint(
        "ck_products_availability",
        "products",
        "availability IN ('available','sold')",
    )

    # Migración segura: cualquier registro previo pasa a disponible.
    op.execute("UPDATE products SET availability = 'available' WHERE availability IS NULL")

    op.drop_column("products", "is_listed")


def downgrade() -> None:
    op.add_column(
        "products",
        sa.Column("is_listed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )

    # Downgrade conservador: sold -> false; available -> true.
    op.execute(
        """
        UPDATE products
        SET is_listed = CASE
            WHEN availability = 'sold' THEN false
            ELSE true
        END
        """
    )

    op.drop_constraint("ck_products_availability", "products", type_="check")
    op.drop_column("products", "availability")
