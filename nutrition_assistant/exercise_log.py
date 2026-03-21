"""
Registro del ejercicio del día anterior y cálculo del ajuste calórico diario.
Usa la fórmula MET: kcal = MET × peso_kg × horas
"""

# Factor de recuperación calórica según objetivo
# lose: recupera el 85% — el 15% restante + GOAL_ADJUSTMENT mantiene el déficit sin canibalizar músculo
RECOVERY_FACTOR = {
    "lose":     0.85,   # Recupera 85% — el 15% restante + GOAL_ADJUSTMENT mantiene el déficit sin canibalizar músculo
    "maintain": 1.00,
    "gain":     1.10,
}

# ─── Base de datos de ejercicios ──────────────────────────────────────────────
# MET = Equivalente Metabólico de la Tarea
# Fuente: Compendium of Physical Activities (Ainsworth et al.)

EXERCISES = {
    "1": {"name": "Caminar  —  10 min/km (6.0 km/h)",   "met": 5.0},
    "2": {"name": "Caminar  —   9 min/km (6.7 km/h)",   "met": 6.0},
    "3": {"name": "Pesas gym  —  intensidad ligera",     "met": 3.5},
    "4": {"name": "Pesas gym  —  intensidad moderada",   "met": 5.0},
    "5": {"name": "Pesas gym  —  intensidad alta",       "met": 6.0},
    "6": {"name": "Calistenia parque  —  intensidad moderada", "met": 5.5},
    "7": {"name": "Calistenia parque  —  intensidad alta",     "met": 8.0},
}


# ─── Cálculo ──────────────────────────────────────────────────────────────────

def calculate_exercise_kcal(met: float, weight_kg: float, minutes: int) -> float:
    """Kcal quemadas = MET × peso_kg × horas"""
    return met * weight_kg * (minutes / 60)


def ask_yesterday_exercise(weight_kg: float, goal: str) -> dict:
    """
    Pregunta al usuario qué ejercicio hizo ayer.
    Devuelve dict con kcal quemadas y ajuste calórico para hoy.
    """
    print("\n  ┌─ ACTIVIDAD DE AYER ────────────────────┐")
    resp = input("  │  ¿Hiciste ejercicio ayer? (s/n): ").strip().lower()

    if resp != "s":
        print("  └────────────────────────────────────────┘")
        return {"burned_kcal": 0, "adjustment_kcal": 0, "exercises": []}

    total_burned = 0.0
    log = []

    while True:
        print("\n  Tipo de ejercicio:")
        for key, ex in EXERCISES.items():
            print(f"    {key}. {ex['name']}  (MET {ex['met']})")

        choice = input("\n  Elige (1-7): ").strip()
        if choice not in EXERCISES:
            print("  ⚠ Opción no válida.")
            continue

        ex = EXERCISES[choice]
        try:
            minutes = int(input(f"  ¿Cuántos minutos de '{ex['name'].split('—')[0].strip()}'? ").strip())
            if minutes <= 0:
                raise ValueError
        except ValueError:
            print("  ⚠ Introduce un número de minutos válido.")
            continue

        kcal = calculate_exercise_kcal(ex["met"], weight_kg, minutes)
        total_burned += kcal
        log.append({"name": ex["name"], "minutes": minutes, "kcal": round(kcal)})
        print(f"  → {round(kcal)} kcal quemadas")

        more = input("  ¿Añadir otro ejercicio? (s/n): ").strip().lower()
        if more != "s":
            break

    factor   = RECOVERY_FACTOR.get(goal, 0.60)
    adjustment = round(total_burned * factor)

    print(f"\n  Total quemado ayer:  {round(total_burned)} kcal")
    print(f"  Recuperas hoy ({int(factor*100)}%): +{adjustment} kcal")
    print("  └────────────────────────────────────────┘")

    return {
        "burned_kcal":      round(total_burned),
        "adjustment_kcal":  adjustment,
        "exercises":        log,
    }


# Bonus calórico por entrenar hoy (pre-fuel) según intensidad
TODAY_BONUS_KCAL = {
    "1": 150,  # caminar suave
    "2": 200,  # caminar rápido
    "3": 200,  # pesas ligera
    "4": 300,  # pesas moderada
    "5": 400,  # pesas alta
    "6": 300,  # calistenia moderada
    "7": 450,  # calistenia alta
}

# Mapeo de tipo de ejercicio a etiqueta de timing
TODAY_TIMING = {
    "1": "cardio", "2": "cardio",
    "3": "fuerza", "4": "fuerza", "5": "fuerza",
    "6": "fuerza", "7": "fuerza",
}


def ask_today_training(weight_kg: float) -> dict:
    """
    Pregunta si el usuario entrena HOY y qué tipo/duración.
    Devuelve dict con bonus_kcal y tipo de entrenamiento para timing.
    """
    print("\n  ┌─ ENTRENAMIENTO DE HOY ─────────────────┐")
    resp = input("  │  ¿Entrenas hoy? (s/n): ").strip().lower()
    if resp != "s":
        print("  └────────────────────────────────────────┘")
        return {"bonus_kcal": 0, "training_type": None, "exercise_key": None}

    print("\n  Tipo de entrenamiento de hoy:")
    for key, ex in EXERCISES.items():
        print(f"    {key}. {ex['name']}")
    while True:
        choice = input("\n  Elige (1-7): ").strip()
        if choice in EXERCISES:
            break
        print("  ⚠ Opción no válida.")

    bonus = TODAY_BONUS_KCAL.get(choice, 250)
    ttype = TODAY_TIMING.get(choice, "fuerza")
    print(f"  → +{bonus} kcal añadidas al objetivo de hoy (pre-fuel)")
    print("  └────────────────────────────────────────┘")
    return {"bonus_kcal": bonus, "training_type": ttype, "exercise_key": choice}


def print_exercise_summary(data: dict) -> None:
    if not data["exercises"]:
        print("  Ayer: día de descanso — sin ajuste calórico.")
        return
    print("\n  Ejercicio de ayer:")
    for ex in data["exercises"]:
        print(f"    • {ex['name']}  {ex['minutes']} min  →  {ex['kcal']} kcal")
    print(f"  Total quemado:   {data['burned_kcal']} kcal")
    print(f"  Ajuste aplicado: +{data['adjustment_kcal']} kcal")
