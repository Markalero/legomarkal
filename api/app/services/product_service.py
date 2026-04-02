# Lógica de negocio para productos y categorías — desacoplada de los routers
import asyncio
from datetime import datetime, timezone
import math
import re
from typing import Optional
from uuid import UUID

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.product import Product
from app.models.price import MarketPrice
from app.schemas.product import ProductCreate, ProductListOut, ProductOut, ProductQuickCreate, ProductUpdate


class ProductService:
    """Gestiona operaciones CRUD y consultas de inventario sobre la tabla products."""

    SET_NUMBER_QUERY_REGEX = re.compile(r"^(\d{3,8})(?:-\d+)?$")

    @classmethod
    def _normalize_set_for_query(cls, set_number: str) -> str:
        """Convierte 7965-1 o 7965 a 7965 para consultar en BrickLink."""
        raw = (set_number or "").strip()
        match = cls.SET_NUMBER_QUERY_REGEX.fullmatch(raw)
        if match:
            return match.group(1)
        return raw

    def list_products(
        self,
        db: Session,
        page: int = 1,
        size: int = 50,
        theme: Optional[str] = None,
        condition: Optional[str] = None,
        availability: Optional[str] = None,
        search: Optional[str] = None,
    ) -> ProductListOut:
        query = db.query(Product).filter(Product.deleted_at.is_(None))

        if theme:
            query = query.filter(Product.theme.ilike(f"%{theme}%"))
        if condition:
            query = query.filter(Product.condition == condition)
        if availability is not None:
            query = query.filter(Product.availability == availability)
        if search:
            query = query.filter(
                or_(
                    Product.name.ilike(f"%{search}%"),
                    Product.set_number.ilike(f"%{search}%"),
                )
            )

        total = query.count()
        items = query.order_by(Product.created_at.desc()).offset((page - 1) * size).limit(size).all()

        # Enriquecer con el último snapshot de precio para consumo del frontend.
        for p in items:
            condition_price_filter = (
                MarketPrice.price_new.isnot(None)
                if p.condition == "SEALED"
                else MarketPrice.price_used.isnot(None)
            )
            latest = (
                db.query(MarketPrice)
                .join(Product, MarketPrice.product_id == Product.id)
                .filter(
                    Product.set_number == p.set_number,
                    Product.deleted_at.is_(None),
                    MarketPrice.source == "bricklink",
                    condition_price_filter,
                )
                .order_by(MarketPrice.fetched_at.desc())
                .first()
            )
            setattr(p, "latest_market_price", latest)

        return ProductListOut(
            items=[ProductOut.model_validate(p) for p in items],
            total=total,
            page=page,
            size=size,
            pages=math.ceil(total / size) if total else 1,
        )

    def get_product(self, db: Session, product_id: UUID) -> Optional[Product]:
        product = db.query(Product).filter(Product.id == product_id, Product.deleted_at.is_(None)).first()
        if not product:
            return None

        condition_price_filter = (
            MarketPrice.price_new.isnot(None)
            if product.condition == "SEALED"
            else MarketPrice.price_used.isnot(None)
        )

        latest = (
            db.query(MarketPrice)
            .join(Product, MarketPrice.product_id == Product.id)
            .filter(
                Product.set_number == product.set_number,
                Product.deleted_at.is_(None),
                MarketPrice.source == "bricklink",
                condition_price_filter,
            )
            .order_by(MarketPrice.fetched_at.desc())
            .first()
        )
        setattr(product, "latest_market_price", latest)
        return product

    def create_product(self, db: Session, data: ProductCreate) -> Product:
        product = Product(**data.model_dump())
        db.add(product)
        db.commit()
        db.refresh(product)

        self.enrich_market_history_if_possible(db, product)
        return product

    def create_product_from_set(self, db: Session, data: ProductQuickCreate) -> Product:
        """Crea un producto con datos mínimos usando metadatos de BrickLink."""
        from app.scraper.bricklink_scraper import BrickLinkScraper
        from app.services.price_service import price_service

        input_set = data.set_number.strip()
        query_set = self._normalize_set_for_query(input_set)

        async def _fetch_all(set_number: str):
            scraper = BrickLinkScraper()
            try:
                metadata_value = await scraper.fetch_set_metadata(set_number)
                live_price_value = await scraper.fetch_with_retry(set_number)
                return metadata_value, live_price_value
            finally:
                await scraper.close()

        metadata, live_price = asyncio.run(_fetch_all(query_set))

        if not metadata or not metadata.get("name"):
            raise ValueError(
                f"No se pudo validar el set LEGO '{input_set}'. Comprueba el código e inténtalo de nuevo."
            )

        if not live_price or (live_price.price_new is None and live_price.price_used is None):
            raise ValueError(
                f"No hay datos de mercado disponibles para el set '{input_set}'."
            )

        images = [metadata["image_url"]] if metadata.get("image_url") else []
        product = Product(
            set_number=input_set,
            name=metadata.get("name"),
            theme=metadata.get("theme"),
            year_released=metadata.get("year_released"),
            condition=data.condition,
            purchase_price=data.purchase_price,
            purchase_date=data.purchase_date,
            purchase_source=data.purchase_source,
            quantity=data.quantity,
            notes=data.notes,
            images=images,
            availability="available",
        )
        db.add(product)
        db.commit()
        db.refresh(product)

        if live_price:
            self._save_price_history_snapshots(db, product.id, live_price)

        return product

    def _save_price_history_snapshots(self, db: Session, product_id: UUID, live_price) -> None:
        """Guarda snapshot actual y, si existe, histórico mensual real."""
        from app.services.price_service import price_service

        payload = {
            "price_new": live_price.price_new,
            "price_used": live_price.price_used,
            "min_price_new": live_price.min_price_new,
            "max_price_new": live_price.max_price_new,
            "min_price_used": live_price.min_price_used,
            "max_price_used": live_price.max_price_used,
            "currency": live_price.currency,
            "fetched_at": datetime.now(timezone.utc),
        }

        if getattr(live_price, "monthly_history", None):
            price_service.save_monthly_history_points(
                db,
                product_id=product_id,
                source="bricklink",
                points=live_price.monthly_history,
            )

        price_service.save_price(db, product_id, "bricklink", payload)

    def enrich_market_history_if_possible(self, db: Session, product: Product) -> None:
        """Intenta rellenar metadatos e histórico de precios al crear/importar."""
        if not product.set_number:
            return

        from app.scraper.bricklink_scraper import BrickLinkScraper

        query_set = self._normalize_set_for_query(product.set_number)

        async def _fetch_data(set_number: str):
            scraper = BrickLinkScraper()
            try:
                metadata_value = await scraper.fetch_set_metadata(set_number)
                live_price_value = await scraper.fetch_with_retry(set_number)
                return metadata_value, live_price_value
            finally:
                await scraper.close()

        try:
            metadata, live_price = asyncio.run(_fetch_data(query_set))
        except Exception:
            return

        changed = False
        if metadata:
            if not product.theme and metadata.get("theme"):
                product.theme = metadata.get("theme")
                changed = True

            if not product.year_released and metadata.get("year_released"):
                product.year_released = metadata.get("year_released")
                changed = True

            if not (product.images or []) and metadata.get("image_url"):
                product.images = [metadata.get("image_url")]
                changed = True

            current_name = (product.name or "").strip()
            if metadata.get("name") and (
                not current_name
                or re.match(r"(?i)^test\b", current_name)
                or re.match(r"(?i)^lego\s*\d{3,8}(?:-\d+)?$", current_name)
            ):
                product.name = metadata.get("name")
                changed = True

        if changed:
            db.commit()
            db.refresh(product)

        if live_price and (live_price.price_new is not None or live_price.price_used is not None):
            self._save_price_history_snapshots(db, product.id, live_price)

    def update_product(self, db: Session, product_id: UUID, data: ProductUpdate) -> Optional[Product]:
        product = self.get_product(db, product_id)
        if not product:
            return None
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(product, field, value)
        db.commit()
        db.refresh(product)
        return product

    def soft_delete(self, db: Session, product_id: UUID) -> bool:
        product = self.get_product(db, product_id)
        if not product:
            return False
        from datetime import datetime, timezone
        product.deleted_at = datetime.now(timezone.utc)
        db.commit()
        return True


product_service = ProductService()
