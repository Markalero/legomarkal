from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta, timezone
import schemas, models, database

router = APIRouter(
    prefix="/metrics",
    tags=["metrics"]
)

@router.get("/dashboard", response_model=schemas.DashboardMetrics)
def get_dashboard_metrics(db: Session = Depends(database.get_db)):
    # Total investment (sum of buy_price for IN_STOCK items)
    in_stock_sets = db.query(models.LegoSet).filter(models.LegoSet.status == models.SetStatus.IN_STOCK).all()
    total_investment = sum(s.buy_price * s.quantity for s in in_stock_sets)
    
    # Current value (sum of current_price or msrp or buy_price for IN_STOCK items)
    current_value = 0
    sets_in_stock = 0
    for s in in_stock_sets:
        price = s.current_price or s.msrp or s.buy_price
        current_value += price * s.quantity
        sets_in_stock += s.quantity
        
    unrealized_profit = current_value - total_investment
        
    # Sales metrics
    sales = db.query(models.Sale).all()
    sets_sold = len(sales)
    
    # Calculate Total ROI (Overall Portfolio Realized ROI on sales)
    total_roi = 0
    realized_profit = 0
    realized_profit_1m = 0
    realized_profit_6m = 0
    total_sold_cost = 0
    
    if sets_sold > 0:
        now = datetime.now(timezone.utc)
        one_month_ago = now - timedelta(days=30)
        six_months_ago = now - timedelta(days=180)
        
        for sale in sales:
            cost = sale.lego_set.buy_price
            profit = (sale.sell_price - cost)
            realized_profit += profit
            total_sold_cost += cost
            
            # Use sell_date if available, otherwise assume very old so it doesn't skew recent metrics
            sale_date = sale.sell_date if sale.sell_date else (now - timedelta(days=365))
            if sale.sell_date and sale.sell_date.tzinfo is None:
                sale_date = sale.sell_date.replace(tzinfo=timezone.utc)
            
            if sale_date >= one_month_ago:
                realized_profit_1m += profit
            if sale_date >= six_months_ago:
                realized_profit_6m += profit
                
        if total_sold_cost > 0:
            total_roi = (realized_profit / total_sold_cost) * 100
        
    potential_roi = 0
    if total_investment > 0:
        potential_roi = (unrealized_profit / total_investment) * 100

    return schemas.DashboardMetrics(
        total_investment=total_investment,
        current_value=current_value,
        total_roi=round(total_roi, 2),
        realized_profit=round(realized_profit, 2),
        realized_profit_1m=round(realized_profit_1m, 2),
        realized_profit_6m=round(realized_profit_6m, 2),
        unrealized_profit=round(unrealized_profit, 2),
        potential_roi=round(potential_roi, 2),
        sets_in_stock=sets_in_stock,
        sets_sold=sets_sold
    )

from typing import List

@router.get("/history", response_model=List[schemas.ChartDataPoint])
def get_portfolio_history(db: Session = Depends(database.get_db)):
    from datetime import datetime
    all_sets = db.query(models.LegoSet).all()
    
    history_records = db.query(
        func.date(models.PriceHistory.recorded_at).label('date'),
        func.sum(models.PriceHistory.price * models.LegoSet.quantity).label('total_value')
    ).join(models.LegoSet, models.PriceHistory.lego_set_id == models.LegoSet.id)\
     .group_by(func.date(models.PriceHistory.recorded_at))\
     .order_by(func.date(models.PriceHistory.recorded_at)).all()
    
    chart_data = []
    for r in history_records:
        if not r.total_value:
            continue
            
        record_date_str = str(r.date)
        try:
            record_date = datetime.strptime(record_date_str, "%Y-%m-%d").date()
        except ValueError:
            record_date = datetime.now().date()
            
        daily_investment = 0
        for s in all_sets:
            # Handle possible string formats or datetime objects
            if isinstance(s.purchase_date, datetime):
                purchase_date = s.purchase_date.date()
            elif isinstance(s.purchase_date, str):
                try:
                    purchase_date = datetime.fromisoformat(s.purchase_date.replace("Z", "+00:00")).date()
                except ValueError:
                    purchase_date = record_date
            else:
                purchase_date = s.purchase_date

            if purchase_date and purchase_date <= record_date:
                is_sold = False
                for sale in s.sales:
                    if isinstance(sale.sell_date, datetime):
                        sale_date = sale.sell_date.date()
                    elif isinstance(sale.sell_date, str):
                        try:
                            sale_date = datetime.fromisoformat(sale.sell_date.replace("Z", "+00:00")).date()
                        except ValueError:
                            sale_date = record_date
                    else:
                        sale_date = sale.sell_date
                        
                    if sale_date and sale_date <= record_date:
                        is_sold = True
                        break
                
                if not is_sold:
                    daily_investment += (s.buy_price * s.quantity)
                    
        chart_data.append(
            schemas.ChartDataPoint(
                date=record_date_str, 
                value=round(r.total_value, 2),
                investment=round(daily_investment, 2)
            )
        )
        
    return chart_data

@router.get("/top-performers", response_model=List[schemas.TopPerformer])
def get_top_performers(db: Session = Depends(database.get_db)):
    in_stock_sets = db.query(models.LegoSet).filter(models.LegoSet.status == models.SetStatus.IN_STOCK).all()
    
    performers = []
    for s in in_stock_sets:
        price = s.current_price or s.msrp or s.buy_price
        if s.buy_price > 0:
            roi = ((price - s.buy_price) / s.buy_price) * 100
            performers.append({
                "id": s.id,
                "product_id": s.product_id,
                "name": s.name,
                "image_url": s.image_url,
                "buy_price": s.buy_price,
                "current_price": price,
                "roi_percentage": round(roi, 2)
            })
            
    # Sort by roi_percentage descending
    performers.sort(key=lambda x: x["roi_percentage"], reverse=True)
    return [schemas.TopPerformer(**p) for p in performers[:5]]
