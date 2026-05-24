from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
import schemas, models, database
from services.storage import upload_receipt

router = APIRouter(
    prefix="/sales",
    tags=["sales"]
)

@router.post("/set/{set_id}", response_model=schemas.Sale)
def register_sale(
    set_id: int,
    sell_price: float = Form(...),
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
        receipt_url = upload_receipt(receipt)
        if not receipt_url:
            raise HTTPException(status_code=500, detail="Failed to upload receipt")

    # Create sale
    db_sale = models.Sale(
        lego_set_id=set_id,
        sell_price=sell_price,
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
