import os
import sys

# Ensure backend modules are available
BACKEND_DIR = os.path.join(os.path.dirname(__file__), "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from database import SessionLocal
import models

def reset():
    print("Conectando a la base de datos...")
    db = SessionLocal()
    try:
        # Borrar el histórico
        deleted = db.query(models.PriceHistory).delete()
        print(f"Borrados {deleted} registros de histórico de precios.")
        
        # Poner los precios actuales a None
        updated = db.query(models.LegoSet).update({
            models.LegoSet.current_price: None,
            models.LegoSet.current_used_price: None
        })
        print(f"Reseteados {updated} sets de Lego (precio actual a None).")
        
        db.commit()
        print("Reset completado con éxito.")
    except Exception as e:
        db.rollback()
        print(f"Error durante el reset: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    reset()
