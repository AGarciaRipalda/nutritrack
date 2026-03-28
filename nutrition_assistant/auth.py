"""
Autenticación y autorización para la API multi-usuario.

Proporciona:
  - Hashing de contraseñas con bcrypt
  - Creación y verificación de tokens JWT
  - Dependencia FastAPI `get_current_user` para inyectar el usuario autenticado
  - Funciones de registro y login contra PostgreSQL o JSON fallback
"""

import os
import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr

from data_dir import DATA_DIR

# ── Configuración ────────────────────────────────────────────────────────────

SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "metabolic-dev-secret-change-in-production")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = int(os.environ.get("JWT_EXPIRE_HOURS", "720"))  # 30 días por defecto

USERS_FILE = DATA_DIR / "users.json"

_bearer_scheme = HTTPBearer()


# ── Modelos Pydantic ─────────────────────────────────────────────────────────

class RegisterModel(BaseModel):
    email: str
    password: str
    name: str = "Usuario"


class LoginModel(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


# ── Helpers ──────────────────────────────────────────────────────────────────

def _use_db() -> bool:
    try:
        from database import is_db_available
        return is_db_available()
    except ImportError:
        return False


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


def _create_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def _decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")


# ── JSON fallback helpers ────────────────────────────────────────────────────

def _load_users_json() -> dict:
    if not os.path.exists(USERS_FILE):
        return {}
    with open(USERS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_users_json(users: dict) -> None:
    with open(USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, indent=2, ensure_ascii=False)


# ── Registro ─────────────────────────────────────────────────────────────────

def register_user(email: str, password: str, name: str = "Usuario") -> dict:
    """Crea un nuevo usuario. Devuelve el dict del usuario (sin password_hash)."""
    email = email.lower().strip()
    user_id = str(uuid.uuid4())
    password_hash = _hash_password(password)
    now = datetime.now(timezone.utc).isoformat()

    if _use_db():
        from database import fetchone, execute
        existing = fetchone("SELECT id FROM users WHERE email = %s", (email,))
        if existing:
            raise HTTPException(status_code=409, detail="Ya existe una cuenta con ese email")
        execute("""
            INSERT INTO users (id, email, password_hash, name, created_at)
            VALUES (%s, %s, %s, %s, NOW())
        """, (user_id, email, password_hash, name))
    else:
        users = _load_users_json()
        if any(u["email"] == email for u in users.values()):
            raise HTTPException(status_code=409, detail="Ya existe una cuenta con ese email")
        users[user_id] = {
            "id": user_id,
            "email": email,
            "password_hash": password_hash,
            "name": name,
            "created_at": now,
        }
        _save_users_json(users)

    return {"id": user_id, "email": email, "name": name}


# ── Login ────────────────────────────────────────────────────────────────────

def login_user(email: str, password: str) -> dict:
    """Autentica al usuario. Devuelve {user, access_token}."""
    email = email.lower().strip()

    if _use_db():
        from database import fetchone
        row = fetchone("SELECT id, email, password_hash, name FROM users WHERE email = %s", (email,))
        if not row or not _verify_password(password, row["password_hash"]):
            raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")
        user = {"id": row["id"], "email": row["email"], "name": row["name"]}
    else:
        users = _load_users_json()
        user_record = None
        for u in users.values():
            if u["email"] == email:
                user_record = u
                break
        if not user_record or not _verify_password(password, user_record["password_hash"]):
            raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")
        user = {"id": user_record["id"], "email": user_record["email"], "name": user_record["name"]}

    token = _create_token(user["id"], user["email"])
    return {"user": user, "access_token": token}


# ── Dependencia FastAPI ──────────────────────────────────────────────────────

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
) -> dict:
    """Dependencia que extrae y valida el usuario del token JWT.

    Devuelve: {"id": str, "email": str}
    """
    payload = _decode_token(credentials.credentials)
    user_id = payload.get("sub")
    email = payload.get("email")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token inválido: falta user ID")
    return {"id": user_id, "email": email}
