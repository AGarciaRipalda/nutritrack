"""
Seguimiento de adherencia al plan dietético diario.
El usuario marca qué comidas del día ha cumplido.
Los datos se guardan en adherence_log.json o PostgreSQL.
"""

import json
import os
from datetime import date, timedelta
from data_dir import DATA_DIR

ADHERENCE_FILE = DATA_DIR / "adherence_log.json"

MEAL_LABELS = {
    "desayuno":     "Desayuno",
    "media_manana": "Media mañana",
    "almuerzo":     "Almuerzo",
    "merienda":     "Merienda",
    "cena":         "Cena",
    "postre":       "Postre",
}


def _use_db():
    try:
        from database import is_db_available
        return is_db_available()
    except ImportError:
        return False


def _load() -> dict:
    if _use_db():
        from database import fetchall
        rows = fetchall("SELECT * FROM adherence_log ORDER BY date")
        result = {}
        for row in rows:
            d = str(row["date"])
            # Cargar comidas individuales
            from database import fetchall as fa
            meals_rows = fa(
                "SELECT meal_key, followed FROM adherence_meals WHERE adherence_id = %s",
                (row["id"],)
            )
            meals = {m["meal_key"]: m["followed"] for m in meals_rows}
            entry = {"meals": meals, "pct": row["pct"]}
            if row.get("consumed_kcal") is not None:
                entry["consumed_kcal"] = row["consumed_kcal"]
            if row.get("skipped_meals"):
                entry["skipped_meals"] = row["skipped_meals"]
            result[d] = entry
        return result

    # Fallback: JSON
    if not os.path.exists(ADHERENCE_FILE):
        return {}
    with open(ADHERENCE_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def _save(log: dict) -> None:
    if _use_db():
        return  # Las escrituras se hacen directamente en la DB

    with open(ADHERENCE_FILE, "w", encoding="utf-8") as f:
        json.dump(log, f, indent=2, ensure_ascii=False)


def log_adherence(day_data: dict) -> dict:
    """
    Muestra las comidas del día y pide al usuario que marque cuáles cumplió.
    Guarda el resultado y devuelve el dict de adherencia del día.
    """
    meals = day_data.get("meals", {})
    today = date.today().isoformat()
    order = ["desayuno", "media_manana", "almuerzo", "merienda", "cena", "postre"]

    print("\n  ┌─ SEGUIMIENTO DEL DÍA ───────────────────┐")
    print("  │  Marca las comidas que has cumplido:     │")

    result = {}
    for mtype in order:
        if mtype not in meals:
            continue
        label = MEAL_LABELS.get(mtype, mtype)
        resp  = input(f"  │  {label:<20} ¿Cumplido? (s/n): ").strip().lower()
        result[mtype] = resp == "s"

    completed = sum(1 for v in result.values() if v)
    total     = len(result)
    pct       = round(completed / total * 100) if total else 0

    if _use_db():
        from database import get_cursor
        from psycopg2.extras import Json
        with get_cursor() as cur:
            cur.execute("""
                INSERT INTO adherence_log (date, pct)
                VALUES (%s, %s)
                ON CONFLICT (date) DO UPDATE SET pct = EXCLUDED.pct
                RETURNING id
            """, (today, pct))
            adh_id = cur.fetchone()[0]
            cur.execute("DELETE FROM adherence_meals WHERE adherence_id = %s", (adh_id,))
            for meal_key, followed in result.items():
                cur.execute("""
                    INSERT INTO adherence_meals (adherence_id, meal_key, followed)
                    VALUES (%s, %s, %s)
                """, (adh_id, meal_key, followed))
    else:
        log = _load()
        log[today] = {"meals": result, "pct": pct}
        _save(log)

    print(f"  │                                         │")
    print(f"  │  Adherencia de hoy: {completed}/{total} comidas ({pct}%)   │")
    print("  └─────────────────────────────────────────┘")

    return {"meals": result, "pct": pct}


def weekly_adherence() -> float:
    """Calcula el % de adherencia medio de los últimos 7 días."""
    if _use_db():
        from database import fetchall
        today = date.today()
        week_ago = today - timedelta(days=6)
        rows = fetchall(
            "SELECT pct FROM adherence_log WHERE date >= %s AND date <= %s",
            (week_ago.isoformat(), today.isoformat())
        )
        pcts = [r["pct"] for r in rows]
        return round(sum(pcts) / len(pcts)) if pcts else 0

    log   = _load()
    today = date.today()
    pcts  = []
    for i in range(7):
        iso = (today - timedelta(days=i)).isoformat()
        if iso in log:
            pcts.append(log[iso]["pct"])
    return round(sum(pcts) / len(pcts)) if pcts else 0


def print_adherence_summary() -> None:
    """Muestra el resumen de adherencia de los últimos 7 días."""
    log   = _load()
    today = date.today()

    print("\n" + "="*52)
    print("  ADHERENCIA AL PLAN  (últimos 7 días)")
    print("="*52)

    total_pct = []
    for i in range(6, -1, -1):
        d   = today - timedelta(days=i)
        iso = d.isoformat()
        lbl = d.strftime("%a %d/%m")
        if iso not in log:
            print(f"  {lbl}  —  sin datos")
            continue
        entry = log[iso]
        pct   = entry["pct"]
        bar   = "█" * (pct // 10)
        print(f"  {lbl}  {bar:<10}  {pct}%")
        total_pct.append(pct)

    if total_pct:
        avg = round(sum(total_pct) / len(total_pct))
        print("-"*52)
        print(f"  Media semanal: {avg}%")
        if avg >= 85:
            print("  ✓ Excelente adherencia. ¡Sigue así!")
        elif avg >= 65:
            print("  ~ Buena adherencia. Pequeños ajustes pueden ayudar.")
        else:
            print("  ⚠ Adherencia baja. Revisa si el plan es demasiado restrictivo.")
    print("="*52)
