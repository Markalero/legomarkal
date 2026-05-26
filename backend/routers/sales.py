from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
import schemas, models, database
from services.storage import upload_receipt, delete_receipt

router = APIRouter(
    prefix="/sales",
    tags=["sales"]
)

@router.post("/set/{set_id}", response_model=schemas.Sale)
def register_sale(
    set_id: int,
    sell_price: float = Form(...),
    sell_date: Optional[str] = Form(None),
    platform: Optional[str] = Form(None),
    receipt: Optional[UploadFile] = File(None),
    db: Session = Depends(database.get_db)
):
    # Verify set exists
    db_set = db.query(models.LegoSet).filter(models.LegoSet.id == set_id).first()
    if db_set is None:
        raise HTTPException(status_code=404, detail="Set not found")
        
    if db_set.status == models.SetStatus.SOLD:
        raise HTTPException(status_code=400, detail="Set is already sold")

    # Upload receipt if provided
    receipt_url = None
    if receipt:
        from datetime import date
        date_str = sell_date if sell_date else date.today().isoformat()
        safe_set_name = "".join([c if c.isalnum() else "_" for c in db_set.name])
        # To avoid multiple underscores
        import re
        safe_set_name = re.sub(r'_+', '_', safe_set_name).strip('_')
        
        base_name = f"{date_str}_{safe_set_name}_{sell_price}"
        
        receipt_url = upload_receipt(receipt, base_name=base_name)
        if not receipt_url:
            raise HTTPException(status_code=500, detail="Failed to upload receipt")

    # Create sale
    from dateutil.parser import parse
    parsed_date = parse(sell_date) if sell_date else None

    db_sale = models.Sale(
        lego_set_id=set_id,
        sell_price=sell_price,
        sell_date=parsed_date,
        platform=platform,
        receipt_url=receipt_url
    )
    db.add(db_sale)
    
    # Update set status
    db_set.status = models.SetStatus.SOLD
    
    db.commit()
    db.refresh(db_sale)
    return db_sale

@router.get("/", response_model=List[schemas.Sale])
def read_sales(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    sales = db.query(models.Sale).offset(skip).limit(limit).all()
    return sales

@router.put("/{sale_id}", response_model=schemas.Sale)
def update_sale(sale_id: int, sale_update: schemas.SaleUpdate, db: Session = Depends(database.get_db)):
    db_sale = db.query(models.Sale).filter(models.Sale.id == sale_id).first()
    if not db_sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    
    update_data = sale_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_sale, key, value)
        
    db.commit()
    db.refresh(db_sale)
    return db_sale

@router.delete("/{sale_id}")
def delete_sale(sale_id: int, db: Session = Depends(database.get_db)):
    db_sale = db.query(models.Sale).filter(models.Sale.id == sale_id).first()
    if not db_sale:
        raise HTTPException(status_code=404, detail="Sale not found")
        
    db_set = db_sale.lego_set
    # Revert set status back to IN_STOCK if this was the sale that marked it SOLD
    # (assuming 1 sale per set for now)
    if db_set:
        db_set.status = models.SetStatus.IN_STOCK
        
    if db_sale.receipt_url:
        delete_receipt(db_sale.receipt_url)
        
    db.delete(db_sale)
    db.commit()
    return {"message": "Sale deleted successfully, set reverted to IN_STOCK"}
