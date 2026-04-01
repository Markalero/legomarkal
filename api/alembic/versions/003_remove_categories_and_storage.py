"""Remove categories domain and storage location from products

Revision ID: 003
Revises: 002
Create Date: 2026-03-31
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop FK products.category_id -> categories.id if it exists.
    op.execute(
        """
        DO $$
        DECLARE
            fk_name text;
        BEGIN
            SELECT con.conname INTO fk_name
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            WHERE rel.relname = 'products'
              AND con.contype = 'f'
              AND pg_get_constraintdef(con.oid) LIKE 'FOREIGN KEY (category_id)%';

            IF fk_name IS NOT NULL THEN
                EXECUTE format('ALTER TABLE products DROP CONSTRAINT %I', fk_name);
            END IF;
        END $$;
        """
    )

    op.drop_column("products", "category_id")
    op.drop_column("products", "storage_location")
    op.drop_table("categories")


def downgrade() -> None:
    op.create_table(
        "categories",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("description", sa.Text),
        sa.Column("created_at", sa.TIMESTAMP, server_default=sa.text("now()")),
    )

    op.add_column("products", sa.Column("storage_location", sa.String(100), nullable=True))
    op.add_column("products", sa.Column("category_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "products_category_id_fkey",
        "products",
        "categories",
        ["category_id"],
        ["id"],
    )
