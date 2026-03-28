import uuid
from pathlib import Path

from data_dir import DATA_DIR


def normalize_user_id(user_id: str) -> str:
    value = str(user_id).strip()
    if not value:
        raise ValueError("User ID is required")

    try:
        return str(uuid.UUID(value))
    except (ValueError, TypeError) as exc:
        raise ValueError("Invalid user ID format") from exc


def get_user_data_dir(user_id: str | None, default_dir: Path | None = None) -> Path:
    if not user_id:
        return default_dir or DATA_DIR

    base_dir = DATA_DIR.resolve()
    safe_user_id = normalize_user_id(user_id)
    user_dir = (base_dir / safe_user_id).resolve()
    if user_dir.parent != base_dir:
        raise ValueError("Invalid user data path")

    user_dir.mkdir(parents=True, exist_ok=True)
    return user_dir
