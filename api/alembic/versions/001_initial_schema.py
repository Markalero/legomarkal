"""Initial schema — 4 tablas V1: categories, products, market_prices, price_alerts

Revision ID: 001
Revises:
Create Date: 2026-03-31
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── categories ────────────────────────────────────────────────────────────
    op.create_table(
        "categories",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("description", sa.Text),
        sa.Column("created_at", sa.TIMESTAMP, server_default=sa.text("now()")),
    )

    # Seed inicial de categorías
    op.execute("""
        INSERT INTO categories (name) VALUES
            ('Set sellado'),
            ('Set abierto'),
            ('Minifigura'),
            ('Pieza suelta'),
            ('Lote')
    """)

    # ── products ──────────────────────────────────────────────────────────────
    op.create_table(
        "products",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("categories.id"), nullable=True),
        sa.Column("set_number", sa.String(20)),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("theme", sa.String(100)),
        sa.Column("year_released", sa.Integer),
        sa.Column("condition", sa.String(20),
                  sa.CheckConstraint("condition IN ('SEALED','OPEN_COMPLETE','OPEN_INCOMPLETE','USED')")),
        sa.Column("condition_notes", sa.Text),
        sa.Column("purchase_price", sa.Numeric(10, 2)),
        sa.Column("purchase_date", sa.Date),
        sa.Column("purchase_source", sa.String(255)),
        sa.Column("storage_location", sa.String(100)),
        sa.Column("quantity", sa.Integer, server_default="1"),
        sa.Column("images", postgresql.JSONB, server_default=sa.text("'[]'")),
        sa.Column("notes", sa.Text),
        sa.Column("is_listed", sa.Boolean, server_default="false"),
        sa.Column("deleted_at", sa.TIMESTAMP, nullable=True),
        sa.Column("created_at", sa.TIMESTAMP, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.TIMESTAMP, server_default=sa.text("now()")),
    )

    # ── market_prices ─────────────────────────────────────────────────────────
    op.create_table(
        "market_prices",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("source", sa.String(50), nullable=False,
                  *[sa.CheckConstraint("source IN ('bricklink','brickeconomy','ebay')")]),
        sa.Column("price_new", sa.Numeric(10, 2)),
        sa.Column("price_used", sa.Numeric(10, 2)),
        sa.Column("min_price", sa.Numeric(10, 2)),
        sa.Column("max_price", sa.Numeric(10, 2)),
        sa.Column("currency", sa.String(3), server_default="'EUR'"),
        sa.Column("fetched_at", sa.TIMESTAMP, server_default=sa.text("now()")),
    )

    # ── price_alerts ──────────────────────────────────────────────────────────
    op.create_table(
        "price_alerts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("alert_type", sa.String(20), nullable=False,
                  *[sa.CheckConstraint("alert_type IN ('PRICE_ABOVE','PRICE_BELOW','PRICE_CHANGE_PCT')")]),
        sa.Column("threshold_value", sa.Numeric(10, 2), nullable=False),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("last_triggered", sa.TIMESTAMP, nullable=True),
        sa.Column("created_at", sa.TIMESTAMP, server_default=sa.text("now()")),
    )

    # Índices para consultas frecuentes
    op.create_index("ix_products_set_number", "products", ["set_number"])
    op.create_index("ix_products_deleted_at", "products", ["deleted_at"])
    op.create_index("ix_market_prices_product_id", "market_prices", ["product_id"])
    op.create_index("ix_market_prices_fetched_at", "market_prices", ["fetched_at"])


def downgrade() -> None:
    op.drop_table("price_alerts")
    op.drop_table("market_prices")
    op.drop_table("products")
    op.drop_table("categories")
