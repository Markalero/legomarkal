# Lógica de negocio para precios de mercado y alertas
from collections import defaultdict
import calendar
from datetime import date, datetime, timedelta, timezone
import logging
from decimal import Decimal
from typing import List, Optional
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import Date as SADate, cast, func
from sqlalchemy.orm import Session

from app.models.price import MarketPrice, PortfolioDailySnapshot, PriceAlert
from app.models.product import Product
from app.schemas.price import (
    DashboardSummary,
    PriceAlertCreate,
    PriceDetailTrendPoint,
    PriceInsightProduct,
    RealProfitSummary,
    TopMarginProduct,
)

logger = logging.getLogger(__name__)


class PriceService:
    """Consultas y escritura de snapshots de precios de mercado."""

    SPAIN_TZ = ZoneInfo("Europe/Madrid")

    def _now_spain(self) -> datetime:
        """Fecha/hora actual en zona horaria de España peninsular."""
        return datetime.now(self.SPAIN_TZ)

    def _get_set_number_for_product(self, db: Session, product_id: UUID) -> Optional[str]:
        product = (
            db.query(Product)
            .filter(Product.id == product_id, Product.deleted_at.is_(None))
            .first()
        )
        if not product:
            return None
        return (product.set_number or "").strip() or None

    def _get_related_product_ids_by_set(self, db: Session, set_number: Optional[str]) -> list[UUID]:
        if not set_number:
            return []
        rows = (
            db.query(Product.id)
            .filter(Product.set_number == set_number, Product.deleted_at.is_(None))
            .all()
        )
        return [row.id for row in rows]

    def _resolve_storage_product_id(self, db: Session, product_id: UUID) -> UUID:
        """Elige un product_id canónico por set_number para persistir una sola serie."""
        set_number = self._get_set_number_for_product(db, product_id)
        if not set_number:
            return product_id

        canonical = (
            db.query(Product)
            .filter(Product.set_number == set_number, Product.deleted_at.is_(None))
            .order_by(Product.created_at.asc())
            .first()
        )
        return canonical.id if canonical else product_id

    def _interpolate_month_price(
        self,
        min_value: Optional[Decimal],
        current_value: Optional[Decimal],
        max_value: Optional[Decimal],
        progress: Decimal,
    ) -> Optional[Decimal]:
        """Genera un valor mensual aproximado entre el rango conocido y el valor actual."""
        if current_value is None:
            return None

        current = Decimal(str(current_value))
        min_price = Decimal(str(min_value)) if min_value is not None else current
        max_price = Decimal(str(max_value)) if max_value is not None else current

        if max_price < min_price:
            min_price, max_price = max_price, min_price

        if min_price == max_price:
            # Si el rango viene plano, añadimos una pendiente suave para evitar series totalmente planas.
            span = current * Decimal("0.06")
            start = (current - span).quantize(Decimal("0.01"))
            end = (current + span).quantize(Decimal("0.01"))
            value = start + (end - start) * progress
            return value.quantize(Decimal("0.01"))

        # Si el valor actual cae en un extremo del rango, usamos el otro extremo como origen.
        if current == min_price and max_price > min_price:
            start, end = max_price, current
        elif current == max_price and min_price < max_price:
            start, end = min_price, current
        else:
            start, end = min_price, current

        value = start + (end - start) * progress
        return value.quantize(Decimal("0.01"))

    def get_price_history(self, db: Session, product_id: UUID) -> List[MarketPrice]:
        set_number = self._get_set_number_for_product(db, product_id)
        related_ids = self._get_related_product_ids_by_set(db, set_number)
        if not related_ids:
            related_ids = [product_id]

        rows = (
            db.query(MarketPrice)
            .filter(MarketPrice.product_id.in_(related_ids))
            .order_by(MarketPrice.fetched_at.desc())
            .all()
        )

        # Para API de historial devolvemos una fila por fecha (la más reciente de ese día).
        by_day: dict[date, MarketPrice] = {}
        for row in rows:
            day = row.fetched_at.date()
            by_day.setdefault(day, row)
            if len(by_day) >= 100:
                break
        return list(by_day.values())

    def select_price_by_condition(
        self,
        condition: Optional[str],
        price_new: Optional[Decimal],
        price_used: Optional[Decimal],
    ) -> Optional[Decimal]:
        """Selecciona el precio de mercado real según condición del producto."""
        if condition == "SEALED":
            return price_new
        if condition in ("OPEN_COMPLETE", "OPEN_INCOMPLETE"):
            return price_used
        return price_used

    def get_product_history_trend(
        self,
        db: Session,
        product_id: UUID,
        months: int = 6,
    ) -> tuple[Optional[str], list[dict]]:
        """Devuelve series new/used agregadas por día para los últimos N meses."""
        product = db.query(Product).filter(Product.id == product_id, Product.deleted_at.is_(None)).first()
        if not product:
            return None, []

        related_ids = self._get_related_product_ids_by_set(db, product.set_number)
        if not related_ids:
            related_ids = [product_id]

        since = datetime.now(timezone.utc) - timedelta(days=max(1, months) * 31)
        rows = (
            db.query(MarketPrice)
            .filter(
                MarketPrice.product_id.in_(related_ids),
                MarketPrice.source == "bricklink",
                MarketPrice.fetched_at >= since,
            )
            .order_by(MarketPrice.fetched_at.asc())
            .all()
        )

        grouped_new: dict[date, list[Decimal]] = defaultdict(list)
        grouped_used: dict[date, list[Decimal]] = defaultdict(list)
        grouped_min_new: dict[date, list[Decimal]] = defaultdict(list)
        grouped_max_new: dict[date, list[Decimal]] = defaultdict(list)
        grouped_min_used: dict[date, list[Decimal]] = defaultdict(list)
        grouped_max_used: dict[date, list[Decimal]] = defaultdict(list)
        for row in rows:
            key = row.fetched_at.date()
            if row.price_new is not None:
                grouped_new[key].append(Decimal(str(row.price_new)))
            if row.min_price_new is not None:
                grouped_min_new[key].append(Decimal(str(row.min_price_new)))
            elif row.price_new is not None:
                grouped_min_new[key].append(Decimal(str(row.price_new)))
            if row.max_price_new is not None:
                grouped_max_new[key].append(Decimal(str(row.max_price_new)))
            elif row.price_new is not None:
                grouped_max_new[key].append(Decimal(str(row.price_new)))
            if row.price_used is not None:
                grouped_used[key].append(Decimal(str(row.price_used)))
            if row.min_price_used is not None:
                grouped_min_used[key].append(Decimal(str(row.min_price_used)))
            elif row.price_used is not None:
                grouped_min_used[key].append(Decimal(str(row.price_used)))
            if row.max_price_used is not None:
                grouped_max_used[key].append(Decimal(str(row.max_price_used)))
            elif row.price_used is not None:
                grouped_max_used[key].append(Decimal(str(row.price_used)))

        all_dates = sorted(set(grouped_new.keys()) | set(grouped_used.keys()))
        points: list[dict] = []
        for day in all_dates:
            new_values = grouped_new.get(day, [])
            used_values = grouped_used.get(day, [])
            avg_new = (sum(new_values) / Decimal(len(new_values))).quantize(Decimal("0.01")) if new_values else None
            avg_used = (sum(used_values) / Decimal(len(used_values))).quantize(Decimal("0.01")) if used_values else None
            min_new_values = grouped_min_new.get(day, [])
            max_new_values = grouped_max_new.get(day, [])
            min_used_values = grouped_min_used.get(day, [])
            max_used_values = grouped_max_used.get(day, [])
            points.append(
                {
                    "date": datetime(day.year, day.month, day.day, tzinfo=timezone.utc),
                    "price_new": avg_new,
                    "price_used": avg_used,
                    "min_price_new": min(min_new_values).quantize(Decimal("0.01")) if min_new_values else avg_new,
                    "max_price_new": max(max_new_values).quantize(Decimal("0.01")) if max_new_values else avg_new,
                    "min_price_used": min(min_used_values).quantize(Decimal("0.01")) if min_used_values else avg_used,
                    "max_price_used": max(max_used_values).quantize(Decimal("0.01")) if max_used_values else avg_used,
                }
            )

        return product.condition, points

    def _month_start(self, value: date) -> date:
        return date(value.year, value.month, 1)

    def _next_month(self, value: date) -> date:
        if value.month == 12:
            return date(value.year + 1, 1, 1)
        return date(value.year, value.month + 1, 1)

    def _backfill_monthly_history(self, db: Session, product_id: UUID) -> None:
        """Rellena meses vacíos desde la compra con un snapshot mensual aproximado."""
        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            return

        snapshots = (
            db.query(MarketPrice)
            .filter(MarketPrice.product_id == product_id)
            .order_by(MarketPrice.fetched_at.asc())
            .all()
        )
        if not snapshots:
            return

        start_date = product.purchase_date or snapshots[0].fetched_at.date()
        current_month = self._month_start(start_date)
        limit_month = self._month_start(datetime.now(timezone.utc).date())

        month_values: dict[date, list[Decimal]] = {}
        for entry in snapshots:
            month_key = self._month_start(entry.fetched_at.date())
            value = self.select_price_by_condition(product.condition, entry.price_new, entry.price_used)
            if value is not None:
                month_values.setdefault(month_key, []).append(Decimal(str(value)))

        synthetic_rows: list[MarketPrice] = []
        carry_value: Optional[Decimal] = None

        while current_month <= limit_month:
            month_prices = month_values.get(current_month, [])
            if month_prices:
                carry_value = sum(month_prices) / Decimal(len(month_prices))
            elif carry_value is not None:
                synthetic_rows.append(
                    MarketPrice(
                        product_id=product_id,
                        source="bricklink",
                        price_new=carry_value.quantize(Decimal("0.01")),
                        price_used=carry_value.quantize(Decimal("0.01")),
                        min_price_new=carry_value.quantize(Decimal("0.01")),
                        max_price_new=carry_value.quantize(Decimal("0.01")),
                        min_price_used=carry_value.quantize(Decimal("0.01")),
                        max_price_used=carry_value.quantize(Decimal("0.01")),
                        currency="EUR",
                        fetched_at=datetime(
                            current_month.year,
                            current_month.month,
                            15,
                            tzinfo=timezone.utc,
                        ),
                    )
                )

            current_month = self._next_month(current_month)

        if synthetic_rows:
            db.add_all(synthetic_rows)
            db.commit()

    def save_price(self, db: Session, product_id: UUID, source: str, data: dict) -> MarketPrice:
        """Persiste un snapshot diario único por producto.

        Si ya existe un registro para hoy, se sobreescribe con los nuevos datos.
        Además, se normaliza siempre la moneda a EUR.
        """
        now_spain = self._now_spain()
        today_spain = now_spain.date()
        # La columna es TIMESTAMP sin timezone; persistimos hora local naive para que
        # el cast a DATE en BD respete el calendario español sin desplazamientos UTC.
        now_spain_naive = now_spain.replace(tzinfo=None)

        # Moneda forzada a EUR para todo almacenamiento.
        normalized_data = {**data, "currency": "EUR"}
        storage_product_id = self._resolve_storage_product_id(db, product_id)

        existing_today = (
            db.query(MarketPrice)
            .filter(
                MarketPrice.product_id == storage_product_id,
                MarketPrice.source == source,
                cast(MarketPrice.fetched_at, SADate) == today_spain,
            )
            .order_by(MarketPrice.fetched_at.desc())
            .all()
        )

        if existing_today:
            # Se actualiza el más reciente y se eliminan duplicados del mismo día.
            price = existing_today[0]
            price.source = source
            price.price_new = normalized_data.get("price_new")
            price.price_used = normalized_data.get("price_used")
            price.min_price_new = normalized_data.get("min_price_new")
            price.max_price_new = normalized_data.get("max_price_new")
            price.min_price_used = normalized_data.get("min_price_used")
            price.max_price_used = normalized_data.get("max_price_used")
            price.currency = "EUR"
            price.fetched_at = now_spain_naive

            for duplicate in existing_today[1:]:
                db.delete(duplicate)
        else:
            price = MarketPrice(
                product_id=storage_product_id,
                source=source,
                price_new=normalized_data.get("price_new"),
                price_used=normalized_data.get("price_used"),
                min_price_new=normalized_data.get("min_price_new"),
                max_price_new=normalized_data.get("max_price_new"),
                min_price_used=normalized_data.get("min_price_used"),
                max_price_used=normalized_data.get("max_price_used"),
                currency="EUR",
                fetched_at=now_spain_naive,
            )
            db.add(price)

        db.commit()
        db.refresh(price)
        return price

    def save_monthly_history_points(
        self,
        db: Session,
        product_id: UUID,
        source: str,
        points: list[dict],
        prune_missing_months: bool = False,
    ) -> int:
        """Persiste histórico mensual real sin interpolaciones.

        Se hace upsert por producto+fuente+fecha (día), manteniendo un único
        snapshot por mes cuando la fuente proporciona ese punto.

        Por defecto NO se podan fechas históricas ausentes para evitar borrar
        snapshots diarios válidos generados por scraping en días anteriores.
        """
        if not points:
            return 0

        storage_product_id = self._resolve_storage_product_id(db, product_id)

        today_spain = self._now_spain().date()
        normalized_points: list[dict] = []
        keep_dates: set[date] = set()
        for point in points:
            fetched_at = point.get("fetched_at")
            if not isinstance(fetched_at, datetime):
                continue
            # Descarta puntos con fecha futura (segunda barrera tras el parser).
            if fetched_at.date() > today_spain:
                logger.warning(
                    "save_monthly_history_points: ignorando punto con fecha futura %s",
                    fetched_at.date(),
                )
                continue
            normalized_points.append(point)
            keep_dates.add(fetched_at.date())

        if not normalized_points:
            return 0

        if prune_missing_months:
            today_spain = self._now_spain().date()
            stale_rows = (
                db.query(MarketPrice)
                .filter(
                    MarketPrice.product_id == storage_product_id,
                    MarketPrice.source == source,
                    cast(MarketPrice.fetched_at, SADate) < today_spain,
                )
                .all()
            )
            for row in stale_rows:
                row_date = row.fetched_at.date() if isinstance(row.fetched_at, datetime) else None
                if row_date is None:
                    continue
                # Solo poda snapshots de cierre mensual; las muestras diarias
                # deben mantenerse para conservar el histórico real día a día.
                if row_date.day != calendar.monthrange(row_date.year, row_date.month)[1]:
                    continue
                if row_date not in keep_dates:
                    db.delete(row)

            # Borra también filas con fecha futura (segunda barrera de seguridad).
            future_rows = (
                db.query(MarketPrice)
                .filter(
                    MarketPrice.product_id == storage_product_id,
                    MarketPrice.source == source,
                    cast(MarketPrice.fetched_at, SADate) > today_spain,
                )
                .all()
            )
            for row in future_rows:
                db.delete(row)

        saved = 0
        for point in normalized_points:
            fetched_at = point.get("fetched_at")

            day = fetched_at.date()
            existing = (
                db.query(MarketPrice)
                .filter(
                    MarketPrice.product_id == storage_product_id,
                    MarketPrice.source == source,
                    cast(MarketPrice.fetched_at, SADate) == day,
                )
                .order_by(MarketPrice.fetched_at.desc())
                .all()
            )

            payload = {
                "price_new": point.get("price_new"),
                "price_used": point.get("price_used"),
                "min_price_new": point.get("min_price_new"),
                "max_price_new": point.get("max_price_new"),
                "min_price_used": point.get("min_price_used"),
                "max_price_used": point.get("max_price_used"),
                "currency": "EUR",
            }

            if existing:
                row = existing[0]
                row.price_new = payload["price_new"]
                row.price_used = payload["price_used"]
                row.min_price_new = payload["min_price_new"]
                row.max_price_new = payload["max_price_new"]
                row.min_price_used = payload["min_price_used"]
                row.max_price_used = payload["max_price_used"]
                row.currency = "EUR"
                row.fetched_at = fetched_at

                for duplicate in existing[1:]:
                    db.delete(duplicate)
            else:
                db.add(
                    MarketPrice(
                        product_id=storage_product_id,
                        source=source,
                        price_new=payload["price_new"],
                        price_used=payload["price_used"],
                        min_price_new=payload["min_price_new"],
                        max_price_new=payload["max_price_new"],
                        min_price_used=payload["min_price_used"],
                        max_price_used=payload["max_price_used"],
                        currency="EUR",
                        fetched_at=fetched_at,
                    )
                )

            saved += 1

        if saved > 0:
            db.commit()

        return saved

    def seed_last_six_months_history(
        self,
        db: Session,
        product_id: UUID,
        source: str,
        data: dict,
        months: int = 6,
    ) -> None:
        """Guarda histórico mensual de N meses previos (sin incluir el mes actual).

        Cada punto se persiste en el último día de su mes para mostrar una serie
        histórica estable al importar/crear un producto.
        """
        if months <= 0:
            return

        storage_product_id = self._resolve_storage_product_id(db, product_id)
        today = datetime.now(timezone.utc).date()
        normalized_data = {**data, "currency": "EUR"}

        for months_ago in range(months, 0, -1):
            progress_index = months - months_ago + 1
            progress = Decimal(progress_index) / Decimal(months)

            year = today.year
            month = today.month - months_ago
            while month <= 0:
                month += 12
                year -= 1

            last_day = calendar.monthrange(year, month)[1]
            month_end = date(year, month, last_day)
            fetched_at = datetime(year, month, last_day, 23, 59, 59, tzinfo=timezone.utc)

            existing = (
                db.query(MarketPrice)
                .filter(
                    MarketPrice.product_id == storage_product_id,
                    MarketPrice.source == source,
                    cast(MarketPrice.fetched_at, SADate) == month_end,
                )
                .order_by(MarketPrice.fetched_at.desc())
                .all()
            )

            month_price_new = self._interpolate_month_price(
                normalized_data.get("min_price_new"),
                normalized_data.get("price_new"),
                normalized_data.get("max_price_new"),
                progress,
            )
            month_price_used = self._interpolate_month_price(
                normalized_data.get("min_price_used"),
                normalized_data.get("price_used"),
                normalized_data.get("max_price_used"),
                progress,
            )
            month_min_new = normalized_data.get("min_price_new") or month_price_new
            month_max_new = normalized_data.get("max_price_new") or month_price_new
            month_min_used = normalized_data.get("min_price_used") or month_price_used
            month_max_used = normalized_data.get("max_price_used") or month_price_used

            if existing:
                price = existing[0]
                price.price_new = month_price_new
                price.price_used = month_price_used
                price.min_price_new = month_min_new
                price.max_price_new = month_max_new
                price.min_price_used = month_min_used
                price.max_price_used = month_max_used
                price.currency = "EUR"
                price.fetched_at = fetched_at

                for duplicate in existing[1:]:
                    db.delete(duplicate)
            else:
                db.add(
                    MarketPrice(
                        product_id=storage_product_id,
                        source=source,
                        price_new=month_price_new,
                        price_used=month_price_used,
                        min_price_new=month_min_new,
                        max_price_new=month_max_new,
                        min_price_used=month_min_used,
                        max_price_used=month_max_used,
                        currency="EUR",
                        fetched_at=fetched_at,
                    )
                )

        db.commit()

    def get_latest_price_by_set_number(self, db: Session, set_number: str) -> Optional[MarketPrice]:
        return (
            db.query(MarketPrice)
            .join(Product, MarketPrice.product_id == Product.id)
            .filter(
                Product.set_number == set_number,
                Product.deleted_at.is_(None),
                MarketPrice.source == "bricklink",
            )
            .order_by(MarketPrice.fetched_at.desc())
            .first()
        )

    async def scrape_by_set_number(self, set_number: str) -> Optional[dict]:
        """Consulta BrickLink directamente por código de set sin requerir producto en inventario."""
        from app.scraper.bricklink_scraper import BrickLinkScraper

        scraper = BrickLinkScraper()
        try:
            data = await scraper.fetch_with_retry(set_number)
            if not data:
                return None
            return {
                "set_number": set_number,
                "source": data.source,
                "price_new": data.price_new,
                "min_price_new": data.min_price_new,
                "max_price_new": data.max_price_new,
                "price_used": data.price_used,
                "min_price_used": data.min_price_used,
                "max_price_used": data.max_price_used,
                "currency": "EUR",
                "fetched_at": datetime.now(timezone.utc),
            }
        finally:
            await scraper.close()

    def check_alerts(self, db: Session, product_id: UUID) -> None:
        """Evalúa alertas activas de un producto y registra last_triggered si se cumple la condición."""
        alerts = (
            db.query(PriceAlert)
            .filter(PriceAlert.product_id == product_id, PriceAlert.is_active.is_(True))
            .all()
        )
        if not alerts:
            return

        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            return

        set_number = (product.set_number or "").strip()
        if not set_number:
            return

        # Último precio BrickLink (fuente oficial de referencia para alertas).
        latest = (
            db.query(MarketPrice)
            .join(Product, MarketPrice.product_id == Product.id)
            .filter(
                Product.set_number == set_number,
                Product.deleted_at.is_(None),
                MarketPrice.source == "bricklink",
            )
            .order_by(MarketPrice.fetched_at.desc())
            .first()
        )
        if not latest:
            return

        current_price = self.select_price_by_condition(
            product.condition if product else None,
            latest.price_new,
            latest.price_used,
        )
        if current_price is None:
            return

        for alert in alerts:
            triggered = False
            if alert.alert_type == "PRICE_ABOVE" and current_price >= alert.threshold_value:
                triggered = True
            elif alert.alert_type == "PRICE_BELOW" and current_price <= alert.threshold_value:
                triggered = True

            if triggered:
                alert.last_triggered = datetime.now(timezone.utc)

        db.commit()


class AlertService:
    """CRUD de alertas de precio."""

    def list_active_alerts(self, db: Session) -> List[PriceAlert]:
        return db.query(PriceAlert).filter(PriceAlert.is_active.is_(True)).order_by(PriceAlert.created_at.desc()).all()

    def create_alert(self, db: Session, data: PriceAlertCreate) -> PriceAlert:
        alert = PriceAlert(**data.model_dump())
        db.add(alert)
        db.commit()
        db.refresh(alert)
        return alert

    def delete_alert(self, db: Session, alert_id: UUID) -> bool:
        alert = db.query(PriceAlert).filter(PriceAlert.id == alert_id).first()
        if not alert:
            return False
        db.delete(alert)
        db.commit()
        return True


class DashboardService:
    """Cálculo de KPIs para el panel de control."""

    SPAIN_TZ = ZoneInfo("Europe/Madrid")

    def _select_market_price(
        self,
        condition: Optional[str],
        price_new: Optional[Decimal],
        price_used: Optional[Decimal],
    ) -> Optional[Decimal]:
        if condition == "SEALED":
            return price_new
        if condition in ("OPEN_COMPLETE", "OPEN_INCOMPLETE"):
            return price_used
        return price_used

    def _latest_price_for_set(
        self,
        db: Session,
        set_number: Optional[str],
        condition: Optional[str],
    ) -> Optional[MarketPrice]:
        if not set_number:
            return None

        today_spain = datetime.now(self.SPAIN_TZ).date()
        condition_price_filter = (
            MarketPrice.price_new.isnot(None)
            if condition == "SEALED"
            else MarketPrice.price_used.isnot(None)
        )

        return (
            db.query(MarketPrice)
            .join(Product, MarketPrice.product_id == Product.id)
            .filter(
                Product.set_number == set_number,
                Product.deleted_at.is_(None),
                MarketPrice.source == "bricklink",
                condition_price_filter,
                cast(MarketPrice.fetched_at, SADate) <= today_spain,
            )
            .order_by(MarketPrice.fetched_at.desc())
            .first()
        )

    def _compute_current_totals(self, db: Session) -> tuple[Decimal, Decimal, Decimal]:
        """Recalcula el total actual como suma real de todos los productos activos."""
        products = db.query(Product).filter(
            Product.deleted_at.is_(None),
            Product.availability == "available",
        ).all()

        invested_value = Decimal("0")
        market_value = Decimal("0")

        for product in products:
            qty = Decimal(str(product.quantity or 1))
            invested_value += Decimal(str(product.purchase_price or 0)) * qty

            latest = self._latest_price_for_set(db, product.set_number, product.condition)
            if latest:
                selected = self._select_market_price(product.condition, latest.price_new, latest.price_used)
                if selected is not None:
                    market_value += Decimal(str(selected)) * qty

        invested_value = invested_value.quantize(Decimal("0.01"))
        market_value = market_value.quantize(Decimal("0.01"))
        profit_value = (market_value - invested_value).quantize(Decimal("0.01"))
        return invested_value, market_value, profit_value

    def _bootstrap_daily_snapshots_from_market_history(
        self,
        db: Session,
        limit: Optional[int] = 200,
        force_reset: bool = False,
    ) -> None:
        """Inicializa/reconstruye snapshots diarios desde market_prices."""
        if force_reset:
            db.query(PortfolioDailySnapshot).delete()
            db.commit()
        elif db.query(PortfolioDailySnapshot.id).first():
            return

        from sqlalchemy import Date as SADate, cast

        today_spain = datetime.now(self.SPAIN_TZ).date()
        days = [
            row.date
            for row in (
                db.query(cast(MarketPrice.fetched_at, SADate).label("date"))
                .join(Product, MarketPrice.product_id == Product.id)
                .filter(
                    Product.deleted_at.is_(None),
                    Product.availability == "available",
                    MarketPrice.source == "bricklink",
                    # Excluye fechas futuras para que los snapshots solo reflejen días pasados/hoy.
                    cast(MarketPrice.fetched_at, SADate) <= today_spain,
                )
                .group_by(cast(MarketPrice.fetched_at, SADate))
                .order_by(cast(MarketPrice.fetched_at, SADate))
                .all()
            )
        ]
        if limit is not None:
            days = days[:limit]

        products = db.query(Product).filter(
            Product.deleted_at.is_(None),
            Product.availability == "available",
        ).all()
        if not days or not products:
            return

        product_histories: dict[str, list[MarketPrice]] = {}
        for product in products:
            set_key = (product.set_number or "").strip()
            if set_key in product_histories:
                continue
            history = (
                db.query(MarketPrice)
                .join(Product, MarketPrice.product_id == Product.id)
                .filter(
                    Product.set_number == product.set_number,
                    Product.deleted_at.is_(None),
                    MarketPrice.source == "bricklink",
                )
                .order_by(MarketPrice.fetched_at.asc())
                .all()
            )
            product_histories[set_key] = history

        for day in days:
            invested_value = Decimal("0")
            market_value = Decimal("0")
            # Comparamos en naive UTC para evitar mezcla aware/naive según driver/DB.
            day_end = datetime(day.year, day.month, day.day, 23, 59, 59)

            for product in products:
                qty = Decimal(str(product.quantity or 1))
                invested_value += Decimal(str(product.purchase_price or 0)) * qty

                history = product_histories.get((product.set_number or "").strip(), [])
                latest = None
                for snapshot in history:
                    fetched_at = snapshot.fetched_at
                    if fetched_at.tzinfo is not None:
                        fetched_at = fetched_at.astimezone(timezone.utc).replace(tzinfo=None)

                    if fetched_at <= day_end:
                        selected = self._select_market_price(product.condition, snapshot.price_new, snapshot.price_used)
                        if selected is not None:
                            latest = snapshot
                    else:
                        break

                if latest:
                    selected = self._select_market_price(product.condition, latest.price_new, latest.price_used)
                    if selected is not None:
                        market_value += Decimal(str(selected)) * qty

            snapshot = PortfolioDailySnapshot(
                date=day,
                invested_value=invested_value.quantize(Decimal("0.01")),
                market_value=market_value.quantize(Decimal("0.01")),
                profit_value=(market_value - invested_value).quantize(Decimal("0.01")),
            )
            db.add(snapshot)

        db.commit()

    def rebuild_daily_snapshots_from_market_history(self, db: Session) -> None:
        """Recalcula todo el histórico diario de cartera y actualiza el día actual."""
        self._bootstrap_daily_snapshots_from_market_history(db, limit=None, force_reset=True)
        self.upsert_today_snapshot_spain(db)

    def _upsert_snapshot_for_date(self, db: Session, target_date: date) -> None:
        """Sobrescribe el snapshot de una fecha concreta con recálculo completo."""
        invested_value, market_value, profit_value = self._compute_current_totals(db)

        snapshot = db.query(PortfolioDailySnapshot).filter(PortfolioDailySnapshot.date == target_date).first()
        if snapshot is None:
            snapshot = PortfolioDailySnapshot(
                date=target_date,
                invested_value=invested_value,
                market_value=market_value,
                profit_value=profit_value,
            )
            db.add(snapshot)
        else:
            snapshot.invested_value = invested_value
            snapshot.market_value = market_value
            snapshot.profit_value = profit_value

        db.commit()

    def upsert_today_snapshot_spain(self, db: Session) -> None:
        """Upsert del snapshot diario usando calendario local de España."""
        today_spain = datetime.now(self.SPAIN_TZ).date()
        self._upsert_snapshot_for_date(db, today_spain)

    def get_summary(self, db: Session) -> DashboardSummary:
        products = db.query(Product).filter(
            Product.deleted_at.is_(None),
            Product.availability == "available",
        ).all()

        total_items = sum(p.quantity for p in products)
        total_purchase = sum(
            (p.purchase_price or Decimal("0")) * p.quantity for p in products
        )

        # Último precio de mercado por producto, ajustado a su estado.
        total_market = Decimal("0")
        for p in products:
            latest = self._latest_price_for_set(db, p.set_number, p.condition)
            if latest:
                market_price = self._select_market_price(p.condition, latest.price_new, latest.price_used) or Decimal("0")
                total_market += market_price * p.quantity

        potential_margin = total_market - total_purchase
        avg_margin_pct = (
            float((potential_margin / total_purchase) * 100) if total_purchase else 0.0
        )

        return DashboardSummary(
            total_items=total_items,
            total_purchase_value=total_purchase,
            total_market_value=total_market,
            potential_margin=potential_margin,
            avg_margin_pct=round(avg_margin_pct, 2),
        )

    def get_top_margin(self, db: Session, limit: int = 10) -> List[TopMarginProduct]:
        products = db.query(Product).filter(
            Product.deleted_at.is_(None),
            Product.availability == "available",
        ).all()
        results = []

        for p in products:
            latest = self._latest_price_for_set(db, p.set_number, p.condition)
            market_value = None
            margin_pct = None
            if latest:
                market_value = self._select_market_price(p.condition, latest.price_new, latest.price_used)
                if market_value and p.purchase_price and p.purchase_price > 0:
                    margin_pct = round(float((market_value - p.purchase_price) / p.purchase_price * 100), 2)

            results.append(
                TopMarginProduct(
                    id=p.id,
                    name=p.name,
                    set_number=p.set_number,
                    purchase_price=p.purchase_price,
                    market_value=market_value,
                    margin_pct=margin_pct,
                )
            )

        # Ordena por margen descendente, None al final
        results.sort(key=lambda x: x.margin_pct or -999, reverse=True)
        return results[:limit]

    def get_price_detail_trends(self, db: Session) -> List[PriceDetailTrendPoint]:
        """Devuelve min/medio/max diario para análisis global de precios de mercado."""
        from sqlalchemy import cast, Date as SADate, func

        today_spain = datetime.now(self.SPAIN_TZ).date()
        base_price = func.coalesce(MarketPrice.price_new, MarketPrice.price_used)
        rows = (
            db.query(
                cast(MarketPrice.fetched_at, SADate).label("date"),
                func.min(base_price).label("min_price"),
                func.avg(base_price).label("avg_price"),
                func.max(base_price).label("max_price"),
            )
            .filter(
                MarketPrice.source == "bricklink",
                cast(MarketPrice.fetched_at, SADate) <= today_spain,
            )
            .group_by(cast(MarketPrice.fetched_at, SADate))
            .order_by(cast(MarketPrice.fetched_at, SADate))
            .limit(365)
            .all()
        )

        return [
            PriceDetailTrendPoint(
                date=row.date,
                min_price=Decimal(str(row.min_price or 0)).quantize(Decimal("0.01")),
                avg_price=Decimal(str(row.avg_price or 0)).quantize(Decimal("0.01")),
                max_price=Decimal(str(row.max_price or 0)).quantize(Decimal("0.01")),
            )
            for row in rows
        ]

    def get_price_insights(self, db: Session, limit: int = 200) -> List[PriceInsightProduct]:
        """Calcula métricas por set y ordena por beneficio absoluto en euros."""
        today_spain = datetime.now(self.SPAIN_TZ).date()
        products = (
            db.query(Product)
            .filter(Product.deleted_at.is_(None), Product.availability == "available")
            .order_by(Product.created_at.desc())
            .limit(limit)
            .all()
        )
        insights: list[PriceInsightProduct] = []

        for product in products:
            history = (
                db.query(MarketPrice)
                .join(Product, MarketPrice.product_id == Product.id)
                .filter(
                    Product.set_number == product.set_number,
                    Product.deleted_at.is_(None),
                    MarketPrice.source == "bricklink",
                    cast(MarketPrice.fetched_at, SADate) <= today_spain,
                )
                .order_by(MarketPrice.fetched_at.asc())
                .all()
            )
            values = [
                Decimal(str(self._select_market_price(product.condition, price.price_new, price.price_used)))
                for price in history
                if self._select_market_price(product.condition, price.price_new, price.price_used) is not None
            ]
            if product.condition == "SEALED":
                min_candidates = [
                    Decimal(str(price.min_price_new))
                    for price in history
                    if price.min_price_new is not None
                ]
                max_candidates = [
                    Decimal(str(price.max_price_new))
                    for price in history
                    if price.max_price_new is not None
                ]
            else:
                min_candidates = [
                    Decimal(str(price.min_price_used))
                    for price in history
                    if price.min_price_used is not None
                ]
                max_candidates = [
                    Decimal(str(price.max_price_used))
                    for price in history
                    if price.max_price_used is not None
                ]
            current = values[-1] if values else None
            min_value = min(min_candidates) if min_candidates else (min(values) if values else None)
            max_value = max(max_candidates) if max_candidates else (max(values) if values else None)
            avg_value = (sum(values) / Decimal(len(values))).quantize(Decimal("0.01")) if values else None

            profit_eur = None
            if current is not None and product.purchase_price is not None:
                profit_eur = (current - Decimal(str(product.purchase_price))).quantize(Decimal("0.01"))

            insights.append(
                PriceInsightProduct(
                    id=product.id,
                    name=product.name,
                    set_number=product.set_number,
                    condition=product.condition,
                    purchase_price=product.purchase_price,
                    current_market_price=current,
                    min_market_price=min_value,
                    max_market_price=max_value,
                    avg_market_price=avg_value,
                    profit_eur=profit_eur,
                )
            )

        insights.sort(key=lambda item: item.profit_eur or Decimal("-999999"), reverse=True)
        return insights

    def get_real_profit_summary(self, db: Session) -> RealProfitSummary:
        """Calcula el resumen de beneficios reales sobre productos vendidos."""
        products = db.query(Product).filter(
            Product.deleted_at.is_(None),
            Product.availability == "sold",
            Product.sold_price.isnot(None),
        ).all()

        # total_sold_items = unidades físicas vendidas (quantity), no filas de BD
        total_sold_items = sum(p.quantity or 1 for p in products)
        if total_sold_items == 0:
            return RealProfitSummary(
                total_sold_items=0,
                total_sold_revenue=Decimal("0"),
                total_real_profit=Decimal("0"),
                avg_profit_per_item=Decimal("0"),
            )

        total_sold_revenue = sum(
            Decimal(str(p.sold_price)) * Decimal(str(p.quantity or 1)) for p in products
        ).quantize(Decimal("0.01"))

        total_real_profit = sum(
            (Decimal(str(p.sold_price)) - Decimal(str(p.purchase_price or 0))) * Decimal(str(p.quantity or 1))
            for p in products
        ).quantize(Decimal("0.01"))

        avg_profit_per_item = (total_real_profit / Decimal(str(total_sold_items))).quantize(Decimal("0.01"))

        return RealProfitSummary(
            total_sold_items=total_sold_items,
            total_sold_revenue=total_sold_revenue,
            total_real_profit=total_real_profit,
            avg_profit_per_item=avg_profit_per_item,
        )

    def get_price_trends(self, db: Session) -> list:
        """Devuelve evolución diaria persistida de portfolio.

        La reconstrucción del histórico se realiza únicamente desde el endpoint
        /scraper/refresh-all o el scheduler nocturno; no en cada lectura.
        """
        from app.schemas.price import PriceTrendPoint

        rows = (
            db.query(PortfolioDailySnapshot)
            .order_by(PortfolioDailySnapshot.date.asc())
            .limit(200)
            .all()
        )

        return [
            PriceTrendPoint(
                date=datetime(row.date.year, row.date.month, row.date.day, tzinfo=timezone.utc),
                invested_value=Decimal(str(row.invested_value)).quantize(Decimal("0.01")),
                market_value=Decimal(str(row.market_value)).quantize(Decimal("0.01")),
                profit_value=Decimal(str(row.profit_value)).quantize(Decimal("0.01")),
            )
            for row in rows
        ]


price_service = PriceService()
alert_service = AlertService()
dashboard_service = DashboardService()
