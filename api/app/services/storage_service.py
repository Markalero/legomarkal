# Servicio de almacenamiento de recibos PDF en Supabase Storage
import uuid
from datetime import datetime, timezone

from supabase import create_client, Client


class StorageService:
    """Gestiona ficheros de recibos de venta en el bucket 'receipts' (privado) de Supabase.

    Usa la Service Role Key para operar sobre un bucket privado desde el backend.
    Las URLs de descarga son firmadas con TTL de 1 hora y se generan bajo demanda.
    """

    BUCKET = "receipts"

    def __init__(self) -> None:
        from app.config import settings
        self._client: Client = create_client(settings.supabase_url, settings.supabase_service_key)

    def upload_receipt(
        self,
        product_id: str,
        file_bytes: bytes,
        filename: str,
        content_type: str,
    ) -> dict:
        """Sube un PDF al bucket y devuelve los metadatos para persistir en JSONB."""
        receipt_id = str(uuid.uuid4())
        storage_path = f"{product_id}/{receipt_id}_{filename}"
        self._client.storage.from_(self.BUCKET).upload(
            storage_path,
            file_bytes,
            {"content-type": content_type, "upsert": "false"},
        )
        return {
            "id": receipt_id,
            "filename": filename,
            "storage_path": storage_path,
            "uploaded_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        }

    def delete_receipt(self, storage_path: str) -> None:
        """Borra el fichero del bucket. No lanza excepción si ya no existe."""
        try:
            self._client.storage.from_(self.BUCKET).remove([storage_path])
        except Exception:
            pass

    def get_signed_url(self, storage_path: str, expires_in: int = 3600) -> str:
        """Genera y devuelve una URL firmada válida durante `expires_in` segundos."""
        response = self._client.storage.from_(self.BUCKET).create_signed_url(
            storage_path, expires_in
        )
        # supabase-py v2: el objeto devuelto tiene atributo .signed_url
        return response.signed_url
