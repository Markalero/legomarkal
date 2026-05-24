import uuid
from typing import Optional
from fastapi import UploadFile
from database import get_supabase_client

BUCKET_NAME = "receipts"

def upload_receipt(file: UploadFile) -> Optional[str]:
    """
    Uploads a receipt to Supabase Storage and returns the public URL.
    """
    try:
        supabase = get_supabase_client()
        
        # Generate a unique filename
        file_ext = file.filename.split(".")[-1] if file.filename else "pdf"
        unique_filename = f"{uuid.uuid4()}.{file_ext}"
        
        # Read file content
        file_content = file.file.read()
        
        # Upload to Supabase Storage
        res = supabase.storage.from_(BUCKET_NAME).upload(
            file=file_content,
            path=unique_filename,
            file_options={"content-type": file.content_type}
        )
        
        # Get public URL
        public_url = supabase.storage.from_(BUCKET_NAME).get_public_url(unique_filename)
        return public_url

    except Exception as e:
        print(f"Error uploading to Supabase: {e}")
        return None
