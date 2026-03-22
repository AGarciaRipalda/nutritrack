"""
Informe semanal automático.
Se muestra cada lunes al arrancar o con la opción I del menú.
Combina: ejercicio, peso, adherencia y sensaciones para dar una recomendación.
"""

import json
import os
from datetime import date, timedelta

from exercise_history import HISTORY_FILE as EX_FILE
from weight_tracker import HISTORY_FILE as W_FILE, EXPECTED_WEEKLY_CHANGE
from adherence import ADHERENCE_FILE, weekly_adherence
from weekly_survey import last_survey_scores


def _load(path) -> dict | list:
    p = str(path)
    if not os.path.exists(p):
        return {} if p.endswith(".json") and "history" in p.lower() else []
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)


def _last_week_exercise() -> tuple[int, int]:
    """Devuelve (días_entrenados, kcal_totales) de los últimos 7 días."""
    history = _load(EX_FILE)
    today   = date.today()
    days, kcal = 0, 0
    for i in range(7):
        iso = (today - timedelta(days=i + 1)).isoformat()  # semana pasada
        entry = history.get(iso, {})
        if entry.get("burned_kcal", 0) > 0:
            days += 1
            kcal += entry["burned_kcal"]
    return days, kcal


def _weight_change() -> tuple[float | None, float | None]:
    """Devuelve (peso_hace_7_dias, peso_hoy) o (None, None) si no hay datos."""
    history = _load(W_FILE)
    if not history or not isinstance(history, list):
        return None, None
    today = date.today()
    # Peso más reciente
    last = history[-1]["weight_kg"] if history else None
    # Peso de hace ~7 días
    prev = None
    for entry in reversed(history[:-1]):
        d = date.fromisoformat(entry["date"])
        if (today - d).days >= 5:
            prev = entry["weight_kg"]
            break
    return prev, last


def _recommendation(goal: str, adherence: int, ex_days: int,
                    weight_change: float | None, survey: dict) -> str:
    """Genera una recomendación concreta basada en los datos de la semana."""
    tips = []

    # Adherencia
    if adherence < 60:
        tips.append("Tu adherencia fue baja esta semana. ¿El plan es demasiado estricto? "
                    "Prueba a añadir más favoritos o ajustar las porciones.")
    elif adherence >= 85:
        tips.append("Excelente adherencia al plan. ¡Sigue así!")

    # Ejercicio
    if ex_days == 0:
        tips.append("No registraste ejercicio esta semana. Incluso caminar 30 min/día "
                    "puede marcar la diferencia.")
    elif ex_days >= 5:
        tips.append(f"Entrenaste {ex_days} días. Asegúrate de descansar al menos 2 días/semana.")

    # Peso vs objetivo
    if weight_change is not None:
        expected_weekly = EXPECTED_WEEKLY_CHANGE.get(goal, 0)
        if goal == "lose" and weight_change > 0.1:
            tips.append(f"Tu peso subió {weight_change:+.1f} kg esta semana. "
                        "Considera reducir 100-150 kcal en la cena.")
        elif goal == "lose" and weight_change < -1.0:
            tips.append(f"Perdiste {abs(weight_change):.1f} kg esta semana, más de lo ideal. "
                        "Aumenta ligeramente los carbohidratos para proteger la masa muscular.")
        elif goal == "gain" and weight_change < 0.1:
            tips.append("Tu peso no subió esta semana. Añade una ración extra de carbohidratos "
                        "en el post-entreno.")
        elif goal == "maintain" and abs(weight_change) > 0.8:
            tips.append(f"Tu peso varió {weight_change:+.1f} kg. Revisa las porciones "
                        "para mantener la estabilidad.")
        else:
            tips.append(f"Cambio de peso: {weight_change:+.1f} kg — dentro del rango esperado.")

    # Sensaciones
    energia = survey.get("energia", 0)
    sueno   = survey.get("sueno", 0)
    if energia and energia <= 2:
        tips.append("Tu energía fue baja. Asegúrate de desayunar bien y no saltarte "
                    "el pre-entreno.")
    if sueno and sueno <= 2:
        tips.append("El sueño fue malo esta semana. Evita carbohidratos simples "
                    "en la cena y cena 2h antes de dormir.")

    if not tips:
        tips.append("Semana equilibrada. Mantén el rumbo y sigue el plan.")

    return "\n".join(f"  • {t}" for t in tips)


def needs_weekly_report() -> bool:
    """True si hoy es lunes y aún no se ha mostrado el informe esta semana."""
    report_flag = "weekly_report_shown.json"
    week = date.today().strftime("%G-W%V")
    if not os.path.exists(report_flag):
        return date.today().weekday() == 0  # solo lunes
    with open(report_flag, "r") as f:
        shown = json.load(f).get("week")
    return shown != week and date.today().weekday() == 0


def mark_report_shown() -> None:
    with open("weekly_report_shown.json", "w") as f:
        json.dump({"week": date.today().strftime("%G-W%V")}, f)


def print_weekly_report(goal: str) -> None:
    """Muestra el informe semanal completo."""
    ex_days, ex_kcal = _last_week_exercise()
    prev_w, curr_w   = _weight_change()
    adherence        = weekly_adherence()
    survey           = last_survey_scores()
    weight_change    = round(curr_w - prev_w, 1) if prev_w and curr_w else None

    print("\n" + "╔" + "═"*54 + "╗")
    print("║" + "  INFORME SEMANAL".center(54) + "║")
    print("╚" + "═"*54 + "╝")

    # Ejercicio
    print(f"\n  🏃 Ejercicio")
    print(f"     Días entrenados: {ex_days}/7")
    print(f"     Kcal quemadas:   {ex_kcal} kcal")

    # Peso
    print(f"\n  ⚖️  Peso")
    if curr_w:
        print(f"     Peso actual:     {curr_w:.1f} kg")
        if weight_change is not None:
            arrow = "↓" if weight_change < 0 else "↑" if weight_change > 0 else "→"
            print(f"     Cambio semanal:  {weight_change:+.1f} kg {arrow}")
    else:
        print("     Sin datos de peso esta semana.")

    # Adherencia
    print(f"\n  🍽️  Adherencia al plan")
    bar = "█" * (adherence // 10) + "░" * (10 - adherence // 10)
    print(f"     {bar}  {adherence}%")

    # Sensaciones
    if survey:
        print(f"\n  💭 Sensaciones (encuesta)")
        labels = {"energia": "Energía", "hambre": "Sin hambre",
                  "adherencia": "Adherencia percibida", "sueno": "Sueño"}
        for key, lbl in labels.items():
            v = survey.get(key, 0)
            if v:
                print(f"     {lbl:<22} {'★'*v}{'☆'*(5-v)} ({v}/5)")

    # Recomendación
    print(f"\n  💡 Recomendaciones para esta semana:")
    rec = _recommendation(goal, adherence, ex_days, weight_change, survey)
    print(rec)
    print("\n" + "═"*56)
