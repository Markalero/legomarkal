# Servicio de almacenamiento de recibos PDF en sistema de ficheros local
import uuid
from datetime import datetime, timezone
from pathlib import Path


class StorageService:
    """Gestiona ficheros de recibos PDF en el sistema de ficheros local.

    Almacena los PDFs bajo uploads/receipts/{product_id}/{receipt_id}_{filename}
    y los sirve a través del montaje estático /uploads del servidor FastAPI.
    Este enfoque es consistente con el almacenamiento de imágenes de producto
    y elimina la dependencia de servicios externos de almacenamiento en la nube.
    """

    def __init__(self) -> None:
        self._base_dir = Path(__file__).resolve().parents[2] / "uploads" / "receipts"
        self._base_dir.mkdir(parents=True, exist_ok=True)

    def upload_receipt(
        self,
        product_id: str,
        file_bytes: bytes,
        filename: str,
        content_type: str,
    ) -> dict:
        """Guarda el PDF en disco y devuelve los metadatos para persistir en JSONB."""
        receipt_id = str(uuid.uuid4())
        safe_filename = f"{receipt_id}_{filename}"
        product_dir = self._base_dir / product_id
        product_dir.mkdir(parents=True, exist_ok=True)
        (product_dir / safe_filename).write_bytes(file_bytes)
        return {
            "id": receipt_id,
            "filename": filename,
            # Ruta relativa bajo uploads/receipts/ — usada para localizar el fichero
            "storage_path": f"{product_id}/{safe_filename}",
            "uploaded_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        }

    def delete_receipt(self, storage_path: str) -> None:
        """Borra el fichero del disco. No lanza excepción si ya no existe."""
        try:
            (self._base_dir / storage_path).unlink(missing_ok=True)
        except Exception:
            pass

    def get_local_path(self, storage_path: str) -> Path:
        """Devuelve la ruta absoluta del fichero en disco."""
        return self._base_dir / storage_path
