import uuid
from typing import Optional
from fastapi import UploadFile
from database import get_supabase_client
import datetime

BUCKET_NAME = "receipts"

def upload_receipt(file: UploadFile, base_name: str = None) -> Optional[str]:
    """
    Uploads a receipt to Supabase Storage and returns the public URL.
    If base_name is provided, names it as such. Handles collisions with _2, _3 etc.
    """
    try:
        supabase = get_supabase_client()
        
        file_ext = file.filename.split(".")[-1] if file.filename else "pdf"
        
        if base_name:
            # We must find the correct filename suffix if it exists
            # Supabase Storage list() lets us find files
            files_response = supabase.storage.from_(BUCKET_NAME).list()
            existing_names = [f["name"] for f in files_response] if files_response else []
            
            unique_filename = f"{base_name}.{file_ext}"
            counter = 2
            while unique_filename in existing_names:
                unique_filename = f"{base_name}_{counter}.{file_ext}"
                counter += 1
        else:
            unique_filename = f"{uuid.uuid4()}.{file_ext}"
        
        # Read file content
        file_content = file.file.read()
        
        # Upload to Supabase Storage
        supabase.storage.from_(BUCKET_NAME).upload(
            file=file_content,
            path=unique_filename,
            file_options={"content-type": file.content_type}
        )
        
        # Get public URL
        public_url = supabase.storage.from_(BUCKET_NAME).get_public_url(unique_filename)
        return public_url

        return public_url

    except Exception as e:
        print(f"Error uploading to Supabase: {e}")
        return None

def delete_receipt(public_url: str) -> bool:
    """
    Deletes a receipt from Supabase Storage using its public URL.
    """
    if not public_url:
        return False
        
    try:
        supabase = get_supabase_client()
        # The filename is the last part of the URL
        filename = public_url.split("/")[-1]
        
        supabase.storage.from_(BUCKET_NAME).remove([filename])
        return True
    except Exception as e:
        print(f"Error deleting from Supabase: {e}")
        return False
