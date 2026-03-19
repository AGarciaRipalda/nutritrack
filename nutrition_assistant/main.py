#!/usr/bin/env python3
"""
Asistente de Nutrición y Entrenamiento — CLI
"""

from calculator import ACTIVITY_LEVELS, print_nutrition_report
from training import generate_routine, generate_calistenia_routine
from storage import load_profile, save_profile, load_session, save_session
from watcher import run_analysis, start_watcher
from diet import (generate_week_plan, print_week_plan, generate_adaptive_day,
                  print_adaptive_day, regenerate_meal, DAYS, MEAL_LABELS)
from exercise_log import ask_yesterday_exercise, print_exercise_summary, ask_today_training
from pdf_export import export_week_plan_pdf, export_adaptive_day_pdf, export_shopping_list_pdf
from shopping_list import build_shopping_list, print_shopping_list
from preferences import load_excluded, load_favorites, manage_preferences
from exercise_history import record_today, print_weekly_summary
from weight_tracker import needs_weigh_in, ask_and_record_weight, print_weight_progress
from weight_chart import generate_weight_chart, open_chart
from adherence import log_adherence, print_adherence_summary
from weekly_survey import needs_survey, run_survey, print_survey_history
from competition_planner import register_event, print_event_status, days_to_event
from weekly_report import print_weekly_report, needs_weekly_report, mark_report_shown


# ─── Helpers ──────────────────────────────────────────────────────────────────

def ask_int(prompt: str, min_val: int, max_val: int, default: int = None) -> int:
    while True:
        suffix = f" [{default}]" if default is not None else ""
        raw = input(f"{prompt}{suffix}: ").strip()
        if raw == "" and default is not None:
            return default
        if raw.isdigit() and min_val <= int(raw) <= max_val:
            return int(raw)
        print(f"  ⚠ Ingresa un número entre {min_val} y {max_val}.")

def ask_float(prompt: str, min_val: float, max_val: float, default: float = None) -> float:
    while True:
        suffix = f" [{default}]" if default is not None else ""
        raw = input(f"{prompt}{suffix}: ").strip()
        if raw == "" and default is not None:
            return default
        try:
            val = float(raw)
            if min_val <= val <= max_val:
                return val
        except ValueError:
            pass
        print(f"  ⚠ Ingresa un número entre {min_val} y {max_val}.")

def ask_choice(prompt: str, choices: list, default: str = None) -> str:
    while True:
        suffix = f" [{default}]" if default is not None else ""
        raw = input(f"{prompt} ({'/'.join(choices)}){suffix}: ").strip().lower()
        if raw == "" and default is not None:
            return default
        if raw in choices:
            return raw
        print(f"  ⚠ Opciones válidas: {', '.join(choices)}.")


# ─── Submenús ─────────────────────────────────────────────────────────────────

def menu_edit_profile(profile: dict) -> dict:
    print("\n  Deja en blanco para mantener el valor actual.")

    name = input(f"  Nombre [{profile['name']}]: ").strip()
    if name:
        profile["name"] = name

    gender = ask_choice("  Género", ["male", "female"], profile["gender"])
    profile["gender"] = gender

    profile["age"]       = ask_int  ("  Edad (años)",    10, 100, profile["age"])
    profile["height_cm"] = ask_int  ("  Altura (cm)",   100, 250, profile["height_cm"])
    profile["weight_kg"] = ask_float("  Peso (kg)",      30, 300, profile["weight_kg"])

    print("\n  Niveles de actividad:")
    for k, (name_, desc, _) in ACTIVITY_LEVELS.items():
        print(f"    {k}. {name_} — {desc}")
    profile["activity_level"] = ask_int("  Nivel de actividad", 1, 4, profile["activity_level"])

    print("\n  Objetivos: lose=perder peso | maintain=mantener | gain=ganar músculo")
    profile["goal"] = ask_choice("  Objetivo", ["lose", "maintain", "gain"], profile["goal"])

    save_profile(profile)
    return profile

def menu_training(profile: dict) -> None:
    print("\n  Tipo de entrenamiento:")
    print("    1. Pesas (gym)")
    print("    2. Calistenia (parque)")
    tipo = input("  Elige (1/2) [1]: ").strip() or "1"

    days = ask_int("  ¿Cuántos días por semana entrenas?", 2, 6, 3)

    if tipo == "2":
        generate_calistenia_routine(days, profile["weight_kg"])
    else:
        generate_routine(days, profile["weight_kg"])


# ─── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    print("\n╔══════════════════════════════════════╗")
    print("║  Asistente de Nutrición y Entrena-  ║")
    print("║  miento  —  Powered by Python       ║")
    print("╚══════════════════════════════════════╝")

    profile   = load_profile()
    excluded  = load_excluded()
    favorites = load_favorites()
    print(f"\n  Bienvenido/a, {profile['name']}!")

    # ── Restaurar sesión ──────────────────────────────────────────────────────
    session      = load_session()
    week_plan    = session["week_plan"]    # None si cambió de semana
    adaptive_day = session["adaptive_day"] # None si cambió de día

    if session["exercise_data"] is not None:
        # Ya se registró el ejercicio hoy — no volver a preguntar
        exercise_data   = session["exercise_data"]
        today_training  = session["today_training"] or {}
        burned = exercise_data.get("burned_kcal", 0)
        if burned > 0:
            print(f"  (Ejercicio de ayer ya registrado: {burned} kcal quemadas)")
        else:
            print("  (Ejercicio de ayer ya registrado: día de descanso)")
        if today_training.get("bonus_kcal", 0) > 0:
            print(f"  (Entrenamiento de hoy ya registrado: +{today_training['bonus_kcal']} kcal)")
    else:
        # Primera apertura del día — preguntar y guardar en historial
        exercise_data  = ask_yesterday_exercise(profile["weight_kg"], profile["goal"])
        today_training = ask_today_training(profile["weight_kg"])
        save_session(exercise_data=exercise_data, today_training=today_training)
        record_today(exercise_data)

    # ── Pesaje semanal ────────────────────────────────────────────────────────
    if needs_weigh_in():
        new_weight = ask_and_record_weight(profile)
        if new_weight != profile["weight_kg"]:
            profile["weight_kg"] = new_weight
            save_profile(profile)
            adaptive_day = None   # recalcular macros con nuevo peso
            save_session(adaptive_day=None)

    # ── Encuesta semanal ──────────────────────────────────────────────────────
    if needs_survey():
        run_survey()

    # ── Informe semanal (lunes) ───────────────────────────────────────────────
    if needs_weekly_report():
        print_weekly_report(profile["goal"])
        mark_report_shown()

    # ── Aviso de evento próximo ───────────────────────────────────────────────
    d = days_to_event()
    if d is not None and d <= 7:
        print_event_status()

    while True:
        print("\n  ┌─ MENÚ ─────────────────────────────┐")
        print("  │  1. Ver reporte nutricional         │")
        print("  │  2. Generar rutina de entreno       │")
        print("  │  3. Editar perfil                   │")
        print("  │  4. Ver perfil actual               │")
        print("  │  5. Plan de dieta semanal           │")
        print("  │  6. Dieta adaptada de hoy           │")
        print("  │  7. Regenerar plan semanal          │")
        print("  │  R. Regenerar dieta de hoy          │")
        print("  │  8. Resumen ejercicio de ayer       │")
        print("  │  H. Historial ejercicio (7 días)    │")
        print("  │  A. Registrar adherencia del día    │")
        print("  │  X. Corregir ejercicio de ayer      │")
        print("  │  9. Analizar Excel (una vez)        │")
        print("  │  E. Exportar dieta a PDF            │")
        print("  │  W. Progreso de peso                │")
        print("  │  S. Historial de sensaciones        │")
        print("  │  C. Registrar evento/competición    │")
        print("  │  I. Informe semanal                 │")
        print("  │  L. Lista de la compra              │")
        print("  │  P. Preferencias alimentarias       │")
        print("  │  0. Salir                           │")
        print("  └─────────────────────────────────────┘")

        option = input("\n  Opción: ").strip()

        if option == "1":
            print_nutrition_report(profile, exercise_data)

        elif option == "2":
            menu_training(profile)

        elif option == "3":
            profile = menu_edit_profile(profile)
            adaptive_day = None  # invalidar si cambia el perfil
            save_session(adaptive_day=None)

        elif option == "4":
            print(f"""
  Perfil actual:
    Nombre:    {profile['name']}
    Género:    {'Hombre' if profile['gender'] == 'male' else 'Mujer'}
    Edad:      {profile['age']} años
    Altura:    {profile['height_cm']} cm
    Peso:      {profile['weight_kg']} kg
    Actividad: {ACTIVITY_LEVELS[profile['activity_level']][0]}
    Objetivo:  {profile['goal']}""")

        elif option == "5":
            if week_plan is None:
                week_plan = generate_week_plan(excluded, favorites)
                save_session(week_plan=week_plan)
            print_week_plan(week_plan)

        elif option == "6":
            if adaptive_day is None:
                adaptive_day = generate_adaptive_day(profile, exercise_data, excluded, today_training, favorites)
                save_session(adaptive_day=adaptive_day)
            print_adaptive_day(adaptive_day, exercise_data)
            # Ofrecer sustitución de un plato concreto
            cambiar = input("\n  ¿Cambiar algún plato? (s/n): ").strip().lower()
            if cambiar == "s":
                meal_opts = {**MEAL_LABELS, "postre": "Postre"}
                print("  Comidas:")
                keys = list(meal_opts.keys())
                for i, k in enumerate(keys, 1):
                    print(f"    {i}. {meal_opts[k]}")
                sel = input("  Elige número: ").strip()
                if sel.isdigit() and 1 <= int(sel) <= len(keys):
                    mtype = keys[int(sel) - 1]
                    adaptive_day = regenerate_meal(adaptive_day, mtype, excluded, favorites)
                    save_session(adaptive_day=adaptive_day)
                    print(f"\n  Plato cambiado:")
                    print_adaptive_day(adaptive_day, exercise_data)

        elif option == "7":
            week_plan = generate_week_plan(excluded, favorites)
            save_session(week_plan=week_plan)
            print("\n  Plan semanal regenerado.")
            print_week_plan(week_plan)

        elif option == "r":
            adaptive_day = generate_adaptive_day(profile, exercise_data, excluded, today_training, favorites)
            save_session(adaptive_day=adaptive_day)
            print("\n  Dieta de hoy regenerada.")
            print_adaptive_day(adaptive_day, exercise_data)

        elif option == "8":
            print_exercise_summary(exercise_data)

        elif option == "h":
            print_weekly_summary()

        elif option == "a":
            if adaptive_day is None:
                adaptive_day = generate_adaptive_day(profile, exercise_data, excluded, today_training, favorites)
                save_session(adaptive_day=adaptive_day)
            log_adherence(adaptive_day)
            print_adherence_summary()

        elif option == "x":
            print("\n  Vamos a re-registrar el ejercicio de ayer.")
            exercise_data = ask_yesterday_exercise(profile["weight_kg"], profile["goal"])
            save_session(exercise_data=exercise_data)
            record_today(exercise_data)
            # La dieta del día queda obsoleta con el nuevo ajuste calórico
            adaptive_day = None
            save_session(adaptive_day=None)
            print("  Ejercicio actualizado. La dieta de hoy se recalculará cuando la pidas.")

        elif option == "9":
            print("\n  Analizando Excel...")
            run_analysis(verbose=True)

        elif option == "e":
            print("\n  ¿Qué quieres exportar?")
            print("    1. Plan semanal de inspiración")
            print("    2. Dieta adaptada de hoy")
            what = input("  Elige (1/2) [1]: ").strip() or "1"
            try:
                if what == "2":
                    if adaptive_day is None:
                        adaptive_day = generate_adaptive_day(profile, exercise_data, excluded, today_training, favorites)
                        save_session(adaptive_day=adaptive_day)
                    path = export_adaptive_day_pdf(adaptive_day, exercise_data, profile)
                else:
                    if week_plan is None:
                        week_plan = generate_week_plan(excluded, favorites)
                        save_session(week_plan=week_plan)
                    path = export_week_plan_pdf(week_plan, profile)
                print(f"\n  PDF guardado en:\n  {path}")
            except Exception as exc:
                print(f"\n  ⚠ Error al generar PDF: {exc}")

        elif option == "s":
            print_survey_history()

        elif option == "c":
            register_event()
            # Invalidar dieta para recalcular con ajuste de evento
            adaptive_day = None
            save_session(adaptive_day=None)

        elif option == "i":
            print_weekly_report(profile["goal"])

        elif option == "w":
            print_weight_progress(profile["goal"])
            chart = input("\n  ¿Ver gráfica de progreso? (s/n): ").strip().lower()
            if chart == "s":
                path = generate_weight_chart(profile["goal"], profile)
                if path:
                    print(f"  Gráfica guardada en:\n  {path}")
                    open_chart(path)

        elif option == "l":
            if week_plan is None:
                week_plan = generate_week_plan(excluded, favorites)
                save_session(week_plan=week_plan)
            shopping = build_shopping_list(week_plan)
            print_shopping_list(shopping)
            exportar = input("\n  ¿Exportar a PDF? (s/n): ").strip().lower()
            if exportar == "s":
                path = export_shopping_list_pdf(shopping, profile)
                print(f"  PDF guardado en:\n  {path}")

        elif option == "p":
            excluded  = manage_preferences()
            favorites = load_favorites()
            # Invalidar planes generados con las preferencias anteriores
            week_plan    = None
            adaptive_day = None
            save_session(week_plan=None, adaptive_day=None)
            print("  Los planes se regenerarán con las nuevas preferencias.")

        elif option == "0":
            print("\n  ¡Hasta la próxima!\n")
            break

        else:
            print("  ⚠ Opción no válida.")


if __name__ == "__main__":
    main()
