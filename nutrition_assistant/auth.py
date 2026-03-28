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
import hashlib
import secrets
import shutil
import uuid
import warnings
from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Literal

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from data_dir import DATA_DIR
from security_store import (
    consume_password_reset_token,
    issue_password_reset_token,
    log_security_event,
    revoke_password_reset_tokens_for_user,
)
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
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", "60"))
if ACCESS_TOKEN_EXPIRE_MINUTES <= 0:
    raise RuntimeError("JWT_EXPIRE_MINUTES must be greater than 0")
REFRESH_TOKEN_EXPIRE_DAYS = int(os.environ.get("JWT_REFRESH_EXPIRE_DAYS", "30"))
if REFRESH_TOKEN_EXPIRE_DAYS <= 0:
    raise RuntimeError("JWT_REFRESH_EXPIRE_DAYS must be greater than 0")

USERS_FILE = DATA_DIR / "users.json"
SESSIONS_FILE = DATA_DIR / "auth_sessions.json"
USER_ROLE_VALUES = {"user", "admin"}
DEFAULT_USER_ROLE = "user"

_db_role_column_available: bool | None = None
_session_store_lock = Lock()

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
    refresh_token: str
    token_type: str = "bearer"
    access_expires_at: str
    refresh_expires_at: str
    user: dict


class RefreshTokenModel(BaseModel):
    refresh_token: str = Field(min_length=32, max_length=512)


class LogoutModel(BaseModel):
    refresh_token: str | None = Field(default=None, max_length=512)


class ChangePasswordModel(BaseModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class PasswordResetRequestModel(BaseModel):
    email: str


class PasswordResetConfirmModel(BaseModel):
    token: str = Field(min_length=16, max_length=512)
    new_password: str = Field(min_length=8, max_length=128)


class PasswordResetLinkResponse(BaseModel):
    reset_token: str
    reset_url: str
    expires_at: str


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


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _parse_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _load_sessions_json() -> dict:
    if not SESSIONS_FILE.exists():
        return {}
    with open(SESSIONS_FILE, "r", encoding="utf-8") as file:
        payload = json.load(file)
    return payload if isinstance(payload, dict) else {}


def _save_sessions_json(sessions: dict) -> None:
    with open(SESSIONS_FILE, "w", encoding="utf-8") as file:
        json.dump(sessions, file, indent=2, ensure_ascii=False)


def _filter_active_sessions(sessions: dict) -> dict:
    now = _now_utc()
    active_sessions: dict[str, dict] = {}
    for session_id, record in sessions.items():
        if not isinstance(record, dict):
            continue
        refresh_expires_at = _parse_timestamp(record.get("refresh_expires_at"))
        if not refresh_expires_at or refresh_expires_at <= now:
            continue
        active_sessions[session_id] = record
    return active_sessions


def _load_active_sessions() -> dict:
    sessions = _load_sessions_json()
    active_sessions = _filter_active_sessions(sessions)
    if active_sessions != sessions:
        _save_sessions_json(active_sessions)
    return active_sessions


def _issue_access_token(user_id: str, email: str, session_id: str) -> tuple[str, str, str]:
    now = _now_utc()
    access_jti = uuid.uuid4().hex
    expires_at = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": normalize_user_id(user_id),
        "email": _normalize_email(email),
        "sid": session_id,
        "jti": access_jti,
        "type": "access",
        "exp": expires_at,
        "iat": now,
    }
    return (
        jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM),
        expires_at.isoformat(),
        access_jti,
    )


def _decode_token(token: str, *, verify_exp: bool = True) -> dict:
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
            options={"verify_exp": verify_exp},
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=401, detail="La sesión ha expirado") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail="El token no es válido") from exc

    if (
        not payload.get("sub")
        or not payload.get("email")
        or not payload.get("sid")
        or not payload.get("jti")
        or payload.get("type") != "access"
    ):
        raise HTTPException(status_code=401, detail="El token no es válido")
    return payload


def _find_session_by_refresh_token(
    sessions: dict,
    refresh_token: str,
) -> tuple[str, dict] | tuple[None, None]:
    refresh_token_hash = _hash_token(refresh_token)
    for session_id, record in sessions.items():
        if record.get("refresh_token_hash") == refresh_token_hash:
            return session_id, record
    return None, None


def _get_session_by_id(session_id: str) -> dict | None:
    with _session_store_lock:
        sessions = _load_active_sessions()
        return sessions.get(session_id)


def _create_session_tokens(user: dict, session_id: str | None = None) -> dict:
    safe_user_id = normalize_user_id(user["id"])
    safe_email = _normalize_email(user["email"])
    effective_session_id = session_id or str(uuid.uuid4())
    refresh_token = secrets.token_urlsafe(48)
    now = _now_utc()
    refresh_expires_at = (now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)).isoformat()
    access_token, access_expires_at, access_jti = _issue_access_token(
        safe_user_id,
        safe_email,
        effective_session_id,
    )

    with _session_store_lock:
        sessions = _load_active_sessions()
        existing_session = sessions.get(effective_session_id, {})
        sessions[effective_session_id] = {
            "id": effective_session_id,
            "user_id": safe_user_id,
            "email": safe_email,
            "refresh_token_hash": _hash_token(refresh_token),
            "refresh_expires_at": refresh_expires_at,
            "access_jti": access_jti,
            "access_expires_at": access_expires_at,
            "created_at": existing_session.get("created_at", now.isoformat()),
            "last_refreshed_at": now.isoformat(),
        }
        _save_sessions_json(sessions)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "access_expires_at": access_expires_at,
        "refresh_expires_at": refresh_expires_at,
        "user": user,
    }


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


def _get_user_auth_record_by_email(email: str) -> dict | None:
    safe_email = _normalize_email(email)

    if _use_db():
        from database import fetchone

        if _db_has_role_column():
            row = fetchone(
                """
                SELECT id, email, password_hash, name, role, created_at
                FROM users
                WHERE email = %s
                LIMIT 1
                """,
                (safe_email,),
            )
        else:
            row = fetchone(
                """
                SELECT id, email, password_hash, name, created_at
                FROM users
                WHERE email = %s
                LIMIT 1
                """,
                (safe_email,),
            )
        if not row:
            return None
        return {
            "user": _build_user_dict(
                user_id=row["id"],
                email=row["email"],
                name=row["name"],
                role=row.get("role"),
                created_at=row.get("created_at").isoformat() if row.get("created_at") else None,
            ),
            "password_hash": row["password_hash"],
        }

    for record in _load_users_json().values():
        if record["email"] == safe_email:
            return {
                "user": _build_user_dict(
                    user_id=record["id"],
                    email=record["email"],
                    name=record.get("name", "Usuario"),
                    role=record.get("role"),
                    created_at=record.get("created_at"),
                ),
                "password_hash": record["password_hash"],
            }
    return None


def _get_user_auth_record_by_id(user_id: str) -> dict | None:
    safe_user_id = normalize_user_id(user_id)

    if _use_db():
        from database import fetchone

        if _db_has_role_column():
            row = fetchone(
                """
                SELECT id, email, password_hash, name, role, created_at
                FROM users
                WHERE id = %s
                LIMIT 1
                """,
                (safe_user_id,),
            )
        else:
            row = fetchone(
                """
                SELECT id, email, password_hash, name, created_at
                FROM users
                WHERE id = %s
                LIMIT 1
                """,
                (safe_user_id,),
            )
        if not row:
            return None
        return {
            "user": _build_user_dict(
                user_id=row["id"],
                email=row["email"],
                name=row["name"],
                role=row.get("role"),
                created_at=row.get("created_at").isoformat() if row.get("created_at") else None,
            ),
            "password_hash": row["password_hash"],
        }

    record = _load_users_json().get(safe_user_id)
    if not record:
        return None

    return {
        "user": _build_user_dict(
            user_id=record["id"],
            email=record["email"],
            name=record.get("name", "Usuario"),
            role=record.get("role"),
            created_at=record.get("created_at"),
        ),
        "password_hash": record["password_hash"],
    }


def _set_password_hash(user_id: str, password_hash: str) -> None:
    safe_user_id = normalize_user_id(user_id)

    if _use_db():
        from database import execute

        execute("UPDATE users SET password_hash = %s WHERE id = %s", (password_hash, safe_user_id))
        return

    users = _load_users_json()
    record = users.get(safe_user_id)
    if not record:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    record["password_hash"] = password_hash
    users[safe_user_id] = record
    _save_users_json(users)


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
    auth_record = _get_user_auth_record_by_email(email)
    if not auth_record or not _verify_password(password, auth_record["password_hash"]):
        raise HTTPException(
            status_code=401,
            detail="Correo electrónico o contraseña incorrectos",
        )

    return _create_session_tokens(auth_record["user"])


def refresh_session(refresh_token: str) -> dict:
    if not refresh_token or not refresh_token.strip():
        raise HTTPException(status_code=401, detail="El refresh token no es válido")

    with _session_store_lock:
        sessions = _load_active_sessions()
        session_id, session_record = _find_session_by_refresh_token(sessions, refresh_token.strip())
        if not session_id or not session_record:
            raise HTTPException(status_code=401, detail="El refresh token no es válido")

        user = _get_user_by_id(session_record.get("user_id", ""))
        if not user:
            sessions.pop(session_id, None)
            _save_sessions_json(sessions)
            raise HTTPException(status_code=401, detail="La sesión ya no es válida")

    return _create_session_tokens(user, session_id=session_id)


def revoke_session(*, access_token: str | None = None, refresh_token: str | None = None) -> None:
    if not access_token and not refresh_token:
        return

    with _session_store_lock:
        sessions = _load_active_sessions()

        if refresh_token:
            session_id, _record = _find_session_by_refresh_token(sessions, refresh_token.strip())
            if session_id:
                sessions.pop(session_id, None)

        if access_token:
            try:
                payload = _decode_token(access_token, verify_exp=False)
            except HTTPException:
                payload = None
            if payload:
                sessions.pop(str(payload.get("sid", "")).strip(), None)

        _save_sessions_json(sessions)


def revoke_user_sessions(user_id: str) -> None:
    safe_user_id = normalize_user_id(user_id)
    with _session_store_lock:
        sessions = _load_active_sessions()
        for session_id in [
            current_session_id
            for current_session_id, record in sessions.items()
            if record.get("user_id") == safe_user_id
        ]:
            sessions.pop(session_id, None)
        _save_sessions_json(sessions)


def change_password(user_id: str, current_password: str, new_password: str) -> dict:
    auth_record = _get_user_auth_record_by_id(user_id)
    if not auth_record or not _verify_password(current_password, auth_record["password_hash"]):
        raise HTTPException(status_code=401, detail="La contraseña actual no es correcta")

    new_password_hash = _hash_password(new_password)
    _set_password_hash(auth_record["user"]["id"], new_password_hash)
    revoke_user_sessions(auth_record["user"]["id"])
    revoke_password_reset_tokens_for_user(auth_record["user"]["id"])
    log_security_event(
        "auth.password_changed",
        actor_user_id=auth_record["user"]["id"],
        actor_email=auth_record["user"]["email"],
        target_user_id=auth_record["user"]["id"],
        target_email=auth_record["user"]["email"],
    )
    return _create_session_tokens(auth_record["user"])


def request_password_reset(email: str) -> None:
    safe_email = _normalize_email(email)
    auth_record = _get_user_auth_record_by_email(safe_email)
    if auth_record:
        log_security_event(
            "auth.password_reset_requested",
            actor_email=safe_email,
            target_user_id=auth_record["user"]["id"],
            target_email=auth_record["user"]["email"],
        )


def create_password_reset_link(
    user_id: str,
    *,
    requested_by_user_id: str | None = None,
    frontend_base_url: str,
) -> dict:
    auth_record = _get_user_auth_record_by_id(user_id)
    if not auth_record:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    token_data = issue_password_reset_token(
        auth_record["user"]["id"],
        created_by_user_id=requested_by_user_id,
    )
    reset_url = f"{frontend_base_url.rstrip('/')}/reset-password?token={token_data['token']}"
    log_security_event(
        "auth.password_reset_link_created",
        actor_user_id=requested_by_user_id,
        target_user_id=auth_record["user"]["id"],
        target_email=auth_record["user"]["email"],
        details={"expires_at": token_data["expires_at"]},
    )
    return {
        "reset_token": token_data["token"],
        "reset_url": reset_url,
        "expires_at": token_data["expires_at"],
    }


def confirm_password_reset(token: str, new_password: str) -> dict:
    if not token or not token.strip():
        raise HTTPException(status_code=400, detail="El token de reseteo no es válido")

    reset_record = consume_password_reset_token(token.strip())
    if not reset_record:
        raise HTTPException(status_code=400, detail="El enlace de reseteo no es válido o ha expirado")

    auth_record = _get_user_auth_record_by_id(reset_record["user_id"])
    if not auth_record:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    new_password_hash = _hash_password(new_password)
    _set_password_hash(auth_record["user"]["id"], new_password_hash)
    revoke_user_sessions(auth_record["user"]["id"])
    revoke_password_reset_tokens_for_user(auth_record["user"]["id"])
    log_security_event(
        "auth.password_reset_confirmed",
        target_user_id=auth_record["user"]["id"],
        target_email=auth_record["user"]["email"],
    )
    return _create_session_tokens(auth_record["user"])


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

    revoke_user_sessions(safe_user_id)

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
        session_id = str(payload["sid"]).strip()
        access_jti = str(payload["jti"]).strip()
    except (ValueError, HTTPException) as exc:
        raise HTTPException(status_code=401, detail="El token no es válido") from exc

    session = _get_session_by_id(session_id)
    if (
        not session
        or session.get("user_id") != user_id
        or session.get("access_jti") != access_jti
    ):
        raise HTTPException(status_code=401, detail="La sesión ya no es válida")

    user = _get_user_by_id(user_id)
    if not user or _normalize_email(user["email"]) != email:
        raise HTTPException(status_code=401, detail="El token no es válido")

    return user


def get_current_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Acceso solo para administradores")
    return user
