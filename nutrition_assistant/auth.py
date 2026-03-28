"""
Autenticacion y autorizacion para la API multi-usuario.

Proporciona:
  - Hashing de contrasenas con bcrypt
  - Creacion y verificacion de tokens JWT
  - Dependencia FastAPI `get_current_user` para inyectar el usuario autenticado
  - Funciones de registro y login contra PostgreSQL o JSON fallback
"""

import json
import os
import secrets
import shutil
import uuid
import warnings
from datetime import datetime, timedelta, timezone
from typing import Literal

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from data_dir import DATA_DIR
from user_paths import get_user_data_dir, normalize_user_id

APP_ENV = os.environ.get("APP_ENV", os.environ.get("ENVIRONMENT", "development")).strip().lower()
IS_PRODUCTION = APP_ENV == "production"

_configured_secret = os.environ.get("JWT_SECRET_KEY", "").strip()
if IS_PRODUCTION and not _configured_secret:
    raise RuntimeError("JWT_SECRET_KEY must be set in production")

if _configured_secret:
    SECRET_KEY = _configured_secret
else:
    SECRET_KEY = secrets.token_urlsafe(64)
    warnings.warn(
        "JWT_SECRET_KEY is not set; using an ephemeral development secret",
        stacklevel=1,
    )

ALGORITHM = "HS256"
TOKEN_EXPIRE_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", "60"))
if TOKEN_EXPIRE_MINUTES <= 0:
    raise RuntimeError("JWT_EXPIRE_MINUTES must be greater than 0")

USERS_FILE = DATA_DIR / "users.json"
USER_ROLE_VALUES = {"user", "admin"}
DEFAULT_USER_ROLE = "user"

_db_role_column_available: bool | None = None

_bearer_scheme = HTTPBearer(auto_error=False)


class RegisterModel(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(default="Usuario", min_length=1, max_length=120)


class LoginModel(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class ManagedUserModel(BaseModel):
    id: str
    email: str
    name: str
    role: Literal["user", "admin"]
    created_at: str | None = None


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


def _normalize_email(email: str) -> str:
    value = email.strip().lower()
    if not value or "@" not in value:
        raise HTTPException(status_code=400, detail="Correo electrónico no válido")
    return value


def _normalize_role(role: str | None) -> Literal["user", "admin"]:
    value = (role or DEFAULT_USER_ROLE).strip().lower()
    if value not in USER_ROLE_VALUES:
        raise HTTPException(status_code=400, detail="Rol no válido")
    return value  # type: ignore[return-value]


def _db_has_role_column() -> bool:
    global _db_role_column_available

    if not _use_db():
        return False

    if _db_role_column_available is not None:
        return _db_role_column_available

    from database import fetchone

    row = fetchone(
        """
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'role'
        LIMIT 1
        """
    )
    _db_role_column_available = row is not None
    return _db_role_column_available


def _build_user_dict(
    *,
    user_id: str,
    email: str,
    name: str,
    role: str | None = None,
    created_at: str | None = None,
) -> dict:
    return {
        "id": normalize_user_id(user_id),
        "email": _normalize_email(email),
        "name": name or "Usuario",
        "role": _normalize_role(role),
        "created_at": created_at,
    }


def _create_token(user_id: str, email: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": normalize_user_id(user_id),
        "email": _normalize_email(email),
        "exp": now + timedelta(minutes=TOKEN_EXPIRE_MINUTES),
        "iat": now,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def _decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=401, detail="La sesión ha expirado") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail="El token no es válido") from exc

    if not payload.get("sub") or not payload.get("email"):
        raise HTTPException(status_code=401, detail="El token no es válido")
    return payload


def _load_users_json() -> dict:
    if not os.path.exists(USERS_FILE):
        return {}
    with open(USERS_FILE, "r", encoding="utf-8") as file:
        return json.load(file)


def _save_users_json(users: dict) -> None:
    with open(USERS_FILE, "w", encoding="utf-8") as file:
        json.dump(users, file, indent=2, ensure_ascii=False)


def _list_users_json() -> list[dict]:
    users = []
    for record in _load_users_json().values():
        users.append(
            _build_user_dict(
                user_id=record["id"],
                email=record["email"],
                name=record.get("name", "Usuario"),
                role=record.get("role"),
                created_at=record.get("created_at"),
            )
        )
    return users


def _count_admin_users() -> int:
    if _use_db():
        from database import fetchone

        if _db_has_role_column():
            row = fetchone("SELECT COUNT(*) AS total FROM users WHERE role = 'admin'")
            return int(row["total"]) if row else 0
        return 0

    return sum(1 for user in _list_users_json() if user["role"] == "admin")


def _get_user_by_id(user_id: str) -> dict | None:
    safe_user_id = normalize_user_id(user_id)

    if _use_db():
        from database import fetchone

        if _db_has_role_column():
            row = fetchone(
                "SELECT id, email, name, role, created_at FROM users WHERE id = %s LIMIT 1",
                (safe_user_id,),
            )
        else:
            row = fetchone(
                "SELECT id, email, name, created_at FROM users WHERE id = %s LIMIT 1",
                (safe_user_id,),
            )
        if not row:
            return None
        return _build_user_dict(
            user_id=row["id"],
            email=row["email"],
            name=row["name"],
            role=row.get("role"),
            created_at=row.get("created_at").isoformat() if row.get("created_at") else None,
        )

    user_record = _load_users_json().get(safe_user_id)
    if not user_record:
        return None

    return _build_user_dict(
        user_id=user_record["id"],
        email=user_record["email"],
        name=user_record.get("name", "Usuario"),
        role=user_record.get("role"),
        created_at=user_record.get("created_at"),
    )


def register_user(
    email: str,
    password: str,
    name: str = "Usuario",
    role: str = DEFAULT_USER_ROLE,
) -> dict:
    email = _normalize_email(email)
    role = _normalize_role(role)
    user_id = str(uuid.uuid4())
    password_hash = _hash_password(password)
    now = datetime.now(timezone.utc).isoformat()

    if _use_db():
        from database import execute, fetchone

        existing = fetchone("SELECT id FROM users WHERE email = %s", (email,))
        if existing:
            raise HTTPException(status_code=409, detail="Ya existe una cuenta con ese email")
        if _db_has_role_column():
            execute(
                """
                INSERT INTO users (id, email, password_hash, name, role, created_at)
                VALUES (%s, %s, %s, %s, %s, NOW())
                """,
                (user_id, email, password_hash, name, role),
            )
        else:
            if role != DEFAULT_USER_ROLE:
                raise HTTPException(
                    status_code=500,
                    detail="La base de datos actual no soporta roles de usuario",
                )
            execute(
                """
                INSERT INTO users (id, email, password_hash, name, created_at)
                VALUES (%s, %s, %s, %s, NOW())
                """,
                (user_id, email, password_hash, name),
            )
    else:
        users = _load_users_json()
        if any(user["email"] == email for user in users.values()):
            raise HTTPException(status_code=409, detail="Ya existe una cuenta con ese email")
        users[user_id] = {
            "id": user_id,
            "email": email,
            "password_hash": password_hash,
            "name": name,
            "role": role,
            "created_at": now,
        }
        _save_users_json(users)

    return _build_user_dict(
        user_id=user_id,
        email=email,
        name=name,
        role=role,
        created_at=now,
    )


def login_user(email: str, password: str) -> dict:
    email = _normalize_email(email)

    if _use_db():
        from database import fetchone

        if _db_has_role_column():
            row = fetchone(
                "SELECT id, email, password_hash, name, role, created_at FROM users WHERE email = %s",
                (email,),
            )
        else:
            row = fetchone(
                "SELECT id, email, password_hash, name, created_at FROM users WHERE email = %s",
                (email,),
            )
        if not row or not _verify_password(password, row["password_hash"]):
            raise HTTPException(
                status_code=401,
                detail="Correo electrónico o contraseña incorrectos",
            )
        user = _build_user_dict(
            user_id=row["id"],
            email=row["email"],
            name=row["name"],
            role=row.get("role"),
            created_at=row.get("created_at").isoformat() if row.get("created_at") else None,
        )
    else:
        user_record = None
        for record in _load_users_json().values():
            if record["email"] == email:
                user_record = record
                break

        if not user_record or not _verify_password(password, user_record["password_hash"]):
            raise HTTPException(
                status_code=401,
                detail="Correo electrónico o contraseña incorrectos",
            )

        user = _build_user_dict(
            user_id=user_record["id"],
            email=user_record["email"],
            name=user_record["name"],
            role=user_record.get("role"),
            created_at=user_record.get("created_at"),
        )

    token = _create_token(user["id"], user["email"])
    return {"user": user, "access_token": token}


def list_users() -> list[dict]:
    if _use_db():
        from database import fetchall

        if _db_has_role_column():
            rows = fetchall(
                """
                SELECT id, email, name, role, created_at
                FROM users
                ORDER BY CASE WHEN role = 'admin' THEN 0 ELSE 1 END, created_at, email
                """
            )
        else:
            rows = fetchall(
                """
                SELECT id, email, name, created_at
                FROM users
                ORDER BY created_at, email
                """
            )

        return [
            _build_user_dict(
                user_id=row["id"],
                email=row["email"],
                name=row["name"],
                role=row.get("role"),
                created_at=row.get("created_at").isoformat() if row.get("created_at") else None,
            )
            for row in rows
        ]

    return sorted(
        _list_users_json(),
        key=lambda user: (
            0 if user["role"] == "admin" else 1,
            user.get("created_at") or "",
            user["email"],
        ),
    )


def update_user_role(user_id: str, role: str, acting_user_id: str) -> dict:
    safe_user_id = normalize_user_id(user_id)
    safe_acting_user_id = normalize_user_id(acting_user_id)
    normalized_role = _normalize_role(role)
    target = _get_user_by_id(safe_user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if target["role"] == "admin" and normalized_role != "admin":
        if _count_admin_users() <= 1:
            raise HTTPException(
                status_code=400,
                detail="No puedes degradar al último administrador",
            )

    if _use_db():
        if not _db_has_role_column():
            raise HTTPException(
                status_code=500,
                detail="La base de datos actual no soporta roles de usuario",
            )
        from database import execute

        execute(
            "UPDATE users SET role = %s, updated_at = NOW() WHERE id = %s",
            (normalized_role, safe_user_id),
        )
        return _get_user_by_id(safe_user_id)  # type: ignore[return-value]

    users = _load_users_json()
    record = users.get(safe_user_id)
    if not record:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if safe_user_id == safe_acting_user_id and record.get("role", DEFAULT_USER_ROLE) == "admin" and normalized_role != "admin":
        raise HTTPException(
            status_code=400,
            detail="No puedes quitarte tu propio acceso de administrador",
        )
    record["role"] = normalized_role
    users[safe_user_id] = record
    _save_users_json(users)
    return _get_user_by_id(safe_user_id)  # type: ignore[return-value]


def delete_user(user_id: str, acting_user_id: str) -> None:
    safe_user_id = normalize_user_id(user_id)
    safe_acting_user_id = normalize_user_id(acting_user_id)
    target = _get_user_by_id(safe_user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if safe_user_id == safe_acting_user_id:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propia cuenta")

    if target["role"] == "admin" and _count_admin_users() <= 1:
        raise HTTPException(
            status_code=400,
            detail="No puedes eliminar al último administrador",
        )

    if _use_db():
        from database import get_cursor
        from psycopg2 import sql

        with get_cursor(commit=True) as cur:
            cur.execute(
                """
                SELECT table_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND column_name = 'user_id'
                  AND table_name <> 'users'
                ORDER BY table_name
                """
            )
            tables = [row[0] for row in cur.fetchall()]
            for table_name in tables:
                cur.execute(
                    sql.SQL("DELETE FROM {} WHERE user_id = %s").format(sql.Identifier(table_name)),
                    (safe_user_id,),
                )
            cur.execute("DELETE FROM users WHERE id = %s", (safe_user_id,))
        return

    users = _load_users_json()
    users.pop(safe_user_id, None)
    _save_users_json(users)
    user_dir = get_user_data_dir(safe_user_id, default_dir=DATA_DIR)
    if user_dir.exists():
        shutil.rmtree(user_dir, ignore_errors=True)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> dict:
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=401,
            detail="Falta el token de autenticación",
        )

    payload = _decode_token(credentials.credentials)
    try:
        user_id = normalize_user_id(payload["sub"])
        email = _normalize_email(payload["email"])
    except (ValueError, HTTPException) as exc:
        raise HTTPException(status_code=401, detail="El token no es válido") from exc

    user = _get_user_by_id(user_id)
    if not user or _normalize_email(user["email"]) != email:
        raise HTTPException(status_code=401, detail="El token no es válido")

    return user


def get_current_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Acceso solo para administradores")
    return user
