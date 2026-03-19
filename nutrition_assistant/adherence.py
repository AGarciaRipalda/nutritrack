"""
Seguimiento de adherencia al plan dietético diario.
El usuario marca qué comidas del día ha cumplido.
Los datos se guardan en adherence_log.json con fecha.
"""

import json
import os
from datetime import date, timedelta

ADHERENCE_FILE = "adherence_log.json"

MEAL_LABELS = {
    "desayuno":     "Desayuno",
    "media_manana": "Media mañana",
    "almuerzo":     "Almuerzo",
    "merienda":     "Merienda",
    "cena":         "Cena",
    "postre":       "Postre",
}


def _load() -> dict:
    if not os.path.exists(ADHERENCE_FILE):
        return {}
    with open(ADHERENCE_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def _save(log: dict) -> None:
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

    log = _load()
    log[today] = {"meals": result, "pct": pct}
    _save(log)

    print(f"  │                                         │")
    print(f"  │  Adherencia de hoy: {completed}/{total} comidas ({pct}%)   │")
    print("  └─────────────────────────────────────────┘")

    return log[today]


def weekly_adherence() -> float:
    """Calcula el % de adherencia medio de los últimos 7 días."""
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
