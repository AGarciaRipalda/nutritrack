"""
Historial de ejercicio diario.
Guarda el registro de cada día en exercise_history.json o PostgreSQL.
Permite ver resumen semanal: días entrenados, kcal totales, racha.

Soporte multi-usuario: user_id opcional en todas las funciones.
"""

import json
import os
from datetime import date, timedelta
from pathlib import Path
from data_dir import DATA_DIR
from user_paths import get_user_data_dir

HISTORY_FILE = DATA_DIR / "exercise_history.json"


def _use_db():
    try:
        from database import is_db_available
        return is_db_available()
    except ImportError:
        return False


def _user_dir(user_id: str | None) -> Path:
    return get_user_data_dir(user_id, default_dir=DATA_DIR)


def _history_file(user_id: str | None) -> Path:
    return _user_dir(user_id) / "exercise_history.json"


def _load(user_id: str | None = None) -> dict:
    if _use_db():
        from database import fetchall
        if user_id:
            rows = fetchall("""
                SELECT eh.date, eh.burned_kcal, eh.adjustment_kcal, eh.duration_min,
                       eh.session_type, eh.sources, eh.health_data, eh.gym_detail
                FROM exercise_history eh
                WHERE eh.user_id = %s
                ORDER BY eh.date
            """, (user_id,))
        else:
            rows = fetchall("""
                SELECT eh.date, eh.burned_kcal, eh.adjustment_kcal, eh.duration_min,
                       eh.session_type, eh.sources, eh.health_data, eh.gym_detail
                FROM exercise_history eh
                ORDER BY eh.date
            """)
        result = {}
        for row in rows:
            d = str(row["date"])
            from database import fetchall as fa
            entries = fa(
                "SELECT exercise_key, name, minutes, burned_kcal FROM exercise_entries WHERE history_id = %s",
                (row.get("id") if "id" in row else None,)
            ) if "id" in row else []

            entry = {
                "burned_kcal": row["burned_kcal"],
                "adjustment_kcal": row["adjustment_kcal"],
            }
            if row.get("duration_min"):
                entry["duration_min"] = row["duration_min"]
            if row.get("session_type"):
                entry["session_type"] = row["session_type"]
            if row.get("sources"):
                entry["sources"] = list(row["sources"])
            if row.get("health_data"):
                entry["health_data"] = row["health_data"]
            if row.get("gym_detail"):
                entry["gym_detail"] = row["gym_detail"]
            if entries:
                entry["exercises"] = [
                    {"key": e["exercise_key"], "name": e["name"],
                     "minutes": e["minutes"], "burned": e["burned_kcal"],
                     "kcal": e["burned_kcal"]}
                    for e in entries
                ]
            result[d] = entry
        return result

    # Fallback: JSON
    hf = _history_file(user_id)
    if not os.path.exists(hf):
        return {}
    with open(hf, "r", encoding="utf-8") as f:
        return json.load(f)


def _save(history: dict, user_id: str | None = None) -> None:
    if _use_db():
        return

    hf = _history_file(user_id)
    with open(hf, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2, ensure_ascii=False)


def record_today(exercise_data: dict, user_id: str | None = None) -> None:
    """Guarda el ejercicio del día actual en el historial."""
    today_iso = date.today().isoformat()

    if _use_db():
        from database import fetchone, execute, get_cursor
        from psycopg2.extras import Json

        burned = exercise_data.get("burned_kcal", 0)
        adj = exercise_data.get("adjustment_kcal", 0)
        sources = exercise_data.get("sources", [])
        health_data = exercise_data.get("health_data")
        gym_detail = exercise_data.get("gym_detail")

        with get_cursor() as cur:
            if user_id:
                cur.execute("""
                    INSERT INTO exercise_history (date, burned_kcal, adjustment_kcal,
                                                  sources, health_data, gym_detail, user_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (user_id, date) DO UPDATE SET
                        burned_kcal = EXCLUDED.burned_kcal,
                        adjustment_kcal = EXCLUDED.adjustment_kcal,
                        sources = EXCLUDED.sources,
                        health_data = EXCLUDED.health_data,
                        gym_detail = EXCLUDED.gym_detail
                    RETURNING id
                """, (today_iso, burned, adj,
                      sources if sources else [],
                      Json(health_data) if health_data else None,
                      Json(gym_detail) if gym_detail else None,
                      user_id))
            else:
                cur.execute("""
                    INSERT INTO exercise_history (date, burned_kcal, adjustment_kcal,
                                                  sources, health_data, gym_detail)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (date) DO UPDATE SET
                        burned_kcal = EXCLUDED.burned_kcal,
                        adjustment_kcal = EXCLUDED.adjustment_kcal,
                        sources = EXCLUDED.sources,
                        health_data = EXCLUDED.health_data,
                        gym_detail = EXCLUDED.gym_detail
                    RETURNING id
                """, (today_iso, burned, adj,
                      sources if sources else [],
                      Json(health_data) if health_data else None,
                      Json(gym_detail) if gym_detail else None))

            history_id = cur.fetchone()[0]

            exercises = exercise_data.get("exercises", [])
            cur.execute("DELETE FROM exercise_entries WHERE history_id = %s", (history_id,))
            for ex in exercises:
                cur.execute("""
                    INSERT INTO exercise_entries (history_id, exercise_key, name, minutes, burned_kcal)
                    VALUES (%s, %s, %s, %s, %s)
                """, (history_id, ex.get("key"), ex.get("name", ""),
                      ex.get("minutes", 0), ex.get("burned", ex.get("kcal", 0))))
        return

    # Fallback: JSON
    history = _load(user_id)
    history[today_iso] = exercise_data
    _save(history, user_id)


def _current_streak(history: dict) -> int:
    """Calcula la racha actual de días con ejercicio (sin contar hoy)."""
    streak = 0
    day = date.today() - timedelta(days=1)
    while True:
        entry = history.get(day.isoformat(), {})
        if entry.get("burned_kcal", 0) > 0:
            streak += 1
            day -= timedelta(days=1)
        else:
            break
    return streak


def print_weekly_summary() -> None:
    """Muestra el resumen de ejercicio de los últimos 7 días."""
    history = _load()
    today   = date.today()

    print("\n" + "="*52)
    print("  HISTORIAL DE EJERCICIO  (últimos 7 días)")
    print("="*52)

    total_kcal    = 0
    days_trained  = 0

    for i in range(6, -1, -1):
        day     = today - timedelta(days=i)
        iso     = day.isoformat()
        label   = day.strftime("%a %d/%m")
        entry   = history.get(iso)

        if entry is None:
            print(f"  {label}  —  sin datos")
            continue

        kcal = entry.get("burned_kcal", 0)
        if kcal == 0:
            print(f"  {label}  —  descanso")
        else:
            days_trained += 1
            total_kcal   += kcal
            exs = entry.get("exercises", [])
            names = ", ".join(e["name"].split("—")[0].strip() for e in exs)
            bar = "█" * min(int(kcal / 60), 10)
            print(f"  {label}  {bar:<10}  {kcal} kcal  ({names})")

    streak = _current_streak(history)
    print("-"*52)
    print(f"  Días entrenados:  {days_trained}/7")
    print(f"  Total quemado:    {total_kcal} kcal")
    if streak > 0:
        print(f"  Racha actual:     {streak} día{'s' if streak != 1 else ''} consecutivo{'s' if streak != 1 else ''} 🔥")
    print("="*52)
