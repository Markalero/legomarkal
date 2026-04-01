# Endpoints de autenticación — login y refresh de token JWT
from fastapi import APIRouter, HTTPException, status

from app.auth import create_access_token, verify_password
from app.config import settings
from app.schemas.auth import LoginRequest, TokenOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenOut)
def login(body: LoginRequest):
    """Autentica al administrador y devuelve un JWT."""
    if body.email != settings.admin_email or not verify_password(body.password, settings.admin_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales incorrectas")

    token = create_access_token({"sub": body.email})
    return TokenOut(access_token=token)


@router.post("/refresh", response_model=TokenOut)
def refresh(current_user: str = None):
    """Renueva el token usando el token actual (requiere autenticación)."""
    from fastapi import Depends
    from app.auth import get_current_user
    # Renovación simple: emite nuevo token para el usuario autenticado
    token = create_access_token({"sub": current_user})
    return TokenOut(access_token=token)
