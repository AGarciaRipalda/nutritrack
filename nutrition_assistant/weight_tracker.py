"""
Registro semanal de peso y seguimiento de progreso.
Guarda el historial en weight_history.json o PostgreSQL.
"""

import json
import os
from datetime import date, timedelta
from data_dir import DATA_DIR

HISTORY_FILE = DATA_DIR / "weight_history.json"

EXPECTED_WEEKLY_CHANGE = {
    "lose":     -0.5,
    "maintain":  0.0,
    "gain":     +0.3,
}


def _use_db():
    try:
        from database import is_db_available
        return is_db_available()
    except ImportError:
        return False


def _load() -> list:
    """Devuelve lista de {date, weight_kg} ordenada por fecha."""
    if _use_db():
        from database import fetchall
        rows = fetchall("SELECT date, week, weight_kg FROM weight_history ORDER BY date")
        return [
            {"date": str(r["date"]), "week": r["week"], "weight_kg": float(r["weight_kg"])}
            for r in rows
        ]

    if not os.path.exists(HISTORY_FILE):
        return []
    with open(HISTORY_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def _save(history: list) -> None:
    if _use_db():
        from database import execute
        for entry in history:
            execute("""
                INSERT INTO weight_history (date, week, weight_kg)
                VALUES (%s, %s, %s)
                ON CONFLICT (date) DO UPDATE SET
                    week = EXCLUDED.week,
                    weight_kg = EXCLUDED.weight_kg
            """, (entry["date"], entry.get("week", ""), entry["weight_kg"]))
        return

    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2, ensure_ascii=False)


def _last_record_week() -> str | None:
    """Devuelve la semana ISO del último registro, o None si no hay datos."""
    if _use_db():
        from database import fetchone
        row = fetchone("SELECT week FROM weight_history ORDER BY date DESC LIMIT 1")
        return row["week"] if row else None

    history = _load()
    if not history:
        return None
    return history[-1].get("week")


def needs_weigh_in() -> bool:
    """True si aún no se ha registrado el peso esta semana."""
    return _last_record_week() != date.today().strftime("%G-W%V")


def ask_and_record_weight(profile: dict) -> float:
    """
    Pregunta el peso actual, lo guarda y devuelve el valor.
    Actualiza también el perfil en memoria (sin guardarlo a disco).
    """
    print("\n  ┌─ PESO SEMANAL ──────────────────────────┐")
    print("  │  Es hora de registrar tu peso de esta   │")
    print("  │  semana. Pésate en ayunas si es posible.│")
    print("  └─────────────────────────────────────────┘")

    while True:
        raw = input(f"  Tu peso actual (kg) [{profile['weight_kg']}]: ").strip()
        if raw == "":
            weight = profile["weight_kg"]
            break
        try:
            weight = float(raw)
            if 30 <= weight <= 300:
                break
        except ValueError:
            pass
        print("  ⚠ Introduce un peso válido (30-300 kg).")

    entry = {
        "date":      date.today().isoformat(),
        "week":      date.today().strftime("%G-W%V"),
        "weight_kg": weight,
    }

    if _use_db():
        from database import execute
        execute("""
            INSERT INTO weight_history (date, week, weight_kg)
            VALUES (%s, %s, %s)
            ON CONFLICT (date) DO UPDATE SET
                week = EXCLUDED.week, weight_kg = EXCLUDED.weight_kg
        """, (entry["date"], entry["week"], entry["weight_kg"]))
    else:
        history = _load()
        history.append(entry)
        _save(history)

    profile["weight_kg"] = weight
    return weight


def print_weight_progress(goal: str) -> None:
    """Muestra el historial de peso y el análisis de progreso."""
    history = _load()
    if not history:
        print("  Sin datos de peso registrados.")
        return

    expected = EXPECTED_WEEKLY_CHANGE.get(goal, 0)
    goal_labels = {"lose": "perder peso", "maintain": "mantener", "gain": "ganar músculo"}

    print("\n" + "="*52)
    print("  PROGRESO DE PESO")
    print("="*52)
    print(f"  Objetivo: {goal_labels.get(goal, goal)}")
    print(f"  Ritmo esperado: {expected:+.1f} kg/semana")
    print("-"*52)

    for i, entry in enumerate(history[-8:]):
        w    = entry["weight_kg"]
        d    = entry["date"]
        prev = history[history.index(entry) - 1]["weight_kg"] if i > 0 else w
        diff = w - prev
        arrow = ("↓" if diff < -0.05 else "↑" if diff > 0.05 else "→")
        print(f"  {d}   {w:.1f} kg  {arrow} {diff:+.1f} kg")

    if len(history) >= 2:
        print("-"*52)
        first = history[0]
        last  = history[-1]
        weeks_elapsed = max(
            (date.fromisoformat(last["date"]) - date.fromisoformat(first["date"])).days / 7,
            1,
        )
        total_change   = last["weight_kg"] - first["weight_kg"]
        real_weekly    = total_change / weeks_elapsed

        print(f"  Cambio real:     {total_change:+.1f} kg en {weeks_elapsed:.0f} semanas")
        print(f"  Ritmo real:      {real_weekly:+.2f} kg/semana")
        print(f"  Ritmo esperado:  {expected:+.1f} kg/semana")

        diff_vs_plan = real_weekly - expected
        if abs(diff_vs_plan) < 0.1:
            print("  ✓ Vas exactamente según el plan.")
        elif goal == "lose" and diff_vs_plan > 0.1:
            print("  ⚠ Pierdes menos de lo esperado. Revisa las porciones.")
        elif goal == "lose" and diff_vs_plan < -0.2:
            print("  ⚠ Pierdes más rápido de lo ideal. Asegúrate de comer suficiente.")
        elif goal == "gain" and diff_vs_plan < -0.1:
            print("  ⚠ Ganas menos masa de lo esperado. Considera aumentar calorías.")
        elif goal == "maintain" and abs(total_change) > 1.0:
            print(f"  ⚠ Variación de {total_change:+.1f} kg. Revisa el plan.")
        else:
            print("  ✓ Progreso dentro del rango esperado.")

    print("="*52)
