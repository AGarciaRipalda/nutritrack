"""
Mifflin-St. Jeor BMR + TDEE + Macro calculator.

Modo adaptativo:
  - Base diaria = BMR × 1.2 (sedentario) para evitar doble conteo con el
    ejercicio real registrado el día anterior.
  - El TDEE con factor de actividad se muestra solo como referencia semanal.
"""

ACTIVITY_LEVELS = {
    1: ("Sedentario",          "Poco o ningún ejercicio",                1.2),
    2: ("Ligeramente activo",  "Ejercicio ligero 1-3 días/semana",       1.375),
    3: ("Moderadamente activo","Ejercicio moderado 3-5 días/semana",     1.55),
    4: ("Muy activo",          "Ejercicio intenso 6-7 días/semana",      1.725),
}

GOAL_ADJUSTMENTS = {
    "lose":     -300,
    "maintain":    0,
    "gain":     +300,
}


def calculate_bmr(gender: str, age: int, height_cm: float, weight_kg: float) -> float:
    """Fórmula Mifflin-St. Jeor."""
    if gender == "male":
        return 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
    else:
        return 10 * weight_kg + 6.25 * height_cm - 5 * age - 161


def calculate_tdee(bmr: float, activity_level: int) -> float:
    """TDEE con factor de actividad semanal (referencia)."""
    factor = ACTIVITY_LEVELS[activity_level][2]
    return bmr * factor


def calculate_daily_target(bmr: float, goal: str, exercise_adjustment: int = 0) -> int:
    """
    Objetivo calórico diario adaptativo:
      Base sedentaria (BMR × 1.2) + ajuste por ejercicio de ayer + ajuste de objetivo.
    Usar siempre esta función para el target real del día.
    """
    base   = bmr * 1.2
    target = base + GOAL_ADJUSTMENTS.get(goal, 0) + exercise_adjustment
    return round(target)


def calculate_macros(weight_kg: float, target_kcal: int) -> dict:
    """
    Calcula macros a partir de las kcal objetivo.
    Proteína y grasa fijas por peso; carbohidratos cubren el resto.
    """
    protein_g    = weight_kg * 2.0          # 4 kcal/g
    fat_g        = weight_kg * 0.8          # 9 kcal/g
    protein_kcal = protein_g * 4
    fat_kcal     = fat_g * 9
    carb_kcal    = target_kcal - protein_kcal - fat_kcal
    carb_g       = max(carb_kcal / 4, 0)

    return {
        "target_kcal": target_kcal,
        "protein_g":   round(protein_g),
        "fat_g":       round(fat_g),
        "carb_g":      round(carb_g),
    }


def print_nutrition_report(profile: dict, exercise_data: dict = None) -> None:
    gender   = profile["gender"]
    age      = profile["age"]
    height   = profile["height_cm"]
    weight   = profile["weight_kg"]
    activity = profile["activity_level"]
    goal     = profile["goal"]

    exercise_data    = exercise_data or {"burned_kcal": 0, "adjustment_kcal": 0, "exercises": []}
    exercise_adj     = exercise_data.get("adjustment_kcal", 0)

    bmr          = calculate_bmr(gender, age, height, weight)
    tdee_ref     = calculate_tdee(bmr, activity)          # referencia semanal
    daily_target = calculate_daily_target(bmr, goal, exercise_adj)
    macros       = calculate_macros(weight, daily_target)

    activity_name = ACTIVITY_LEVELS[activity][0]
    goal_labels   = {"lose": "Perder peso", "maintain": "Mantener peso", "gain": "Ganar músculo"}

    print("\n" + "="*52)
    print("  REPORTE NUTRICIONAL")
    print("="*52)
    print(f"  Género:       {'Hombre' if gender == 'male' else 'Mujer'}")
    print(f"  Edad:         {age} años")
    print(f"  Altura:       {height} cm")
    print(f"  Peso:         {weight} kg")
    print(f"  Actividad:    {activity_name}")
    print(f"  Objetivo:     {goal_labels.get(goal, goal)}")
    print("-"*52)
    print(f"  TMB (BMR):    {round(bmr)} kcal/día")
    print(f"  TDEE ref.:    {round(tdee_ref)} kcal/día  (media semanal)")
    print("-"*52)
    print(f"  Base sedent.: {round(bmr * 1.2)} kcal")
    if exercise_adj > 0:
        print(f"  + Ejercicio ayer ({int(exercise_data['burned_kcal'])} kcal × 60%): +{exercise_adj} kcal")
    else:
        print(f"  + Ejercicio ayer: descanso (0 kcal)")
    print(f"  + Ajuste objetivo ({goal}): {GOAL_ADJUSTMENTS.get(goal, 0):+} kcal")
    print(f"  {'─'*36}")
    print(f"  OBJETIVO HOY: {daily_target} kcal/día")
    print("-"*52)
    print(f"  Proteínas:     {macros['protein_g']} g  ({macros['protein_g']*4} kcal)")
    print(f"  Grasas:        {macros['fat_g']} g  ({macros['fat_g']*9} kcal)")
    print(f"  Carbohidratos: {macros['carb_g']} g  ({macros['carb_g']*4} kcal)")
    print("="*52)
