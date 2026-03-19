"""
Observador del archivo Excel de entrenamiento.

- Usa PollingObserver (más estable en WSL2 sobre disco Windows).
- Al detectar un cambio, parsea el diario del mes actual,
  recalcula el gasto calórico semanal y ajusta los macros.
"""

import time
import datetime
import json
from pathlib import Path

from watchdog.observers.polling import PollingObserver
from watchdog.events import FileSystemEventHandler

from excel_parser  import EXCEL_PATH, parse_diary_sheet, get_current_month_sheet, get_all_diary_sheets
from calorie_estimator import (
    estimate_session_calories,
    compute_weekly_summary,
    print_session_report,
)
from calculator import calculate_bmr, calculate_tdee, ACTIVITY_LEVELS, GOAL_ADJUSTMENTS
from storage    import load_profile, save_profile

ADJUSTMENT_FILE = "macro_adjustments.json"


# ─── Lógica de ajuste ─────────────────────────────────────────────────────────

def adjust_macros_for_training(profile: dict, weekly_summary: dict) -> dict:
    """
    Recalcula los macros incorporando el gasto calórico semanal real.
    Estrategia:
      - TDEE base (sedentario nivel 1) + promedio diario de kcal de entrenamiento
      - Ajuste de objetivo (perder/mantener/ganar)
      - Proteínas: 2.2 g/kg (días de entrenamiento demandan más)
      - Grasas: 0.8 g/kg
      - Resto: carbohidratos
    """
    weight   = profile["weight_kg"]
    gender   = profile["gender"]
    age      = profile["age"]
    height   = profile["height_cm"]
    goal     = profile["goal"]

    bmr  = calculate_bmr(gender, age, height, weight)
    # Usamos nivel sedentario como base y sumamos el gasto real de entrena.
    tdee_base = bmr * ACTIVITY_LEVELS[1][2]

    avg_weekly_kcal = weekly_summary.get("avg_weekly_kcal", 0)
    daily_training_kcal = avg_weekly_kcal / 7

    adjusted_tdee   = tdee_base + daily_training_kcal
    goal_adjustment = GOAL_ADJUSTMENTS.get(goal, 0)
    target_kcal     = adjusted_tdee + goal_adjustment

    protein_g = weight * 2.2
    fat_g     = weight * 0.8
    carb_kcal = target_kcal - (protein_g * 4) - (fat_g * 9)
    carb_g    = max(carb_kcal / 4, 0)

    return {
        "bmr":                  round(bmr),
        "tdee_base":            round(tdee_base),
        "daily_training_kcal":  round(daily_training_kcal),
        "adjusted_tdee":        round(adjusted_tdee),
        "target_kcal":          round(target_kcal),
        "protein_g":            round(protein_g),
        "fat_g":                round(fat_g),
        "carb_g":               round(carb_g),
        "goal":                 goal,
        "updated_at":           datetime.datetime.now().isoformat(),
    }


def save_adjustment(adj: dict) -> None:
    with open(ADJUSTMENT_FILE, "w", encoding="utf-8") as f:
        json.dump(adj, f, indent=2, ensure_ascii=False)


def print_macro_report(adj: dict, summary: dict) -> None:
    goal_labels = {"lose": "Perder peso", "maintain": "Mantener peso", "gain": "Ganar músculo"}
    sessions_pw = summary.get("avg_sessions_per_week", "?")
    weeks       = summary.get("weeks_analyzed", "?")

    print("\n" + "═"*58)
    print("  AJUSTE SEMANAL DE MACROS  (basado en tu diario)")
    print("═"*58)
    print(f"  Semanas analizadas:       {weeks}")
    print(f"  Sesiones/semana (prom.):  {sessions_pw}")
    print(f"  Gasto entrena/semana:     {summary.get('avg_weekly_kcal', 0)} kcal")
    print(f"  Gasto entrena/día (med.): {adj['daily_training_kcal']} kcal")
    print("─"*58)
    print(f"  TMB (Mifflin-St.Jeor):    {adj['bmr']} kcal/día")
    print(f"  TDEE base (sedentario):   {adj['tdee_base']} kcal/día")
    print(f"  + Gasto real entrena.:  + {adj['daily_training_kcal']} kcal/día")
    print(f"  TDEE ajustado:            {adj['adjusted_tdee']} kcal/día")
    print(f"  Objetivo ({goal_labels.get(adj['goal'], adj['goal'])[:15]:<15}): {adj['target_kcal']} kcal/día")
    print("─"*58)
    print(f"  Proteínas (2.2g/kg):  {adj['protein_g']:>5} g  →  {adj['protein_g']*4:>5} kcal")
    print(f"  Grasas    (0.8g/kg):  {adj['fat_g']:>5} g  →  {adj['fat_g']*9:>5} kcal")
    print(f"  Carbohidratos:        {adj['carb_g']:>5} g  →  {adj['carb_g']*4:>5} kcal")
    print("═"*58)
    print(f"  Guardado en: {ADJUSTMENT_FILE}")
    print(f"  Actualizado: {adj['updated_at'][:19]}")
    print("═"*58)

    # Semana reciente
    last = summary.get("last_week_sessions", [])
    if last:
        print(f"\n  Última semana registrada ({len(last)} sesiones):")
        for s in last:
            print(f"    • {s['type']:<15}  {s['kcal']:>5.0f} kcal  |  vol: {s['volume']:>6.0f} kg·rep")
        print(f"    TOTAL semana: {summary.get('last_week_total_kcal', 0)} kcal")


def run_analysis(verbose: bool = True) -> None:
    """Ejecuta el análisis completo del diario."""
    profile = load_profile()

    # Recopilar todas las sesiones de todos los meses disponibles
    all_sessions = []
    for sheet_name in get_all_diary_sheets():
        sessions = parse_diary_sheet(sheet_name)
        all_sessions.extend(sessions)

    if not all_sessions:
        print("  ⚠ No se encontraron sesiones en el diario.")
        return

    summary = compute_weekly_summary(all_sessions)
    adj     = adjust_macros_for_training(profile, summary)
    save_adjustment(adj)

    if verbose:
        # Mostrar reporte detallado de la sesión más reciente
        recent_session = max(
            (s for s in all_sessions if s["date"] is not None),
            key=lambda s: s["date"],
            default=None,
        )
        if recent_session:
            print(f"\n  Última sesión detectada:")
            print_session_report(recent_session)

        print_macro_report(adj, summary)


# ─── Watcher ──────────────────────────────────────────────────────────────────

class ExcelChangeHandler(FileSystemEventHandler):
    def __init__(self):
        self._last_run = 0
        self._cooldown = 5  # segundos mínimos entre análisis

    def on_modified(self, event):
        if event.src_path != str(EXCEL_PATH):
            return
        now = time.time()
        if now - self._last_run < self._cooldown:
            return
        self._last_run = now

        ts = datetime.datetime.now().strftime("%H:%M:%S")
        print(f"\n  [{ts}] 📂 Cambio detectado en el Excel → analizando...")
        try:
            run_analysis(verbose=True)
        except Exception as e:
            print(f"  ⚠ Error al analizar: {e}")


def start_watcher() -> None:
    print(f"\n  Observando: {EXCEL_PATH}")
    print("  (Presiona Ctrl+C para detener)\n")

    # Análisis inicial
    print("  Análisis inicial...")
    try:
        run_analysis(verbose=True)
    except Exception as e:
        print(f"  ⚠ Análisis inicial falló: {e}")

    handler  = ExcelChangeHandler()
    observer = PollingObserver(timeout=10)  # polling cada 10s
    observer.schedule(handler, str(EXCEL_PATH.parent), recursive=False)
    observer.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
        print("\n  Watcher detenido.")
    observer.join()


if __name__ == "__main__":
    start_watcher()
