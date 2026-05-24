from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
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
        
    # Sales metrics
    sales = db.query(models.Sale).all()
    sets_sold = len(sales)
    
    # Calculate Total ROI (Profit / Investment of sold items)
    total_roi = 0
    if sets_sold > 0:
        total_profit = 0
        total_cost_sold = 0
        for sale in sales:
            total_profit += (sale.sell_price - sale.lego_set.buy_price)
            total_cost_sold += sale.lego_set.buy_price
        
        if total_cost_sold > 0:
            total_roi = (total_profit / total_cost_sold) * 100

    return schemas.DashboardMetrics(
        total_investment=total_investment,
        current_value=current_value,
        total_roi=round(total_roi, 2),
        sets_in_stock=sets_in_stock,
        sets_sold=sets_sold
    )
