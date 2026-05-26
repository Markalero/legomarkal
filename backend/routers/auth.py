from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os

router = APIRouter(
    prefix="/auth",
    tags=["auth"]
)

class LoginRequest(BaseModel):
    password: str

class LoginResponse(BaseModel):
    token: str

@router.post("/login", response_model=LoginResponse)
def login(request: LoginRequest):
    admin_password = os.getenv("ADMIN_PASSWORD")
    if not admin_password:
        admin_password = "admin"
        
    if request.password == admin_password:
        return {"token": "legomarkal_valid_token_xyz"}
    else:
        raise HTTPException(status_code=401, detail="Contraseña incorrecta")
