from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response
from sqlalchemy.orm import Session
from typing import List
import csv
import io
import schemas, models, database
from services.storage import delete_receipt
import io

router = APIRouter(
    prefix="/sets",
    tags=["sets"]
)

@router.get("/export")
def export_sets(db: Session = Depends(database.get_db)):
    sets = db.query(models.LegoSet).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow(["product_id", "name", "theme", "buy_price", "msrp", "current_price", "quantity", "status", "condition", "notes", "year_eol"])
    
    for s in sets:
        writer.writerow([
            s.product_id, s.name, s.theme, s.buy_price, s.msrp, s.current_price, 
            s.quantity, s.status.value if s.status else "", s.condition.value if s.condition else "", 
            s.notes, s.year_eol
        ])
        
    return Response(content=output.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=legomarkal_inventory.csv"})

@router.post("/import")
async def import_sets(file: UploadFile = File(...), db: Session = Depends(database.get_db)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a CSV.")
        
    content = await file.read()
    decoded = content.decode('utf-8')
    reader = csv.DictReader(io.StringIO(decoded))
    
    imported_count = 0
    for row in reader:
        # Require at least product_id, name, buy_price
        if not row.get("product_id") or not row.get("name") or not row.get("buy_price"):
            continue
            
        try:
            buy_price = float(row.get("buy_price", 0))
            msrp = float(row.get("msrp")) if row.get("msrp") else None
            current_price = float(row.get("current_price")) if row.get("current_price") else None
            quantity = int(row.get("quantity", 1))
            
            status = models.SetStatus(row.get("status")) if row.get("status") in [s.value for s in models.SetStatus] else models.SetStatus.IN_STOCK
            condition = models.SetCondition(row.get("condition")) if row.get("condition") in [c.value for c in models.SetCondition] else models.SetCondition.MISB
            
            db_set = models.LegoSet(
                product_id=row.get("product_id"),
                name=row.get("name"),
                theme=row.get("theme"),
                buy_price=buy_price,
                msrp=msrp,
                current_price=current_price,
                quantity=quantity,
                status=status,
                condition=condition,
                notes=row.get("notes"),
                year_eol=row.get("year_eol")
            )
            db.add(db_set)
            imported_count += 1
        except Exception as e:
            print(f"Error importing row {row}: {e}")
            continue
            
    db.commit()
    return {"message": f"Successfully imported {imported_count} sets."}

from routers.scraper import run_scraper_task
from fastapi import BackgroundTasks

@router.post("/", response_model=schemas.LegoSet)
def create_set(lego_set: schemas.LegoSetCreate, background_tasks: BackgroundTasks, db: Session = Depends(database.get_db)):
    db_set = models.LegoSet(**lego_set.model_dump())
    db.add(db_set)
    db.commit()
    db.refresh(db_set)
    
    background_tasks.add_task(run_scraper_task, product_id=db_set.product_id)
    return db_set

@router.get("/", response_model=List[schemas.LegoSet])
def read_sets(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    sets = db.query(models.LegoSet).offset(skip).limit(limit).all()
    return sets

@router.get("/{set_id}", response_model=schemas.LegoSet)
def read_set(set_id: int, db: Session = Depends(database.get_db)):
    db_set = db.query(models.LegoSet).filter(models.LegoSet.id == set_id).first()
    if db_set is None:
        raise HTTPException(status_code=404, detail="Set not found")
    return db_set

@router.put("/{set_id}", response_model=schemas.LegoSet)
def update_set(set_id: int, lego_set: schemas.LegoSetUpdate, db: Session = Depends(database.get_db)):
    db_set = db.query(models.LegoSet).filter(models.LegoSet.id == set_id).first()
    if db_set is None:
        raise HTTPException(status_code=404, detail="Set not found")
    
    update_data = lego_set.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_set, key, value)
        
    db.commit()
    db.refresh(db_set)
    return db_set

@router.delete("/{set_id}")
def delete_set(set_id: int, db: Session = Depends(database.get_db)):
    db_set = db.query(models.LegoSet).filter(models.LegoSet.id == set_id).first()
    if db_set is None:
        raise HTTPException(status_code=404, detail="Set not found")
        
    # Delete associated receipts if any
    for sale in db_set.sales:
        if sale.receipt_url:
            delete_receipt(sale.receipt_url)
            
    db.delete(db_set)
    db.commit()
    return {"message": "Set deleted successfully"}
