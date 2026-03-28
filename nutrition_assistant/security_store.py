import hashlib
import json
import secrets
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from threading import Lock
from typing import Any

from data_dir import DATA_DIR

RATE_LIMITS_FILE = DATA_DIR / "rate_limits.json"
PASSWORD_RESET_FILE = DATA_DIR / "password_reset_tokens.json"
SECURITY_EVENTS_FILE = DATA_DIR / "security_events.jsonl"

_store_lock = Lock()


class RateLimitExceeded(Exception):
    pass


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    with open(path, "r", encoding="utf-8") as file:
        payload = json.load(file)
    return payload if isinstance(payload, dict) else {}


def _save_json(path: Path, payload: dict) -> None:
    with open(path, "w", encoding="utf-8") as file:
        json.dump(payload, file, indent=2, ensure_ascii=False)


def _hash_secret(secret: str) -> str:
    return hashlib.sha256(secret.encode("utf-8")).hexdigest()


def log_security_event(
    event_type: str,
    *,
    severity: str = "info",
    actor_user_id: str | None = None,
    actor_email: str | None = None,
    target_user_id: str | None = None,
    target_email: str | None = None,
    ip: str | None = None,
    details: dict[str, Any] | None = None,
) -> dict:
    entry = {
        "id": str(uuid.uuid4()),
        "timestamp": _now_utc().isoformat(),
        "event_type": event_type,
        "severity": severity,
        "actor_user_id": actor_user_id,
        "actor_email": actor_email,
        "target_user_id": target_user_id,
        "target_email": target_email,
        "ip": ip,
        "details": details or {},
    }

    with _store_lock:
        with open(SECURITY_EVENTS_FILE, "a", encoding="utf-8") as file:
            file.write(json.dumps(entry, ensure_ascii=False) + "\n")

    return entry


def list_security_events(limit: int = 200) -> list[dict]:
    if limit <= 0:
        return []
    if not SECURITY_EVENTS_FILE.exists():
        return []

    with _store_lock:
        with open(SECURITY_EVENTS_FILE, "r", encoding="utf-8") as file:
            lines = file.readlines()

    events: list[dict] = []
    for raw_line in reversed(lines[-limit:]):
        line = raw_line.strip()
        if not line:
            continue
        try:
            payload = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(payload, dict):
            events.append(payload)
    return events


def enforce_persistent_rate_limit(scope: str, key: str, limit: int, window_seconds: int) -> None:
    now = time.time()
    window_start = now - window_seconds
    bucket_key = f"{scope}:{key}"

    with _store_lock:
        store = _load_json(RATE_LIMITS_FILE)
        pruned_store: dict[str, list[float]] = {}

        for current_key, values in store.items():
            if not isinstance(values, list):
                continue
            filtered_values = [
                float(value)
                for value in values
                if isinstance(value, (int, float)) and float(value) > window_start
            ]
            if filtered_values:
                pruned_store[current_key] = filtered_values

        bucket = pruned_store.get(bucket_key, [])
        if len(bucket) >= limit:
            _save_json(RATE_LIMITS_FILE, pruned_store)
            raise RateLimitExceeded("Demasiados intentos. Inténtalo más tarde.")

        bucket.append(now)
        pruned_store[bucket_key] = bucket
        _save_json(RATE_LIMITS_FILE, pruned_store)


def issue_password_reset_token(
    user_id: str,
    *,
    expires_minutes: int = 60,
    created_by_user_id: str | None = None,
) -> dict:
    token = secrets.token_urlsafe(32)
    now = _now_utc()
    expires_at = (now + timedelta(minutes=expires_minutes)).isoformat()

    with _store_lock:
        store = _load_json(PASSWORD_RESET_FILE)
        active_tokens: dict[str, dict] = {}
        for token_id, record in store.items():
            if not isinstance(record, dict):
                continue
            record_expires_at = record.get("expires_at")
            try:
                expires_at_value = datetime.fromisoformat(record_expires_at)
            except (TypeError, ValueError):
                continue
            if expires_at_value.tzinfo is None:
                expires_at_value = expires_at_value.replace(tzinfo=timezone.utc)
            if expires_at_value <= now or record.get("user_id") == user_id:
                continue
            active_tokens[token_id] = record

        token_id = str(uuid.uuid4())
        active_tokens[token_id] = {
            "id": token_id,
            "user_id": user_id,
            "token_hash": _hash_secret(token),
            "created_at": now.isoformat(),
            "expires_at": expires_at,
            "created_by_user_id": created_by_user_id,
        }
        _save_json(PASSWORD_RESET_FILE, active_tokens)

    return {
        "token": token,
        "expires_at": expires_at,
    }


def consume_password_reset_token(token: str) -> dict | None:
    now = _now_utc()
    token_hash = _hash_secret(token)

    with _store_lock:
        store = _load_json(PASSWORD_RESET_FILE)
        active_tokens: dict[str, dict] = {}
        matched_record: dict | None = None

        for token_id, record in store.items():
            if not isinstance(record, dict):
                continue
            try:
                expires_at = datetime.fromisoformat(record.get("expires_at"))
            except (TypeError, ValueError):
                continue
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at <= now:
                continue
            if record.get("token_hash") == token_hash:
                matched_record = record
                continue
            active_tokens[token_id] = record

        _save_json(PASSWORD_RESET_FILE, active_tokens)
        return matched_record


def revoke_password_reset_tokens_for_user(user_id: str) -> None:
    with _store_lock:
        store = _load_json(PASSWORD_RESET_FILE)
        filtered = {
            token_id: record
            for token_id, record in store.items()
            if isinstance(record, dict) and record.get("user_id") != user_id
        }
        _save_json(PASSWORD_RESET_FILE, filtered)
