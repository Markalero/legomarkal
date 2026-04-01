# Lógica de negocio para precios de mercado y alertas
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from sqlalchemy import Date as SADate, cast, func
from sqlalchemy.orm import Session

from app.models.price import MarketPrice, PortfolioDailySnapshot, PriceAlert
from app.models.product import Product
from app.schemas.price import (
    DashboardSummary,
    PriceAlertCreate,
    PriceDetailTrendPoint,
    PriceInsightProduct,
    TopMarginProduct,
)


class PriceService:
    """Consultas y escritura de snapshots de precios de mercado."""

    def get_price_history(self, db: Session, product_id: UUID) -> List[MarketPrice]:
        self._backfill_monthly_history(db, product_id)
        return (
            db.query(MarketPrice)
            .filter(MarketPrice.product_id == product_id)
            .order_by(MarketPrice.fetched_at.desc())
            .limit(100)
            .all()
        )

    def select_price_by_condition(
        self,
        condition: Optional[str],
        price_new: Optional[Decimal],
        price_used: Optional[Decimal],
    ) -> Optional[Decimal]:
        """Selecciona el precio de mercado real según condición del producto."""
        if condition == "SEALED":
            return price_new or price_used
        if condition in ("OPEN_COMPLETE", "OPEN_INCOMPLETE"):
            return price_used or price_new
        return price_used or price_new

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

        since = datetime.now(timezone.utc) - timedelta(days=max(1, months) * 31)
        rows = (
            db.query(MarketPrice)
            .filter(
                MarketPrice.product_id == product_id,
                MarketPrice.source == "bricklink",
                MarketPrice.fetched_at >= since,
            )
            .order_by(MarketPrice.fetched_at.asc())
            .all()
        )

        grouped_new: dict[date, list[Decimal]] = defaultdict(list)
        grouped_used: dict[date, list[Decimal]] = defaultdict(list)
        for row in rows:
            key = row.fetched_at.date()
            if row.price_new is not None:
                grouped_new[key].append(Decimal(str(row.price_new)))
            if row.price_used is not None:
                grouped_used[key].append(Decimal(str(row.price_used)))

        all_dates = sorted(set(grouped_new.keys()) | set(grouped_used.keys()))
        points: list[dict] = []
        for day in all_dates:
            new_values = grouped_new.get(day, [])
            used_values = grouped_used.get(day, [])
            avg_new = (sum(new_values) / Decimal(len(new_values))).quantize(Decimal("0.01")) if new_values else None
            avg_used = (sum(used_values) / Decimal(len(used_values))).quantize(Decimal("0.01")) if used_values else None
            points.append(
                {
                    "date": datetime(day.year, day.month, day.day, tzinfo=timezone.utc),
                    "price_new": avg_new,
                    "price_used": avg_used,
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
                        min_price=carry_value.quantize(Decimal("0.01")),
                        max_price=carry_value.quantize(Decimal("0.01")),
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
        today_utc = datetime.now(timezone.utc).date()
        now_utc = datetime.now(timezone.utc)

        # Moneda forzada a EUR para todo almacenamiento.
        normalized_data = {**data, "currency": "EUR"}

        existing_today = (
            db.query(MarketPrice)
            .filter(
                MarketPrice.product_id == product_id,
                cast(MarketPrice.fetched_at, SADate) == today_utc,
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
            price.min_price = normalized_data.get("min_price")
            price.max_price = normalized_data.get("max_price")
            price.currency = "EUR"
            price.fetched_at = now_utc

            for duplicate in existing_today[1:]:
                db.delete(duplicate)
        else:
            price = MarketPrice(
                product_id=product_id,
                source=source,
                price_new=normalized_data.get("price_new"),
                price_used=normalized_data.get("price_used"),
                min_price=normalized_data.get("min_price"),
                max_price=normalized_data.get("max_price"),
                currency="EUR",
                fetched_at=now_utc,
            )
            db.add(price)

        db.commit()
        db.refresh(price)
        return price

    def get_latest_price_by_set_number(self, db: Session, set_number: str) -> Optional[MarketPrice]:
        product = (
            db.query(Product)
            .filter(Product.set_number == set_number, Product.deleted_at.is_(None))
            .order_by(Product.created_at.desc())
            .first()
        )
        if not product:
            return None

        return (
            db.query(MarketPrice)
            .filter(MarketPrice.product_id == product.id, MarketPrice.source == "bricklink")
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
                "price_used": data.price_used,
                "min_price": data.min_price,
                "max_price": data.max_price,
                "currency": data.currency,
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

        # Último precio disponible de cualquier fuente
        latest = (
            db.query(MarketPrice)
            .filter(MarketPrice.product_id == product_id)
            .order_by(MarketPrice.fetched_at.desc())
            .first()
        )
        if not latest:
            return

        product = db.query(Product).filter(Product.id == product_id).first()
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

    def _select_market_price(
        self,
        condition: Optional[str],
        price_new: Optional[Decimal],
        price_used: Optional[Decimal],
    ) -> Optional[Decimal]:
        if condition == "SEALED":
            return price_new or price_used
        if condition in ("OPEN_COMPLETE", "OPEN_INCOMPLETE"):
            return price_used or price_new
        return price_used or price_new

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

            latest = (
                db.query(MarketPrice)
                .filter(MarketPrice.product_id == product.id, MarketPrice.source == "bricklink")
                .order_by(MarketPrice.fetched_at.desc())
                .first()
            )
            if latest:
                selected = self._select_market_price(product.condition, latest.price_new, latest.price_used)
                if selected is not None:
                    market_value += Decimal(str(selected)) * qty

        invested_value = invested_value.quantize(Decimal("0.01"))
        market_value = market_value.quantize(Decimal("0.01"))
        profit_value = (market_value - invested_value).quantize(Decimal("0.01"))
        return invested_value, market_value, profit_value

    def _bootstrap_daily_snapshots_from_market_history(self, db: Session, limit: int = 200) -> None:
        """Inicializa histórico diario desde market_prices solo si aún no hay snapshots guardados."""
        if db.query(PortfolioDailySnapshot.id).first():
            return

        from sqlalchemy import Date as SADate, cast

        days = [
            row.date
            for row in (
                db.query(cast(MarketPrice.fetched_at, SADate).label("date"))
                .join(Product, MarketPrice.product_id == Product.id)
                .filter(Product.deleted_at.is_(None), MarketPrice.source == "bricklink")
                .group_by(cast(MarketPrice.fetched_at, SADate))
                .order_by(cast(MarketPrice.fetched_at, SADate))
                .limit(limit)
                .all()
            )
        ]

        products = db.query(Product).filter(Product.deleted_at.is_(None)).all()
        if not days or not products:
            return

        product_histories: dict[UUID, list[MarketPrice]] = {}
        for product in products:
            history = (
                db.query(MarketPrice)
                .filter(MarketPrice.product_id == product.id, MarketPrice.source == "bricklink")
                .order_by(MarketPrice.fetched_at.asc())
                .all()
            )
            product_histories[product.id] = history

        for day in days:
            invested_value = Decimal("0")
            market_value = Decimal("0")
            # Comparamos en naive UTC para evitar mezcla aware/naive según driver/DB.
            day_end = datetime(day.year, day.month, day.day, 23, 59, 59)

            for product in products:
                qty = Decimal(str(product.quantity or 1))
                invested_value += Decimal(str(product.purchase_price or 0)) * qty

                history = product_histories.get(product.id, [])
                latest = None
                for snapshot in history:
                    fetched_at = snapshot.fetched_at
                    if fetched_at.tzinfo is not None:
                        fetched_at = fetched_at.astimezone(timezone.utc).replace(tzinfo=None)

                    if fetched_at <= day_end:
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

    def _upsert_today_snapshot(self, db: Session) -> None:
        """Sobrescribe el valor del día actual con un recálculo completo de cartera."""
        today = datetime.now(timezone.utc).date()
        invested_value, market_value, profit_value = self._compute_current_totals(db)

        snapshot = db.query(PortfolioDailySnapshot).filter(PortfolioDailySnapshot.date == today).first()
        if snapshot is None:
            snapshot = PortfolioDailySnapshot(
                date=today,
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
            latest = (
                db.query(MarketPrice)
                .filter(MarketPrice.product_id == p.id)
                .order_by(MarketPrice.fetched_at.desc())
                .first()
            )
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
            latest = (
                db.query(MarketPrice)
                .filter(MarketPrice.product_id == p.id)
                .order_by(MarketPrice.fetched_at.desc())
                .first()
            )
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

        base_price = func.coalesce(MarketPrice.price_new, MarketPrice.price_used)
        rows = (
            db.query(
                cast(MarketPrice.fetched_at, SADate).label("date"),
                func.min(base_price).label("min_price"),
                func.avg(base_price).label("avg_price"),
                func.max(base_price).label("max_price"),
            )
            .filter(MarketPrice.source == "bricklink")
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
                .filter(MarketPrice.product_id == product.id, MarketPrice.source == "bricklink")
                .order_by(MarketPrice.fetched_at.asc())
                .all()
            )
            values = [
                Decimal(str(self._select_market_price(product.condition, price.price_new, price.price_used)))
                for price in history
                if self._select_market_price(product.condition, price.price_new, price.price_used) is not None
            ]
            min_candidates = [Decimal(str(price.min_price)) for price in history if price.min_price is not None]
            max_candidates = [Decimal(str(price.max_price)) for price in history if price.max_price is not None]
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


    def get_real_profit_summary(self, db: Session):
        """Calcula el resumen de beneficios reales sobre productos vendidos."""
        from app.schemas.price import RealProfitSummary

        products = db.query(Product).filter(
            Product.deleted_at.is_(None),
            Product.availability == "sold",
            Product.sold_price.isnot(None),
        ).all()

        total_sold_items = len(products)
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
        """Devuelve evolución diaria persistida y recalcula siempre el valor del día actual."""
        from app.schemas.price import PriceTrendPoint

        self._bootstrap_daily_snapshots_from_market_history(db)
        self._upsert_today_snapshot(db)

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
