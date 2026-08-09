import os
import sys
import json

BACKEND_DIR = os.path.join(os.path.dirname(__file__), "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from database import SessionLocal
import models

def print_sets():
    db = SessionLocal()
    try:
        sets = db.query(models.LegoSet).all()
        result = []
        for s in sets:
            result.append({
                "id": s.id,
                "product_id": s.product_id,
                "name": s.name,
                "status": s.status.value if s.status else None,
                "current_price": s.current_price,
                "used_price": s.current_used_price
            })
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    print_sets()
