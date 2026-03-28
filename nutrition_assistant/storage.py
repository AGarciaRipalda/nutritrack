"""
Almacenamiento del perfil y la sesión del usuario.

Estrategia dual:
  - Si DATABASE_URL está configurada → PostgreSQL (producción)
  - Si no → archivos JSON en DATA_DIR (desarrollo local)

Soporte multi-usuario: todas las funciones aceptan un parámetro user_id.
  - En DB: filtra por user_id
  - En JSON: usa subdirectorio DATA_DIR/<user_id>/
"""

import json
import os
from datetime import date
from pathlib import Path
from data_dir import DATA_DIR

PROFILE_FILE = DATA_DIR / "user_profile.json"
SESSION_FILE = DATA_DIR / "session.json"

DEFAULT_PROFILE = {
    "name": "Usuario",
    "gender": "male",
    "age": 36,
    "height_cm": 170,
    "weight_kg": 80.0,
    "activity_level": 1,
    "goal": "maintain",
    "week_start_day": 0,
    "meal_count": 5
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _use_db():
    """True si PostgreSQL está disponible."""
    try:
        from database import is_db_available
        return is_db_available()
    except ImportError:
        return False


def _user_dir(user_id: str | None) -> Path:
    """Devuelve el directorio de datos del usuario (para JSON fallback)."""
    if user_id:
        d = DATA_DIR / user_id
        d.mkdir(parents=True, exist_ok=True)
        return d
    return DATA_DIR


def _profile_file(user_id: str | None) -> Path:
    return _user_dir(user_id) / "user_profile.json"


def _session_file(user_id: str | None) -> Path:
    return _user_dir(user_id) / "session.json"


def _today() -> str:
    return date.today().isoformat()


def _this_week() -> str:
    return date.today().strftime("%G-W%V")


# ══════════════════════════════════════════════════════════════════════════════
# PERFIL
# ══════════════════════════════════════════════════════════════════════════════

def load_profile(user_id: str | None = None) -> dict:
    if _use_db():
        from database import fetchone
        if user_id:
            row = fetchone("SELECT * FROM user_profiles WHERE user_id = %s LIMIT 1", (user_id,))
        else:
            row = fetchone("SELECT * FROM user_profiles ORDER BY id LIMIT 1")
        if row:
            return {
                "name": row["name"],
                "gender": row["gender"],
                "age": row["age"],
                "height_cm": row["height_cm"],
                "weight_kg": float(row["weight_kg"]),
                "activity_level": row["activity_level"],
                "goal": row["goal"],
                "week_start_day": row["week_start_day"],
                "meal_count": row.get("meal_count", 5),
            }

    # Fallback: JSON
    pf = _profile_file(user_id)
    if os.path.exists(pf):
        with open(pf, "r", encoding="utf-8") as f:
            return json.load(f)
    return DEFAULT_PROFILE.copy()


def save_profile(profile: dict, user_id: str | None = None) -> None:
    if _use_db():
        from database import fetchone, execute
        if user_id:
            row = fetchone("SELECT id FROM user_profiles WHERE user_id = %s LIMIT 1", (user_id,))
        else:
            row = fetchone("SELECT id FROM user_profiles ORDER BY id LIMIT 1")
        if row:
            execute("""
                UPDATE user_profiles SET
                    name=%(name)s, gender=%(gender)s, age=%(age)s,
                    height_cm=%(height_cm)s, weight_kg=%(weight_kg)s,
                    activity_level=%(activity_level)s, goal=%(goal)s,
                    week_start_day=%(week_start_day)s, meal_count=%(meal_count)s,
                    updated_at=NOW()
                WHERE id=%(id)s
            """, {**profile, "id": row["id"]})
        else:
            params = {**profile}
            if user_id:
                execute("""
                    INSERT INTO user_profiles (name, gender, age, height_cm, weight_kg,
                                               activity_level, goal, week_start_day, meal_count, user_id)
                    VALUES (%(name)s, %(gender)s, %(age)s, %(height_cm)s, %(weight_kg)s,
                            %(activity_level)s, %(goal)s, %(week_start_day)s, %(meal_count)s, %(user_id)s)
                """, {**params, "user_id": user_id})
            else:
                execute("""
                    INSERT INTO user_profiles (name, gender, age, height_cm, weight_kg,
                                               activity_level, goal, week_start_day, meal_count)
                    VALUES (%(name)s, %(gender)s, %(age)s, %(height_cm)s, %(weight_kg)s,
                            %(activity_level)s, %(goal)s, %(week_start_day)s, %(meal_count)s)
                """, params)
    else:
        pf = _profile_file(user_id)
        with open(pf, "w", encoding="utf-8") as f:
            json.dump(profile, f, indent=2, ensure_ascii=False)

    print(f"  Perfil guardado.", flush=True)


# ══════════════════════════════════════════════════════════════════════════════
# SESIÓN
# ══════════════════════════════════════════════════════════════════════════════

def load_session(user_id: str | None = None) -> dict:
    """
    Carga la sesión persistida.
    Devuelve un dict con:
      - exercise_data   (solo si es del día de hoy)
      - adaptive_day    (solo si es del día de hoy)
      - week_plan       (solo si es de la semana actual)
    """
    result = {
        "exercise_data": None,
        "adaptive_day": None,
        "week_plan": None,
        "today_training": None,
        "exercise_adj": {},
        "weekly_history": [],
    }

    if _use_db():
        from database import fetchone
        if user_id:
            row = fetchone("SELECT * FROM sessions WHERE user_id = %s ORDER BY id DESC LIMIT 1", (user_id,))
        else:
            row = fetchone("SELECT * FROM sessions ORDER BY id DESC LIMIT 1")
        if row:
            today = _today()
            week = _this_week()
            if str(row.get("saved_date", "")) == today:
                result["exercise_data"] = row.get("exercise_data")
                result["adaptive_day"] = row.get("adaptive_day")
                result["today_training"] = row.get("today_training")
            if str(row.get("saved_week", "")) == week:
                result["week_plan"] = row.get("week_plan")
            result["exercise_adj"] = row.get("exercise_adj") or {}
            result["weekly_history"] = row.get("weekly_history") or []
        return result

    # Fallback: JSON
    sf = _session_file(user_id)
    if not os.path.exists(sf):
        return result

    with open(sf, "r", encoding="utf-8") as f:
        session = json.load(f)

    today = _today()
    week = _this_week()

    if session.get("saved_date") == today:
        result["exercise_data"] = session.get("exercise_data")
        result["adaptive_day"] = session.get("adaptive_day")
        result["today_training"] = session.get("today_training")

    if session.get("saved_week") == week:
        result["week_plan"] = session.get("week_plan")

    result["exercise_adj"] = session.get("exercise_adj", {})
    result["weekly_history"] = session.get("weekly_history", [])

    return result


_MISSING = object()


def save_session(exercise_data=_MISSING,
                 adaptive_day=_MISSING,
                 week_plan=_MISSING,
                 today_training=_MISSING,
                 exercise_adj=_MISSING,
                 weekly_history=_MISSING,
                 user_id: str | None = None) -> None:
    """
    Persiste el estado de la sesión actual.
    Solo actualiza los campos que se pasen explícitamente.
    """
    if _use_db():
        from database import fetchone, execute, get_cursor
        from psycopg2.extras import Json

        if user_id:
            row = fetchone("SELECT id FROM sessions WHERE user_id = %s ORDER BY id DESC LIMIT 1", (user_id,))
        else:
            row = fetchone("SELECT id FROM sessions ORDER BY id DESC LIMIT 1")
        today = _today()
        week = _this_week()

        fields_to_update = {}
        for key, value in [("exercise_data", exercise_data),
                           ("adaptive_day", adaptive_day),
                           ("today_training", today_training),
                           ("week_plan", week_plan),
                           ("exercise_adj", exercise_adj),
                           ("weekly_history", weekly_history)]:
            if value is _MISSING:
                continue
            fields_to_update[key] = Json(value)

        if row:
            if fields_to_update:
                set_clause = ", ".join(f"{k} = %({k})s" for k in fields_to_update)
                fields_to_update["id"] = row["id"]
                fields_to_update["saved_date"] = today
                fields_to_update["saved_week"] = week
                execute(
                    f"UPDATE sessions SET saved_date=%(saved_date)s, saved_week=%(saved_week)s, "
                    f"{set_clause}, updated_at=NOW() WHERE id=%(id)s",
                    fields_to_update
                )
        else:
            cols = ["saved_date", "saved_week"] + list(fields_to_update.keys())
            vals = {**fields_to_update, "saved_date": today, "saved_week": week}
            if user_id:
                cols.append("user_id")
                vals["user_id"] = user_id
            placeholders = ", ".join(f"%({c})s" for c in cols)
            execute(
                f"INSERT INTO sessions ({', '.join(cols)}) VALUES ({placeholders})",
                vals
            )
        return

    # Fallback: JSON
    sf = _session_file(user_id)
    session = {}
    if os.path.exists(sf):
        with open(sf, "r", encoding="utf-8") as f:
            session = json.load(f)

    session["saved_date"] = _today()
    session["saved_week"] = _this_week()

    for key, value in [("exercise_data", exercise_data),
                       ("adaptive_day", adaptive_day),
                       ("today_training", today_training),
                       ("week_plan", week_plan),
                       ("exercise_adj", exercise_adj),
                       ("weekly_history", weekly_history)]:
        if value is _MISSING:
            continue
        if value is None:
            session.pop(key, None)
        else:
            session[key] = value

    with open(sf, "w", encoding="utf-8") as f:
        json.dump(session, f, indent=2, ensure_ascii=False)


def save_exercise_adj(date_iso: str, extra_kcal: int, source: str,
                      user_id: str | None = None) -> None:
    """Record exercise adjustment for a specific date."""
    if _use_db():
        from database import fetchone, execute
        from psycopg2.extras import Json

        if user_id:
            row = fetchone("SELECT id, exercise_adj FROM sessions WHERE user_id = %s ORDER BY id DESC LIMIT 1", (user_id,))
        else:
            row = fetchone("SELECT id, exercise_adj FROM sessions ORDER BY id DESC LIMIT 1")
        if row:
            adj = row.get("exercise_adj") or {}
            adj[date_iso] = {"extra_kcal": extra_kcal, "source": source}
            execute(
                "UPDATE sessions SET exercise_adj = %s, updated_at = NOW() WHERE id = %s",
                (Json(adj), row["id"])
            )
        return

    # Fallback: JSON
    sf = _session_file(user_id)
    session = {}
    if os.path.exists(sf):
        with open(sf, "r", encoding="utf-8") as f:
            session = json.load(f)
    adj = session.get("exercise_adj", {})
    adj[date_iso] = {"extra_kcal": extra_kcal, "source": source}
    session["exercise_adj"] = adj
    session.setdefault("saved_date", _today())
    session.setdefault("saved_week", _this_week())
    with open(sf, "w", encoding="utf-8") as f:
        json.dump(session, f, indent=2, ensure_ascii=False)


def load_weekly_history(user_id: str | None = None) -> list:
    """Returns list of WeeklyHistorySummary dicts, newest-first, max 12."""
    if _use_db():
        from database import fetchone
        if user_id:
            row = fetchone("SELECT weekly_history FROM sessions WHERE user_id = %s ORDER BY id DESC LIMIT 1", (user_id,))
        else:
            row = fetchone("SELECT weekly_history FROM sessions ORDER BY id DESC LIMIT 1")
        if row:
            return row.get("weekly_history") or []
        return []

    # Fallback: JSON
    sf = _session_file(user_id)
    if not os.path.exists(sf):
        return []
    with open(sf, "r", encoding="utf-8") as f:
        session = json.load(f)
    return session.get("weekly_history", [])


def save_weekly_history(summary: dict, user_id: str | None = None) -> None:
    """Prepend a new WeeklyHistorySummary; cap list at 12 entries."""
    if _use_db():
        from database import fetchone, execute
        from psycopg2.extras import Json

        if user_id:
            row = fetchone("SELECT id, weekly_history FROM sessions WHERE user_id = %s ORDER BY id DESC LIMIT 1", (user_id,))
        else:
            row = fetchone("SELECT id, weekly_history FROM sessions ORDER BY id DESC LIMIT 1")
        if row:
            history = row.get("weekly_history") or []
            history = [h for h in history if h.get("week_start") != summary.get("week_start")]
            history.insert(0, summary)
            history = history[:12]
            execute(
                "UPDATE sessions SET weekly_history = %s, updated_at = NOW() WHERE id = %s",
                (Json(history), row["id"])
            )
        return

    # Fallback: JSON
    sf = _session_file(user_id)
    session = {}
    if os.path.exists(sf):
        with open(sf, "r", encoding="utf-8") as f:
            session = json.load(f)
    history = session.get("weekly_history", [])
    history = [h for h in history if h.get("week_start") != summary.get("week_start")]
    history.insert(0, summary)
    history = history[:12]
    session["weekly_history"] = history
    session.setdefault("saved_date", _today())
    session.setdefault("saved_week", _this_week())
    with open(sf, "w", encoding="utf-8") as f:
        json.dump(session, f, indent=2, ensure_ascii=False)
