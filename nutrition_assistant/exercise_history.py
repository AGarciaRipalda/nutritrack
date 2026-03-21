"""
Historial de ejercicio diario.
Guarda el registro de cada día en exercise_history.json.
Permite ver resumen semanal: días entrenados, kcal totales, racha.
"""

import json
import os
from datetime import date, timedelta

HISTORY_FILE = "exercise_history.json"


def _load() -> dict:
    if not os.path.exists(HISTORY_FILE):
        return {}
    with open(HISTORY_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def _save(history: dict) -> None:
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2, ensure_ascii=False)


def record_today(exercise_data: dict) -> None:
    """Guarda el ejercicio del día actual en el historial."""
    history = _load()
    history[date.today().isoformat()] = exercise_data
    _save(history)


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

    for i in range(6, -1, -1):   # de hace 6 días a hoy
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
