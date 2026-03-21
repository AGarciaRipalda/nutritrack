"""
Generador de rutinas de entrenamiento.
  - Pesas: Push/Pull/Legs (PPL) para >= 4 días, Full Body para <= 3 días.
  - Calistenia: Principiante / Intermedio / Avanzado, con equipamiento configurable.
"""

FULL_BODY_ROUTINE = [
    {
        "name": "Sentadilla",
        "sets": "4x6-8",
        "muscles": "Cuádriceps, Glúteos, Core"
    },
    {
        "name": "Press de Banca",
        "sets": "4x6-8",
        "muscles": "Pecho, Hombros, Tríceps"
    },
    {
        "name": "Peso Muerto Rumano",
        "sets": "3x8-10",
        "muscles": "Isquiotibiales, Glúteos, Espalda baja"
    },
    {
        "name": "Remo con Barra",
        "sets": "4x6-8",
        "muscles": "Dorsales, Bíceps, Core"
    },
    {
        "name": "Press Militar (Barra)",
        "sets": "3x8-10",
        "muscles": "Hombros, Tríceps"
    },
    {
        "name": "Dominadas / Jalón al Pecho",
        "sets": "3x8-10",
        "muscles": "Dorsales, Bíceps"
    },
]

PPL_ROUTINE = {
    "Push (Empuje)": [
        {"name": "Press de Banca",          "sets": "4x6-8",  "muscles": "Pecho, Hombros ant., Tríceps"},
        {"name": "Press Inclinado Mancuernas","sets": "3x8-10","muscles": "Pecho superior"},
        {"name": "Press Militar Barra",      "sets": "4x6-8",  "muscles": "Hombros, Tríceps"},
        {"name": "Elevaciones Laterales",    "sets": "3x12-15","muscles": "Hombros laterales"},
        {"name": "Fondos en Paralelas",      "sets": "3x8-12", "muscles": "Tríceps, Pecho"},
        {"name": "Extensiones Tríceps Polea","sets": "3x12-15","muscles": "Tríceps"},
    ],
    "Pull (Jalón)": [
        {"name": "Peso Muerto Convencional", "sets": "4x5-6",  "muscles": "Cadena posterior completa"},
        {"name": "Dominadas",                "sets": "4x6-10", "muscles": "Dorsales, Bíceps"},
        {"name": "Remo con Barra",           "sets": "4x6-8",  "muscles": "Dorsales, Trapecios, Bíceps"},
        {"name": "Remo en Polea Baja",       "sets": "3x10-12","muscles": "Dorsales, Romboides"},
        {"name": "Curl Bíceps con Barra",    "sets": "3x8-12", "muscles": "Bíceps"},
        {"name": "Curl Martillo",            "sets": "3x10-12","muscles": "Bíceps, Braquial"},
    ],
    "Legs (Piernas)": [
        {"name": "Sentadilla con Barra",     "sets": "4x6-8",  "muscles": "Cuádriceps, Glúteos, Core"},
        {"name": "Prensa de Piernas",        "sets": "4x8-10", "muscles": "Cuádriceps, Glúteos"},
        {"name": "Peso Muerto Rumano",       "sets": "4x8-10", "muscles": "Isquiotibiales, Glúteos"},
        {"name": "Zancadas con Mancuernas",  "sets": "3x10-12","muscles": "Cuádriceps, Glúteos"},
        {"name": "Curl Femoral Tumbado",     "sets": "3x10-12","muscles": "Isquiotibiales"},
        {"name": "Elevaciones de Talón",     "sets": "4x12-15","muscles": "Gemelos"},
    ],
}

def _print_exercise_table(exercises: list) -> None:
    print(f"  {'Ejercicio':<30} {'Series x Reps':<15} Músculos")
    print("  " + "-"*75)
    for ex in exercises:
        print(f"  {ex['name']:<30} {ex['sets']:<15} {ex['muscles']}")

def generate_routine(days: int, weight_kg: float) -> None:
    print("\n" + "="*50)
    print(f"  RUTINA DE ENTRENAMIENTO — {days} días/semana")
    print("="*50)

    if days <= 3:
        print(f"  Tipo: FULL BODY ({days}x/semana)")
        print(f"  Nota: Descansa al menos 1 día entre sesiones.\n")
        for day in range(1, days + 1):
            print(f"  --- Día {day} (Full Body) ---")
            _print_exercise_table(FULL_BODY_ROUTINE)
            print()
    else:
        # PPL: 4d → Push/Pull/Legs/Legs, 5d → Push/Pull/Legs/Push/Pull, 6d → PPL PPL
        day_plan = _build_ppl_plan(days)
        print(f"  Tipo: PUSH / PULL / LEGS ({days}x/semana)")
        print(f"  Plan semanal: {' | '.join(day_plan)}\n")
        shown = set()
        for i, session in enumerate(day_plan, 1):
            print(f"  --- Día {i}: {session} ---")
            if session not in shown:
                _print_exercise_table(PPL_ROUTINE[session])
                shown.add(session)
            else:
                print("  (mismos ejercicios que la sesión anterior de este bloque)")
            print()

    print(f"  Sugerencia de proteína post-entrenamiento: {round(weight_kg * 0.3)} g")
    print("="*50)

def _build_ppl_plan(days: int) -> list:
    keys = list(PPL_ROUTINE.keys())  # Push, Pull, Legs
    if days == 4:
        return [keys[0], keys[1], keys[2], keys[2]]
    elif days == 5:
        return [keys[0], keys[1], keys[2], keys[0], keys[1]]
    else:  # 6
        return keys + keys


# ─── Calistenia ───────────────────────────────────────────────────────────────

# Equipamiento: "suelo" siempre disponible, "barra" y "paralelas" opcionales.
# Nivel: "principiante", "intermedio", "avanzado"

CALISTENIA = {
    # ── EMPUJE (Pecho, Hombros, Tríceps) ──────────────────────────────────
    "Empuje": {
        "principiante": [
            {"name": "Flexiones (rodillas si es necesario)", "sets": "4x8-12",  "muscles": "Pecho, Tríceps, Hombros ant.", "equip": "suelo"},
            {"name": "Pike Push-up",                         "sets": "3x8-10",  "muscles": "Hombros, Tríceps",             "equip": "suelo"},
            {"name": "Fondos en banco/silla",                "sets": "3x10-15", "muscles": "Tríceps, Pecho",               "equip": "suelo"},
            {"name": "Flexiones inclinadas (manos en alto)", "sets": "3x10-12", "muscles": "Pecho inferior, Tríceps",      "equip": "suelo"},
            {"name": "Fondos en paralelas",                  "sets": "3x6-10",  "muscles": "Tríceps, Pecho",               "equip": "paralelas"},
        ],
        "intermedio": [
            {"name": "Flexiones arquero",                    "sets": "4x6-10/lado", "muscles": "Pecho unilateral, Tríceps",     "equip": "suelo"},
            {"name": "Flexiones con palmada (explosive)",    "sets": "3x6-8",       "muscles": "Pecho, Potencia",               "equip": "suelo"},
            {"name": "Pseudo planche push-up",               "sets": "3x6-8",       "muscles": "Pecho, Hombros, Core",          "equip": "suelo"},
            {"name": "Pike Push-up elevado (pies en alto)",  "sets": "3x8-10",      "muscles": "Hombros, Tríceps",              "equip": "suelo"},
            {"name": "Fondos en paralelas",                  "sets": "4x8-12",      "muscles": "Tríceps, Pecho",                "equip": "paralelas"},
            {"name": "Fondos en paralelas lastrados",        "sets": "3x6-8",       "muscles": "Tríceps, Pecho",                "equip": "paralelas"},
        ],
        "avanzado": [
            {"name": "Flexiones de pino asistidas (pared)",  "sets": "4x5-8",   "muscles": "Hombros, Tríceps, Core",        "equip": "suelo"},
            {"name": "Flexiones de pino libre",              "sets": "3x3-6",   "muscles": "Hombros, Tríceps, Equilibrio",  "equip": "suelo"},
            {"name": "Planche push-up (progresión)",         "sets": "3x3-5",   "muscles": "Pecho, Hombros, Core",          "equip": "suelo"},
            {"name": "Fondos en paralelas con peso corporal inclinado", "sets": "4x6-10", "muscles": "Pecho bajo, Tríceps", "equip": "paralelas"},
            {"name": "Ring dips",                            "sets": "4x6-10",  "muscles": "Tríceps, Pecho, Estabilidad",   "equip": "paralelas"},
        ],
    },

    # ── JALÓN (Espalda, Bíceps) ───────────────────────────────────────────
    "Jalón": {
        "principiante": [
            {"name": "Remo australiano (barra baja o mesa)",  "sets": "4x8-12",  "muscles": "Dorsales, Bíceps, Romboides", "equip": "suelo"},
            {"name": "Dead hang (colgado estático)",           "sets": "3x20-30s","muscles": "Agarre, Dorsales",           "equip": "barra"},
            {"name": "Dominadas negativas (bajada lenta 5s)",  "sets": "3x4-6",   "muscles": "Dorsales, Bíceps",           "equip": "barra"},
            {"name": "Chin-up asistida (con banda elástica)",  "sets": "3x6-8",   "muscles": "Dorsales, Bíceps",           "equip": "barra"},
        ],
        "intermedio": [
            {"name": "Dominadas agarre prono",                 "sets": "4x6-10",  "muscles": "Dorsales, Bíceps",           "equip": "barra"},
            {"name": "Chin-up agarre supino",                  "sets": "4x6-10",  "muscles": "Bíceps, Dorsales",           "equip": "barra"},
            {"name": "Dominadas agarre neutro",                "sets": "3x8-10",  "muscles": "Dorsales, Braquial",         "equip": "barra"},
            {"name": "Remo australiano pies elevados",         "sets": "3x8-12",  "muscles": "Dorsales, Romboides",        "equip": "suelo"},
            {"name": "L-sit pull-up",                          "sets": "3x4-6",   "muscles": "Dorsales, Core",             "equip": "barra"},
        ],
        "avanzado": [
            {"name": "Dominadas lastradas",                    "sets": "4x5-8",   "muscles": "Dorsales, Bíceps",           "equip": "barra"},
            {"name": "Muscle-up",                              "sets": "3x3-5",   "muscles": "Dorsales, Tríceps, Pecho",   "equip": "barra"},
            {"name": "Dominadas arquero",                      "sets": "3x4-6/lado","muscles": "Dorsales unilateral",      "equip": "barra"},
            {"name": "Back lever (progresión tuck/straddle)",  "sets": "3x8-12s", "muscles": "Dorsales, Core posterior",   "equip": "barra"},
            {"name": "Front lever remo",                       "sets": "3x3-5",   "muscles": "Dorsales, Core, Bíceps",     "equip": "barra"},
        ],
    },

    # ── PIERNAS ───────────────────────────────────────────────────────────
    "Piernas": {
        "principiante": [
            {"name": "Sentadilla",                             "sets": "4x15-20", "muscles": "Cuádriceps, Glúteos, Core",  "equip": "suelo"},
            {"name": "Zancadas alternadas",                    "sets": "3x10-12/pierna","muscles": "Cuádriceps, Glúteos",  "equip": "suelo"},
            {"name": "Sentadilla sumo",                        "sets": "3x15-20", "muscles": "Glúteos, Isquios, Aductores","equip": "suelo"},
            {"name": "Glute bridge",                           "sets": "3x15-20", "muscles": "Glúteos, Isquios",           "equip": "suelo"},
            {"name": "Elevación de talón unipodal",            "sets": "3x15-20", "muscles": "Gemelos",                    "equip": "suelo"},
        ],
        "intermedio": [
            {"name": "Bulgarian split squat",                  "sets": "4x10-12/pierna","muscles": "Cuádriceps, Glúteos", "equip": "suelo"},
            {"name": "Pistol squat asistida (TRX/árbol)",      "sets": "3x6-8/pierna","muscles": "Cuádriceps, Glúteos",   "equip": "suelo"},
            {"name": "Sentadilla explosiva (jump squat)",       "sets": "3x10-12", "muscles": "Cuádriceps, Glúteos, Potencia","equip": "suelo"},
            {"name": "Nordic curl (isquios excéntrico)",        "sets": "3x4-6",   "muscles": "Isquiotibiales",             "equip": "suelo"},
            {"name": "Hip thrust unipodal",                    "sets": "3x12-15/pierna","muscles": "Glúteos",             "equip": "suelo"},
        ],
        "avanzado": [
            {"name": "Pistol squat",                           "sets": "4x6-8/pierna","muscles": "Cuádriceps, Glúteos, Equilibrio","equip": "suelo"},
            {"name": "Shrimp squat",                           "sets": "3x5-8/pierna","muscles": "Cuádriceps, Equilibrio","equip": "suelo"},
            {"name": "Box jump + sentadilla aterrizaje",        "sets": "3x8-10",  "muscles": "Explosividad, Cuádriceps",   "equip": "suelo"},
            {"name": "Nordic curl completo",                   "sets": "4x5-8",   "muscles": "Isquiotibiales",             "equip": "suelo"},
            {"name": "Elevación de talón lastrada",            "sets": "4x15-20", "muscles": "Gemelos",                    "equip": "suelo"},
        ],
    },

    # ── CORE ──────────────────────────────────────────────────────────────
    "Core": {
        "principiante": [
            {"name": "Plancha frontal",                        "sets": "3x30-45s","muscles": "Core completo",              "equip": "suelo"},
            {"name": "Plancha lateral",                        "sets": "3x20-30s/lado","muscles": "Oblicuos, Core",        "equip": "suelo"},
            {"name": "Elevaciones de rodillas tumbado",        "sets": "3x15-20", "muscles": "Abdomen bajo",               "equip": "suelo"},
            {"name": "Hollow body hold",                       "sets": "3x20-30s","muscles": "Core, Abdomen",              "equip": "suelo"},
            {"name": "Superman hold",                          "sets": "3x15-20s","muscles": "Espalda baja, Glúteos",      "equip": "suelo"},
        ],
        "intermedio": [
            {"name": "Elevaciones de piernas colgado",         "sets": "3x10-15", "muscles": "Abdomen bajo, Flexores cadera","equip": "barra"},
            {"name": "L-sit en suelo (paralelas/sillas)",       "sets": "3x15-20s","muscles": "Core, Cuádriceps, Tríceps", "equip": "suelo"},
            {"name": "Dragon flag negativo",                   "sets": "3x4-6",   "muscles": "Core completo",              "equip": "suelo"},
            {"name": "Planche lean",                           "sets": "3x20-30s","muscles": "Hombros, Core",              "equip": "suelo"},
            {"name": "Windshield wipers (colgado)",            "sets": "3x8-10/lado","muscles": "Oblicuos, Core",          "equip": "barra"},
        ],
        "avanzado": [
            {"name": "L-sit completo (paralelas)",             "sets": "3x20-30s","muscles": "Core, Cuádriceps",           "equip": "paralelas"},
            {"name": "Dragon flag completo",                   "sets": "3x4-6",   "muscles": "Core completo",              "equip": "suelo"},
            {"name": "Front lever hold (tuck/straddle/full)",  "sets": "3x8-15s", "muscles": "Core, Dorsales",             "equip": "barra"},
            {"name": "Human flag (progresión)",                "sets": "3x5-10s", "muscles": "Oblicuos, Hombros, Core",    "equip": "barra"},
            {"name": "V-sit",                                  "sets": "3x15-20s","muscles": "Core, Flexores cadera",      "equip": "suelo"},
        ],
    },
}

# Planes semanales de calistenia (bloques a rotar por días)
CALISTENIA_PLANS = {
    2: [["Empuje", "Core"], ["Jalón", "Piernas"]],
    3: [["Empuje", "Core"], ["Jalón", "Piernas"], ["Empuje", "Jalón"]],
    4: [["Empuje", "Core"], ["Jalón", "Piernas"], ["Empuje", "Core"], ["Jalón", "Piernas"]],
    5: [["Empuje", "Core"], ["Jalón", "Piernas"], ["Empuje"], ["Jalón", "Core"], ["Piernas"]],
}


def _filter_exercises(exercises: list, has_barra: bool, has_paralelas: bool) -> list:
    result = []
    for ex in exercises:
        e = ex["equip"]
        if e == "suelo":
            result.append(ex)
        elif e == "barra" and has_barra:
            result.append(ex)
        elif e == "paralelas" and has_paralelas:
            result.append(ex)
    return result


def generate_calistenia_routine(days: int, weight_kg: float) -> None:
    print("\n" + "="*56)
    print("  GENERADOR DE RUTINA DE CALISTENIA")
    print("="*56)

    # Nivel
    print("\n  Nivel:")
    print("    1. Principiante  (empezando o < 6 meses)")
    print("    2. Intermedio    (6 meses – 2 años)")
    print("    3. Avanzado      (> 2 años)")
    level_map = {"1": "principiante", "2": "intermedio", "3": "avanzado"}
    level_choice = input("  Elige nivel (1-3) [2]: ").strip() or "2"
    level = level_map.get(level_choice, "intermedio")

    # Equipamiento
    print("\n  Equipamiento disponible en el parque:")
    has_barra      = input("  ¿Hay barra de dominadas? (s/n) [s]: ").strip().lower() != "n"
    has_paralelas  = input("  ¿Hay barras paralelas? (s/n) [s]: ").strip().lower() != "n"

    # Plan semanal
    if days < 2:
        days = 2
    if days > 5:
        days = 5
    plan = CALISTENIA_PLANS.get(days, CALISTENIA_PLANS[3])

    print(f"\n{'='*56}")
    print(f"  RUTINA CALISTENIA — {level.upper()} — {days} días/semana")
    equip_str = "suelo"
    if has_barra:     equip_str += " + barra"
    if has_paralelas: equip_str += " + paralelas"
    print(f"  Equipamiento: {equip_str}")
    print(f"{'='*56}")

    for day_num, blocks in enumerate(plan, 1):
        print(f"\n  ── Día {day_num}: {' + '.join(blocks)} ──")
        for block in blocks:
            exercises = CALISTENIA[block].get(level, [])
            exercises = _filter_exercises(exercises, has_barra, has_paralelas)
            if not exercises:
                print(f"\n  {block}: (sin ejercicios disponibles con tu equipamiento)")
                continue
            print(f"\n  [{block}]")
            print(f"  {'Ejercicio':<40} {'Series':<18} Músculos")
            print("  " + "-"*85)
            for ex in exercises:
                name = ex["name"]
                # Acortar nombre si es muy largo
                if len(name) > 38:
                    name = name[:36] + ".."
                print(f"  {name:<40} {ex['sets']:<18} {ex['muscles']}")

    print(f"\n{'─'*56}")
    print(f"  Proteína recomendada post-entreno: {round(weight_kg * 0.3)} g")
    print("  Descanso entre series: 90-120 seg (fuerza) / 45-60 seg (resistencia)")
    print("  Progresión: cuando domines las reps, busca la siguiente variación.")
    print(f"{'='*56}")
