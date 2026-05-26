from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response
from sqlalchemy.orm import Session
from sqlalchemy import text
import csv
import io
import zipfile
from datetime import datetime

import models, database
from services.storage import download_all_receipts, upload_receipt_from_bytes, delete_all_receipts

router = APIRouter(
    prefix="/backup",
    tags=["backup"]
)

@router.get("/export")
def export_backup(db: Session = Depends(database.get_db)):
    try:
        # Create an in-memory zip file
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
            
            # 1. Export LegoSets
            sets = db.query(models.LegoSet).all()
            sets_output = io.StringIO()
            sets_writer = csv.writer(sets_output)
            sets_headers = ["id", "product_id", "name", "theme", "image_url", "buy_price", "msrp", "current_price", "target_price", "year_eol", "quantity", "status", "condition", "notes", "purchase_date"]
            sets_writer.writerow(sets_headers)
            for s in sets:
                sets_writer.writerow([
                    s.id, s.product_id, s.name, s.theme, s.image_url, s.buy_price, s.msrp, s.current_price, s.target_price,
                    s.year_eol, s.quantity, s.status.value if s.status else "", s.condition.value if s.condition else "",
                    s.notes, s.purchase_date.isoformat() if s.purchase_date else ""
                ])
            zip_file.writestr("sets.csv", sets_output.getvalue().encode('utf-8'))
            
            # 2. Export Sales
            sales = db.query(models.Sale).all()
            sales_output = io.StringIO()
            sales_writer = csv.writer(sales_output)
            sales_headers = ["id", "lego_set_id", "sell_price", "sell_date", "platform", "receipt_url"]
            sales_writer.writerow(sales_headers)
            for sale in sales:
                sales_writer.writerow([
                    sale.id, sale.lego_set_id, sale.sell_price, sale.sell_date.isoformat() if sale.sell_date else "", 
                    sale.platform, sale.receipt_url
                ])
            zip_file.writestr("sales.csv", sales_output.getvalue().encode('utf-8'))
            
            # 3. Export Price History
            history = db.query(models.PriceHistory).all()
            history_output = io.StringIO()
            history_writer = csv.writer(history_output)
            history_headers = ["id", "lego_set_id", "price", "recorded_at"]
            history_writer.writerow(history_headers)
            for h in history:
                history_writer.writerow([
                    h.id, h.lego_set_id, h.price, h.recorded_at.isoformat() if h.recorded_at else ""
                ])
            zip_file.writestr("price_history.csv", history_output.getvalue().encode('utf-8'))
            
            # 4. Export Receipts
            receipts = download_all_receipts()
            for receipt in receipts:
                zip_file.writestr(f"receipts/{receipt['name']}", receipt["content"])
                
        zip_buffer.seek(0)
        
        timestamp = datetime.now().strftime("%Y-%m-%d")
        filename = f"backup_legomarkal_{timestamp}.zip"
        
        return Response(
            content=zip_buffer.getvalue(),
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        print(f"Export error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/import")
async def import_backup(file: UploadFile = File(...), db: Session = Depends(database.get_db)):
    if not file.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail="Formato inválido. Sube un ZIP.")
        
    try:
        content = await file.read()
        zip_buffer = io.BytesIO(content)
        
        with zipfile.ZipFile(zip_buffer, "r") as zip_file:
            namelist = zip_file.namelist()
            
            if "sets.csv" not in namelist or "sales.csv" not in namelist or "price_history.csv" not in namelist:
                raise HTTPException(status_code=400, detail="El ZIP no contiene los archivos CSV requeridos en la raíz.")
            
            # CLEAR THE DATABASE (Destructive)
            db.query(models.PriceHistory).delete()
            db.query(models.Sale).delete()
            db.query(models.LegoSet).delete()
            db.commit()
            
            # Delete all receipts from Supabase
            delete_all_receipts()
            
            # 1. Restore LegoSets
            sets_csv = zip_file.read("sets.csv").decode('utf-8')
            sets_reader = csv.DictReader(io.StringIO(sets_csv))
            for row in sets_reader:
                db_set = models.LegoSet(
                    id=int(row["id"]),
                    product_id=row["product_id"],
                    name=row["name"],
                    theme=row["theme"] if row["theme"] else None,
                    image_url=row["image_url"] if row["image_url"] else None,
                    buy_price=float(row["buy_price"]),
                    msrp=float(row["msrp"]) if row["msrp"] else None,
                    current_price=float(row["current_price"]) if row["current_price"] else None,
                    target_price=float(row["target_price"]) if row["target_price"] else None,
                    year_eol=row["year_eol"] if row["year_eol"] else None,
                    quantity=int(row["quantity"]) if row["quantity"] else 1,
                    status=models.SetStatus(row["status"]) if row["status"] else models.SetStatus.IN_STOCK,
                    condition=models.SetCondition(row["condition"]) if row["condition"] else models.SetCondition.MISB,
                    notes=row["notes"] if row["notes"] else None,
                    purchase_date=datetime.fromisoformat(row["purchase_date"]) if row["purchase_date"] else None
                )
                db.add(db_set)
            db.commit()
            
            # 2. Restore Receipts to Supabase
            receipt_url_map = {}
            for name in namelist:
                if name.startswith("receipts/") and name != "receipts/":
                    receipt_content = zip_file.read(name)
                    filename = name.replace("receipts/", "")
                    new_url = upload_receipt_from_bytes(filename, receipt_content)
                    if new_url:
                        receipt_url_map[filename] = new_url
            
            # 3. Restore Sales
            sales_csv = zip_file.read("sales.csv").decode('utf-8')
            sales_reader = csv.DictReader(io.StringIO(sales_csv))
            for row in sales_reader:
                old_url = row.get("receipt_url", "")
                new_url = None
                if old_url:
                    filename = old_url.split("/")[-1]
                    new_url = receipt_url_map.get(filename, old_url)
                
                db_sale = models.Sale(
                    id=int(row["id"]),
                    lego_set_id=int(row["lego_set_id"]),
                    sell_price=float(row["sell_price"]),
                    sell_date=datetime.fromisoformat(row["sell_date"]) if row["sell_date"] else None,
                    platform=row["platform"] if row["platform"] else None,
                    receipt_url=new_url
                )
                db.add(db_sale)
                
            # 4. Restore Price History
            history_csv = zip_file.read("price_history.csv").decode('utf-8')
            history_reader = csv.DictReader(io.StringIO(history_csv))
            for row in history_reader:
                db_history = models.PriceHistory(
                    id=int(row["id"]),
                    lego_set_id=int(row["lego_set_id"]),
                    price=float(row["price"]),
                    recorded_at=datetime.fromisoformat(row["recorded_at"]) if row["recorded_at"] else None
                )
                db.add(db_history)
                
            db.commit()
            
            # Try to reset PostgreSQL sequences if applicable
            try:
                db.execute(text("SELECT setval('lego_sets_id_seq', COALESCE((SELECT MAX(id) FROM lego_sets), 1));"))
                db.execute(text("SELECT setval('sales_id_seq', COALESCE((SELECT MAX(id) FROM sales), 1));"))
                db.execute(text("SELECT setval('price_history_id_seq', COALESCE((SELECT MAX(id) FROM price_history), 1));"))
                db.commit()
            except:
                db.rollback()
            
        return {"message": "Copia de seguridad restaurada con éxito."}
    except Exception as e:
        db.rollback()
        print(f"Import error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
