"""
Estimación del gasto calórico a partir del volumen de entrenamiento.

Modelo basado en evidencia:
  - Ejercicio compuesto:  0.10 kcal / (kg × rep)
  - Ejercicio aislado:    0.07 kcal / (kg × rep)
  - Overhead por sesión:  ~120 kcal (calentamiento, EPOC, descansos)

Referencia: la literatura sitúa el gasto del entrenamiento de fuerza
entre 300-600 kcal/sesión dependiendo de la intensidad y volumen.
"""

from __future__ import annotations

COMPOUND_FACTOR  = 0.10   # kcal por unidad de volumen (kg·rep)
ISOLATION_FACTOR = 0.07
SESSION_OVERHEAD = 120    # kcal fijas por sesión


def estimate_session_calories(session: dict) -> float:
    """Estima las kcal quemadas en una sesión."""
    workout_kcal = 0.0
    for ex in session["exercises"]:
        vol    = ex.get("volume", 0.0)
        factor = COMPOUND_FACTOR if ex.get("compound") else ISOLATION_FACTOR
        workout_kcal += vol * factor

    total = workout_kcal + SESSION_OVERHEAD
    return round(total, 1)


def compute_weekly_summary(sessions: list[dict]) -> dict:
    """
    Agrupa sesiones por semana ISO y devuelve resumen con:
    - sesiones_por_semana
    - kcal_promedio_por_sesion
    - kcal_total_semanal_promedio
    - volumen_total_por_sesion (promedio)
    """
    from collections import defaultdict
    import datetime

    weekly: dict[tuple, list] = defaultdict(list)
    for s in sessions:
        if s["date"] is None:
            continue
        if isinstance(s["date"], datetime.datetime):
            d = s["date"].date()
        else:
            d = s["date"]
        iso = d.isocalendar()[:2]  # (year, week)
        kcal = estimate_session_calories(s)
        vol  = sum(ex["volume"] for ex in s["exercises"])
        weekly[iso].append({"kcal": kcal, "volume": vol, "type": s["type"]})

    if not weekly:
        return {}

    weeks_data = list(weekly.values())
    avg_sessions = sum(len(w) for w in weeks_data) / len(weeks_data)
    avg_kcal_session = (
        sum(s["kcal"] for w in weeks_data for s in w)
        / sum(len(w) for w in weeks_data)
    )
    avg_weekly_kcal = sum(
        sum(s["kcal"] for s in w) for w in weeks_data
    ) / len(weeks_data)

    # Semana más reciente para el reporte detallado
    last_week_key = sorted(weekly.keys())[-1]
    last_week = weekly[last_week_key]

    return {
        "avg_sessions_per_week":   round(avg_sessions, 1),
        "avg_kcal_per_session":    round(avg_kcal_session),
        "avg_weekly_kcal":         round(avg_weekly_kcal),
        "last_week_sessions":      last_week,
        "last_week_total_kcal":    round(sum(s["kcal"] for s in last_week)),
        "weeks_analyzed":          len(weeks_data),
    }


def print_session_report(session: dict) -> None:
    kcal = estimate_session_calories(session)
    total_vol = sum(ex["volume"] for ex in session["exercises"])

    date_str = str(session["date"]) if session["date"] else "sin fecha"
    print(f"\n  {'─'*55}")
    print(f"  Sesión: {session['type']:<20}  Fecha: {date_str}")
    print(f"  {'─'*55}")
    print(f"  {'Ejercicio':<38} {'Vol(kg·r)':>9}  Tipo")
    print(f"  {'─'*55}")
    for ex in session["exercises"]:
        tipo = "Compuesto" if ex["compound"] else "Aislado  "
        print(f"  {ex['name'][:38]:<38} {ex['volume']:>9.0f}  {tipo}")
    print(f"  {'─'*55}")
    print(f"  Volumen total:        {total_vol:>8.0f} kg·rep")
    print(f"  Gasto estimado:       {kcal:>8.0f} kcal")
    print(f"  (overhead sesión):    {SESSION_OVERHEAD:>8}  kcal")
