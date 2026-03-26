"""
Exercise Library — 200+ exercises with muscle groups, equipment and category.
Used by the workout system for exercise selection, PR tracking and analytics.
"""

from typing import TypedDict, List, Optional

class ExerciseEntry(TypedDict):
    id: str
    name: str
    muscle_primary: str
    muscle_secondary: List[str]
    equipment: str
    category: str          # fuerza | cardio | flexibilidad | pliometria
    force: str             # push | pull | isometric | compound | cardio

# ── LIBRARY ──────────────────────────────────────────────────────────────────

EXERCISE_LIBRARY: dict[str, ExerciseEntry] = {

    # ═══════════════════════════════════════════════════════════════════
    # PECHO
    # ═══════════════════════════════════════════════════════════════════
    "bench_press": {
        "id": "bench_press", "name": "Press de banca",
        "muscle_primary": "pecho", "muscle_secondary": ["hombros", "triceps"],
        "equipment": "barra", "category": "fuerza", "force": "push",
    },
    "incline_bench_press": {
        "id": "incline_bench_press", "name": "Press inclinado con barra",
        "muscle_primary": "pecho", "muscle_secondary": ["hombros", "triceps"],
        "equipment": "barra", "category": "fuerza", "force": "push",
    },
    "decline_bench_press": {
        "id": "decline_bench_press", "name": "Press declinado con barra",
        "muscle_primary": "pecho", "muscle_secondary": ["triceps"],
        "equipment": "barra", "category": "fuerza", "force": "push",
    },
    "db_bench_press": {
        "id": "db_bench_press", "name": "Press de banca con mancuernas",
        "muscle_primary": "pecho", "muscle_secondary": ["hombros", "triceps"],
        "equipment": "mancuernas", "category": "fuerza", "force": "push",
    },
    "db_incline_press": {
        "id": "db_incline_press", "name": "Press inclinado con mancuernas",
        "muscle_primary": "pecho", "muscle_secondary": ["hombros", "triceps"],
        "equipment": "mancuernas", "category": "fuerza", "force": "push",
    },
    "db_fly": {
        "id": "db_fly", "name": "Aperturas con mancuernas",
        "muscle_primary": "pecho", "muscle_secondary": [],
        "equipment": "mancuernas", "category": "fuerza", "force": "push",
    },
    "incline_db_fly": {
        "id": "incline_db_fly", "name": "Aperturas inclinadas con mancuernas",
        "muscle_primary": "pecho", "muscle_secondary": ["hombros"],
        "equipment": "mancuernas", "category": "fuerza", "force": "push",
    },
    "cable_fly": {
        "id": "cable_fly", "name": "Cruces en polea",
        "muscle_primary": "pecho", "muscle_secondary": [],
        "equipment": "cable", "category": "fuerza", "force": "push",
    },
    "cable_fly_low": {
        "id": "cable_fly_low", "name": "Cruces en polea baja",
        "muscle_primary": "pecho", "muscle_secondary": ["hombros"],
        "equipment": "cable", "category": "fuerza", "force": "push",
    },
    "machine_chest_press": {
        "id": "machine_chest_press", "name": "Press de pecho en máquina",
        "muscle_primary": "pecho", "muscle_secondary": ["triceps"],
        "equipment": "maquina", "category": "fuerza", "force": "push",
    },
    "pec_deck": {
        "id": "pec_deck", "name": "Pec deck (mariposa)",
        "muscle_primary": "pecho", "muscle_secondary": [],
        "equipment": "maquina", "category": "fuerza", "force": "push",
    },
    "push_up": {
        "id": "push_up", "name": "Flexiones",
        "muscle_primary": "pecho", "muscle_secondary": ["hombros", "triceps", "core"],
        "equipment": "peso_corporal", "category": "fuerza", "force": "push",
    },
    "dips_chest": {
        "id": "dips_chest", "name": "Fondos (pecho)",
        "muscle_primary": "pecho", "muscle_secondary": ["triceps", "hombros"],
        "equipment": "peso_corporal", "category": "fuerza", "force": "push",
    },
    "smith_bench_press": {
        "id": "smith_bench_press", "name": "Press de banca en Smith",
        "muscle_primary": "pecho", "muscle_secondary": ["hombros", "triceps"],
        "equipment": "smith", "category": "fuerza", "force": "push",
    },
    "landmine_press": {
        "id": "landmine_press", "name": "Landmine press",
        "muscle_primary": "pecho", "muscle_secondary": ["hombros", "triceps"],
        "equipment": "barra", "category": "fuerza", "force": "push",
    },

    # ═══════════════════════════════════════════════════════════════════
    # ESPALDA
    # ═══════════════════════════════════════════════════════════════════
    "deadlift": {
        "id": "deadlift", "name": "Peso muerto convencional",
        "muscle_primary": "espalda", "muscle_secondary": ["isquiotibiales", "gluteos", "core", "trapecio"],
        "equipment": "barra", "category": "fuerza", "force": "pull",
    },
    "sumo_deadlift": {
        "id": "sumo_deadlift", "name": "Peso muerto sumo",
        "muscle_primary": "espalda", "muscle_secondary": ["isquiotibiales", "gluteos", "aductores"],
        "equipment": "barra", "category": "fuerza", "force": "pull",
    },
    "barbell_row": {
        "id": "barbell_row", "name": "Remo con barra",
        "muscle_primary": "espalda", "muscle_secondary": ["biceps", "trapecio"],
        "equipment": "barra", "category": "fuerza", "force": "pull",
    },
    "pendlay_row": {
        "id": "pendlay_row", "name": "Remo Pendlay",
        "muscle_primary": "espalda", "muscle_secondary": ["biceps", "trapecio"],
        "equipment": "barra", "category": "fuerza", "force": "pull",
    },
    "db_row": {
        "id": "db_row", "name": "Remo con mancuerna",
        "muscle_primary": "espalda", "muscle_secondary": ["biceps"],
        "equipment": "mancuernas", "category": "fuerza", "force": "pull",
    },
    "pull_up": {
        "id": "pull_up", "name": "Dominadas",
        "muscle_primary": "espalda", "muscle_secondary": ["biceps", "core"],
        "equipment": "peso_corporal", "category": "fuerza", "force": "pull",
    },
    "chin_up": {
        "id": "chin_up", "name": "Dominadas supinas",
        "muscle_primary": "espalda", "muscle_secondary": ["biceps"],
        "equipment": "peso_corporal", "category": "fuerza", "force": "pull",
    },
    "lat_pulldown": {
        "id": "lat_pulldown", "name": "Jalón al pecho",
        "muscle_primary": "espalda", "muscle_secondary": ["biceps"],
        "equipment": "cable", "category": "fuerza", "force": "pull",
    },
    "close_grip_pulldown": {
        "id": "close_grip_pulldown", "name": "Jalón agarre cerrado",
        "muscle_primary": "espalda", "muscle_secondary": ["biceps"],
        "equipment": "cable", "category": "fuerza", "force": "pull",
    },
    "cable_row_seated": {
        "id": "cable_row_seated", "name": "Remo sentado en polea",
        "muscle_primary": "espalda", "muscle_secondary": ["biceps", "trapecio"],
        "equipment": "cable", "category": "fuerza", "force": "pull",
    },
    "t_bar_row": {
        "id": "t_bar_row", "name": "Remo en T",
        "muscle_primary": "espalda", "muscle_secondary": ["biceps", "trapecio"],
        "equipment": "barra", "category": "fuerza", "force": "pull",
    },
    "machine_row": {
        "id": "machine_row", "name": "Remo en máquina",
        "muscle_primary": "espalda", "muscle_secondary": ["biceps"],
        "equipment": "maquina", "category": "fuerza", "force": "pull",
    },
    "inverted_row": {
        "id": "inverted_row", "name": "Remo invertido",
        "muscle_primary": "espalda", "muscle_secondary": ["biceps", "core"],
        "equipment": "peso_corporal", "category": "fuerza", "force": "pull",
    },
    "straight_arm_pulldown": {
        "id": "straight_arm_pulldown", "name": "Pulldown brazos rectos",
        "muscle_primary": "espalda", "muscle_secondary": [],
        "equipment": "cable", "category": "fuerza", "force": "pull",
    },
    "rack_pull": {
        "id": "rack_pull", "name": "Rack pull",
        "muscle_primary": "espalda", "muscle_secondary": ["trapecio", "gluteos"],
        "equipment": "barra", "category": "fuerza", "force": "pull",
    },
    "hyperextension": {
        "id": "hyperextension", "name": "Hiperextensiones",
        "muscle_primary": "espalda", "muscle_secondary": ["gluteos", "isquiotibiales"],
        "equipment": "peso_corporal", "category": "fuerza", "force": "pull",
    },

    # ═══════════════════════════════════════════════════════════════════
    # HOMBROS
    # ═══════════════════════════════════════════════════════════════════
    "overhead_press": {
        "id": "overhead_press", "name": "Press militar con barra",
        "muscle_primary": "hombros", "muscle_secondary": ["triceps", "core"],
        "equipment": "barra", "category": "fuerza", "force": "push",
    },
    "db_shoulder_press": {
        "id": "db_shoulder_press", "name": "Press de hombros con mancuernas",
        "muscle_primary": "hombros", "muscle_secondary": ["triceps"],
        "equipment": "mancuernas", "category": "fuerza", "force": "push",
    },
    "arnold_press": {
        "id": "arnold_press", "name": "Press Arnold",
        "muscle_primary": "hombros", "muscle_secondary": ["triceps"],
        "equipment": "mancuernas", "category": "fuerza", "force": "push",
    },
    "lateral_raise": {
        "id": "lateral_raise", "name": "Elevaciones laterales",
        "muscle_primary": "hombros", "muscle_secondary": [],
        "equipment": "mancuernas", "category": "fuerza", "force": "push",
    },
    "cable_lateral_raise": {
        "id": "cable_lateral_raise", "name": "Elevaciones laterales en polea",
        "muscle_primary": "hombros", "muscle_secondary": [],
        "equipment": "cable", "category": "fuerza", "force": "push",
    },
    "front_raise": {
        "id": "front_raise", "name": "Elevaciones frontales",
        "muscle_primary": "hombros", "muscle_secondary": [],
        "equipment": "mancuernas", "category": "fuerza", "force": "push",
    },
    "rear_delt_fly": {
        "id": "rear_delt_fly", "name": "Pájaros (deltoides posterior)",
        "muscle_primary": "hombros", "muscle_secondary": ["trapecio"],
        "equipment": "mancuernas", "category": "fuerza", "force": "pull",
    },
    "face_pull": {
        "id": "face_pull", "name": "Face pull",
        "muscle_primary": "hombros", "muscle_secondary": ["trapecio"],
        "equipment": "cable", "category": "fuerza", "force": "pull",
    },
    "machine_shoulder_press": {
        "id": "machine_shoulder_press", "name": "Press de hombros en máquina",
        "muscle_primary": "hombros", "muscle_secondary": ["triceps"],
        "equipment": "maquina", "category": "fuerza", "force": "push",
    },
    "upright_row": {
        "id": "upright_row", "name": "Remo al mentón",
        "muscle_primary": "hombros", "muscle_secondary": ["trapecio"],
        "equipment": "barra", "category": "fuerza", "force": "pull",
    },
    "machine_lateral_raise": {
        "id": "machine_lateral_raise", "name": "Elevaciones laterales en máquina",
        "muscle_primary": "hombros", "muscle_secondary": [],
        "equipment": "maquina", "category": "fuerza", "force": "push",
    },
    "pike_push_up": {
        "id": "pike_push_up", "name": "Flexiones en pica",
        "muscle_primary": "hombros", "muscle_secondary": ["triceps", "core"],
        "equipment": "peso_corporal", "category": "fuerza", "force": "push",
    },
    "handstand_push_up": {
        "id": "handstand_push_up", "name": "Flexiones en vertical",
        "muscle_primary": "hombros", "muscle_secondary": ["triceps", "core"],
        "equipment": "peso_corporal", "category": "fuerza", "force": "push",
    },

    # ═══════════════════════════════════════════════════════════════════
    # BICEPS
    # ═══════════════════════════════════════════════════════════════════
    "barbell_curl": {
        "id": "barbell_curl", "name": "Curl con barra",
        "muscle_primary": "biceps", "muscle_secondary": ["antebrazo"],
        "equipment": "barra", "category": "fuerza", "force": "pull",
    },
    "ez_curl": {
        "id": "ez_curl", "name": "Curl con barra EZ",
        "muscle_primary": "biceps", "muscle_secondary": ["antebrazo"],
        "equipment": "barra_ez", "category": "fuerza", "force": "pull",
    },
    "db_curl": {
        "id": "db_curl", "name": "Curl con mancuernas",
        "muscle_primary": "biceps", "muscle_secondary": ["antebrazo"],
        "equipment": "mancuernas", "category": "fuerza", "force": "pull",
    },
    "hammer_curl": {
        "id": "hammer_curl", "name": "Curl martillo",
        "muscle_primary": "biceps", "muscle_secondary": ["antebrazo"],
        "equipment": "mancuernas", "category": "fuerza", "force": "pull",
    },
    "incline_db_curl": {
        "id": "incline_db_curl", "name": "Curl inclinado con mancuernas",
        "muscle_primary": "biceps", "muscle_secondary": [],
        "equipment": "mancuernas", "category": "fuerza", "force": "pull",
    },
    "preacher_curl": {
        "id": "preacher_curl", "name": "Curl en banco Scott",
        "muscle_primary": "biceps", "muscle_secondary": [],
        "equipment": "barra_ez", "category": "fuerza", "force": "pull",
    },
    "cable_curl": {
        "id": "cable_curl", "name": "Curl en polea",
        "muscle_primary": "biceps", "muscle_secondary": [],
        "equipment": "cable", "category": "fuerza", "force": "pull",
    },
    "concentration_curl": {
        "id": "concentration_curl", "name": "Curl concentrado",
        "muscle_primary": "biceps", "muscle_secondary": [],
        "equipment": "mancuernas", "category": "fuerza", "force": "pull",
    },
    "spider_curl": {
        "id": "spider_curl", "name": "Spider curl",
        "muscle_primary": "biceps", "muscle_secondary": [],
        "equipment": "mancuernas", "category": "fuerza", "force": "pull",
    },
    "machine_curl": {
        "id": "machine_curl", "name": "Curl en máquina",
        "muscle_primary": "biceps", "muscle_secondary": [],
        "equipment": "maquina", "category": "fuerza", "force": "pull",
    },

    # ═══════════════════════════════════════════════════════════════════
    # TRICEPS
    # ═══════════════════════════════════════════════════════════════════
    "close_grip_bench": {
        "id": "close_grip_bench", "name": "Press de banca agarre cerrado",
        "muscle_primary": "triceps", "muscle_secondary": ["pecho"],
        "equipment": "barra", "category": "fuerza", "force": "push",
    },
    "tricep_pushdown": {
        "id": "tricep_pushdown", "name": "Extensión de tríceps en polea",
        "muscle_primary": "triceps", "muscle_secondary": [],
        "equipment": "cable", "category": "fuerza", "force": "push",
    },
    "rope_pushdown": {
        "id": "rope_pushdown", "name": "Extensión con cuerda en polea",
        "muscle_primary": "triceps", "muscle_secondary": [],
        "equipment": "cable", "category": "fuerza", "force": "push",
    },
    "overhead_tricep_extension": {
        "id": "overhead_tricep_extension", "name": "Extensión de tríceps sobre la cabeza",
        "muscle_primary": "triceps", "muscle_secondary": [],
        "equipment": "mancuernas", "category": "fuerza", "force": "push",
    },
    "skull_crusher": {
        "id": "skull_crusher", "name": "Rompecráneos",
        "muscle_primary": "triceps", "muscle_secondary": [],
        "equipment": "barra_ez", "category": "fuerza", "force": "push",
    },
    "dips_tricep": {
        "id": "dips_tricep", "name": "Fondos (tríceps)",
        "muscle_primary": "triceps", "muscle_secondary": ["pecho", "hombros"],
        "equipment": "peso_corporal", "category": "fuerza", "force": "push",
    },
    "kickback": {
        "id": "kickback", "name": "Kickback con mancuerna",
        "muscle_primary": "triceps", "muscle_secondary": [],
        "equipment": "mancuernas", "category": "fuerza", "force": "push",
    },
    "diamond_push_up": {
        "id": "diamond_push_up", "name": "Flexiones diamante",
        "muscle_primary": "triceps", "muscle_secondary": ["pecho"],
        "equipment": "peso_corporal", "category": "fuerza", "force": "push",
    },
    "cable_overhead_extension": {
        "id": "cable_overhead_extension", "name": "Extensión sobre cabeza en polea",
        "muscle_primary": "triceps", "muscle_secondary": [],
        "equipment": "cable", "category": "fuerza", "force": "push",
    },

    # ═══════════════════════════════════════════════════════════════════
    # CUADRICEPS / PIERNAS ANTERIOR
    # ═══════════════════════════════════════════════════════════════════
    "squat": {
        "id": "squat", "name": "Sentadilla con barra",
        "muscle_primary": "cuadriceps", "muscle_secondary": ["gluteos", "core", "isquiotibiales"],
        "equipment": "barra", "category": "fuerza", "force": "compound",
    },
    "front_squat": {
        "id": "front_squat", "name": "Sentadilla frontal",
        "muscle_primary": "cuadriceps", "muscle_secondary": ["gluteos", "core"],
        "equipment": "barra", "category": "fuerza", "force": "compound",
    },
    "goblet_squat": {
        "id": "goblet_squat", "name": "Sentadilla goblet",
        "muscle_primary": "cuadriceps", "muscle_secondary": ["gluteos", "core"],
        "equipment": "kettlebell", "category": "fuerza", "force": "compound",
    },
    "leg_press": {
        "id": "leg_press", "name": "Prensa de piernas",
        "muscle_primary": "cuadriceps", "muscle_secondary": ["gluteos"],
        "equipment": "maquina", "category": "fuerza", "force": "push",
    },
    "hack_squat": {
        "id": "hack_squat", "name": "Hack squat",
        "muscle_primary": "cuadriceps", "muscle_secondary": ["gluteos"],
        "equipment": "maquina", "category": "fuerza", "force": "push",
    },
    "leg_extension": {
        "id": "leg_extension", "name": "Extensión de cuádriceps",
        "muscle_primary": "cuadriceps", "muscle_secondary": [],
        "equipment": "maquina", "category": "fuerza", "force": "push",
    },
    "bulgarian_split_squat": {
        "id": "bulgarian_split_squat", "name": "Sentadilla búlgara",
        "muscle_primary": "cuadriceps", "muscle_secondary": ["gluteos"],
        "equipment": "mancuernas", "category": "fuerza", "force": "compound",
    },
    "lunge": {
        "id": "lunge", "name": "Zancadas",
        "muscle_primary": "cuadriceps", "muscle_secondary": ["gluteos"],
        "equipment": "mancuernas", "category": "fuerza", "force": "compound",
    },
    "walking_lunge": {
        "id": "walking_lunge", "name": "Zancadas caminando",
        "muscle_primary": "cuadriceps", "muscle_secondary": ["gluteos"],
        "equipment": "mancuernas", "category": "fuerza", "force": "compound",
    },
    "smith_squat": {
        "id": "smith_squat", "name": "Sentadilla en Smith",
        "muscle_primary": "cuadriceps", "muscle_secondary": ["gluteos"],
        "equipment": "smith", "category": "fuerza", "force": "compound",
    },
    "pistol_squat": {
        "id": "pistol_squat", "name": "Sentadilla a una pierna (pistol)",
        "muscle_primary": "cuadriceps", "muscle_secondary": ["gluteos", "core"],
        "equipment": "peso_corporal", "category": "fuerza", "force": "compound",
    },
    "sissy_squat": {
        "id": "sissy_squat", "name": "Sissy squat",
        "muscle_primary": "cuadriceps", "muscle_secondary": [],
        "equipment": "peso_corporal", "category": "fuerza", "force": "push",
    },
    "step_up": {
        "id": "step_up", "name": "Step-up con mancuernas",
        "muscle_primary": "cuadriceps", "muscle_secondary": ["gluteos"],
        "equipment": "mancuernas", "category": "fuerza", "force": "compound",
    },

    # ═══════════════════════════════════════════════════════════════════
    # ISQUIOTIBIALES / PIERNAS POSTERIOR
    # ═══════════════════════════════════════════════════════════════════
    "romanian_deadlift": {
        "id": "romanian_deadlift", "name": "Peso muerto rumano",
        "muscle_primary": "isquiotibiales", "muscle_secondary": ["gluteos", "espalda"],
        "equipment": "barra", "category": "fuerza", "force": "pull",
    },
    "db_romanian_deadlift": {
        "id": "db_romanian_deadlift", "name": "Peso muerto rumano con mancuernas",
        "muscle_primary": "isquiotibiales", "muscle_secondary": ["gluteos"],
        "equipment": "mancuernas", "category": "fuerza", "force": "pull",
    },
    "leg_curl_lying": {
        "id": "leg_curl_lying", "name": "Curl femoral tumbado",
        "muscle_primary": "isquiotibiales", "muscle_secondary": [],
        "equipment": "maquina", "category": "fuerza", "force": "pull",
    },
    "leg_curl_seated": {
        "id": "leg_curl_seated", "name": "Curl femoral sentado",
        "muscle_primary": "isquiotibiales", "muscle_secondary": [],
        "equipment": "maquina", "category": "fuerza", "force": "pull",
    },
    "stiff_leg_deadlift": {
        "id": "stiff_leg_deadlift", "name": "Peso muerto piernas rígidas",
        "muscle_primary": "isquiotibiales", "muscle_secondary": ["gluteos", "espalda"],
        "equipment": "barra", "category": "fuerza", "force": "pull",
    },
    "good_morning": {
        "id": "good_morning", "name": "Buenos días con barra",
        "muscle_primary": "isquiotibiales", "muscle_secondary": ["gluteos", "espalda"],
        "equipment": "barra", "category": "fuerza", "force": "pull",
    },
    "nordic_curl": {
        "id": "nordic_curl", "name": "Nordic curl",
        "muscle_primary": "isquiotibiales", "muscle_secondary": [],
        "equipment": "peso_corporal", "category": "fuerza", "force": "pull",
    },
    "single_leg_deadlift": {
        "id": "single_leg_deadlift", "name": "Peso muerto a una pierna",
        "muscle_primary": "isquiotibiales", "muscle_secondary": ["gluteos", "core"],
        "equipment": "mancuernas", "category": "fuerza", "force": "pull",
    },

    # ═══════════════════════════════════════════════════════════════════
    # GLUTEOS
    # ═══════════════════════════════════════════════════════════════════
    "hip_thrust": {
        "id": "hip_thrust", "name": "Hip thrust",
        "muscle_primary": "gluteos", "muscle_secondary": ["isquiotibiales"],
        "equipment": "barra", "category": "fuerza", "force": "push",
    },
    "glute_bridge": {
        "id": "glute_bridge", "name": "Puente de glúteos",
        "muscle_primary": "gluteos", "muscle_secondary": ["isquiotibiales"],
        "equipment": "peso_corporal", "category": "fuerza", "force": "push",
    },
    "cable_kickback": {
        "id": "cable_kickback", "name": "Kickback de glúteo en polea",
        "muscle_primary": "gluteos", "muscle_secondary": [],
        "equipment": "cable", "category": "fuerza", "force": "push",
    },
    "hip_abduction": {
        "id": "hip_abduction", "name": "Abducción de cadera en máquina",
        "muscle_primary": "gluteos", "muscle_secondary": ["aductores"],
        "equipment": "maquina", "category": "fuerza", "force": "push",
    },
    "sumo_squat": {
        "id": "sumo_squat", "name": "Sentadilla sumo",
        "muscle_primary": "gluteos", "muscle_secondary": ["cuadriceps", "aductores"],
        "equipment": "mancuernas", "category": "fuerza", "force": "compound",
    },

    # ═══════════════════════════════════════════════════════════════════
    # GEMELOS
    # ═══════════════════════════════════════════════════════════════════
    "standing_calf_raise": {
        "id": "standing_calf_raise", "name": "Elevación de gemelos de pie",
        "muscle_primary": "gemelos", "muscle_secondary": [],
        "equipment": "maquina", "category": "fuerza", "force": "push",
    },
    "seated_calf_raise": {
        "id": "seated_calf_raise", "name": "Elevación de gemelos sentado",
        "muscle_primary": "gemelos", "muscle_secondary": [],
        "equipment": "maquina", "category": "fuerza", "force": "push",
    },
    "db_calf_raise": {
        "id": "db_calf_raise", "name": "Elevación de gemelos con mancuerna",
        "muscle_primary": "gemelos", "muscle_secondary": [],
        "equipment": "mancuernas", "category": "fuerza", "force": "push",
    },
    "leg_press_calf_raise": {
        "id": "leg_press_calf_raise", "name": "Elevación de gemelos en prensa",
        "muscle_primary": "gemelos", "muscle_secondary": [],
        "equipment": "maquina", "category": "fuerza", "force": "push",
    },
    "bodyweight_calf_raise": {
        "id": "bodyweight_calf_raise", "name": "Elevación de gemelos (peso corporal)",
        "muscle_primary": "gemelos", "muscle_secondary": [],
        "equipment": "peso_corporal", "category": "fuerza", "force": "push",
    },

    # ═══════════════════════════════════════════════════════════════════
    # CORE / ABDOMINALES
    # ═══════════════════════════════════════════════════════════════════
    "plank": {
        "id": "plank", "name": "Plancha",
        "muscle_primary": "core", "muscle_secondary": [],
        "equipment": "peso_corporal", "category": "fuerza", "force": "isometric",
    },
    "side_plank": {
        "id": "side_plank", "name": "Plancha lateral",
        "muscle_primary": "core", "muscle_secondary": [],
        "equipment": "peso_corporal", "category": "fuerza", "force": "isometric",
    },
    "crunch": {
        "id": "crunch", "name": "Crunch abdominal",
        "muscle_primary": "core", "muscle_secondary": [],
        "equipment": "peso_corporal", "category": "fuerza", "force": "pull",
    },
    "cable_crunch": {
        "id": "cable_crunch", "name": "Crunch en polea",
        "muscle_primary": "core", "muscle_secondary": [],
        "equipment": "cable", "category": "fuerza", "force": "pull",
    },
    "hanging_leg_raise": {
        "id": "hanging_leg_raise", "name": "Elevación de piernas colgando",
        "muscle_primary": "core", "muscle_secondary": [],
        "equipment": "peso_corporal", "category": "fuerza", "force": "pull",
    },
    "lying_leg_raise": {
        "id": "lying_leg_raise", "name": "Elevación de piernas tumbado",
        "muscle_primary": "core", "muscle_secondary": [],
        "equipment": "peso_corporal", "category": "fuerza", "force": "pull",
    },
    "ab_wheel": {
        "id": "ab_wheel", "name": "Rueda abdominal",
        "muscle_primary": "core", "muscle_secondary": ["hombros"],
        "equipment": "ninguno", "category": "fuerza", "force": "pull",
    },
    "russian_twist": {
        "id": "russian_twist", "name": "Giros rusos",
        "muscle_primary": "core", "muscle_secondary": [],
        "equipment": "peso_corporal", "category": "fuerza", "force": "pull",
    },
    "mountain_climbers": {
        "id": "mountain_climbers", "name": "Mountain climbers",
        "muscle_primary": "core", "muscle_secondary": ["hombros"],
        "equipment": "peso_corporal", "category": "pliometria", "force": "compound",
    },
    "dead_bug": {
        "id": "dead_bug", "name": "Dead bug",
        "muscle_primary": "core", "muscle_secondary": [],
        "equipment": "peso_corporal", "category": "fuerza", "force": "isometric",
    },
    "woodchop": {
        "id": "woodchop", "name": "Leñador en polea",
        "muscle_primary": "core", "muscle_secondary": ["hombros"],
        "equipment": "cable", "category": "fuerza", "force": "pull",
    },
    "pallof_press": {
        "id": "pallof_press", "name": "Pallof press",
        "muscle_primary": "core", "muscle_secondary": [],
        "equipment": "cable", "category": "fuerza", "force": "isometric",
    },
    "decline_sit_up": {
        "id": "decline_sit_up", "name": "Sit-up declinado",
        "muscle_primary": "core", "muscle_secondary": [],
        "equipment": "peso_corporal", "category": "fuerza", "force": "pull",
    },
    "dragon_flag": {
        "id": "dragon_flag", "name": "Dragon flag",
        "muscle_primary": "core", "muscle_secondary": [],
        "equipment": "peso_corporal", "category": "fuerza", "force": "isometric",
    },
    "l_sit": {
        "id": "l_sit", "name": "L-sit",
        "muscle_primary": "core", "muscle_secondary": ["cuadriceps"],
        "equipment": "peso_corporal", "category": "fuerza", "force": "isometric",
    },

    # ═══════════════════════════════════════════════════════════════════
    # TRAPECIO / CUELLO
    # ═══════════════════════════════════════════════════════════════════
    "barbell_shrug": {
        "id": "barbell_shrug", "name": "Encogimientos con barra",
        "muscle_primary": "trapecio", "muscle_secondary": [],
        "equipment": "barra", "category": "fuerza", "force": "pull",
    },
    "db_shrug": {
        "id": "db_shrug", "name": "Encogimientos con mancuernas",
        "muscle_primary": "trapecio", "muscle_secondary": [],
        "equipment": "mancuernas", "category": "fuerza", "force": "pull",
    },
    "farmer_walk": {
        "id": "farmer_walk", "name": "Paseo del granjero",
        "muscle_primary": "trapecio", "muscle_secondary": ["antebrazo", "core"],
        "equipment": "mancuernas", "category": "fuerza", "force": "isometric",
    },

    # ═══════════════════════════════════════════════════════════════════
    # ANTEBRAZO
    # ═══════════════════════════════════════════════════════════════════
    "wrist_curl": {
        "id": "wrist_curl", "name": "Curl de muñeca",
        "muscle_primary": "antebrazo", "muscle_secondary": [],
        "equipment": "barra", "category": "fuerza", "force": "pull",
    },
    "reverse_wrist_curl": {
        "id": "reverse_wrist_curl", "name": "Curl de muñeca inverso",
        "muscle_primary": "antebrazo", "muscle_secondary": [],
        "equipment": "barra", "category": "fuerza", "force": "pull",
    },
    "reverse_curl": {
        "id": "reverse_curl", "name": "Curl inverso",
        "muscle_primary": "antebrazo", "muscle_secondary": ["biceps"],
        "equipment": "barra_ez", "category": "fuerza", "force": "pull",
    },

    # ═══════════════════════════════════════════════════════════════════
    # CARDIO
    # ═══════════════════════════════════════════════════════════════════
    "running": {
        "id": "running", "name": "Correr",
        "muscle_primary": "cardio", "muscle_secondary": ["cuadriceps", "gemelos"],
        "equipment": "ninguno", "category": "cardio", "force": "cardio",
    },
    "treadmill": {
        "id": "treadmill", "name": "Cinta de correr",
        "muscle_primary": "cardio", "muscle_secondary": ["cuadriceps"],
        "equipment": "maquina", "category": "cardio", "force": "cardio",
    },
    "cycling": {
        "id": "cycling", "name": "Ciclismo",
        "muscle_primary": "cardio", "muscle_secondary": ["cuadriceps", "gemelos"],
        "equipment": "ninguno", "category": "cardio", "force": "cardio",
    },
    "stationary_bike": {
        "id": "stationary_bike", "name": "Bicicleta estática",
        "muscle_primary": "cardio", "muscle_secondary": ["cuadriceps"],
        "equipment": "maquina", "category": "cardio", "force": "cardio",
    },
    "elliptical": {
        "id": "elliptical", "name": "Elíptica",
        "muscle_primary": "cardio", "muscle_secondary": ["cuadriceps", "gluteos"],
        "equipment": "maquina", "category": "cardio", "force": "cardio",
    },
    "rowing_machine": {
        "id": "rowing_machine", "name": "Remo (máquina)",
        "muscle_primary": "cardio", "muscle_secondary": ["espalda", "biceps", "cuadriceps"],
        "equipment": "maquina", "category": "cardio", "force": "cardio",
    },
    "swimming": {
        "id": "swimming", "name": "Natación",
        "muscle_primary": "cardio", "muscle_secondary": ["espalda", "hombros"],
        "equipment": "ninguno", "category": "cardio", "force": "cardio",
    },
    "jump_rope": {
        "id": "jump_rope", "name": "Saltar la cuerda",
        "muscle_primary": "cardio", "muscle_secondary": ["gemelos"],
        "equipment": "ninguno", "category": "cardio", "force": "cardio",
    },
    "stair_climber": {
        "id": "stair_climber", "name": "Escaladora",
        "muscle_primary": "cardio", "muscle_secondary": ["cuadriceps", "gluteos"],
        "equipment": "maquina", "category": "cardio", "force": "cardio",
    },
    "walking": {
        "id": "walking", "name": "Caminar",
        "muscle_primary": "cardio", "muscle_secondary": [],
        "equipment": "ninguno", "category": "cardio", "force": "cardio",
    },
    "hiking": {
        "id": "hiking", "name": "Senderismo",
        "muscle_primary": "cardio", "muscle_secondary": ["cuadriceps", "gluteos"],
        "equipment": "ninguno", "category": "cardio", "force": "cardio",
    },
    "battle_ropes": {
        "id": "battle_ropes", "name": "Battle ropes",
        "muscle_primary": "cardio", "muscle_secondary": ["hombros", "core"],
        "equipment": "ninguno", "category": "cardio", "force": "cardio",
    },

    # ═══════════════════════════════════════════════════════════════════
    # CUERPO COMPLETO / COMPUESTOS
    # ═══════════════════════════════════════════════════════════════════
    "clean_and_press": {
        "id": "clean_and_press", "name": "Cargada y press",
        "muscle_primary": "cuerpo_completo", "muscle_secondary": ["hombros", "cuadriceps", "espalda"],
        "equipment": "barra", "category": "fuerza", "force": "compound",
    },
    "power_clean": {
        "id": "power_clean", "name": "Power clean",
        "muscle_primary": "cuerpo_completo", "muscle_secondary": ["espalda", "cuadriceps", "trapecio"],
        "equipment": "barra", "category": "fuerza", "force": "compound",
    },
    "snatch": {
        "id": "snatch", "name": "Arrancada (snatch)",
        "muscle_primary": "cuerpo_completo", "muscle_secondary": ["hombros", "espalda", "cuadriceps"],
        "equipment": "barra", "category": "fuerza", "force": "compound",
    },
    "thruster": {
        "id": "thruster", "name": "Thruster",
        "muscle_primary": "cuerpo_completo", "muscle_secondary": ["cuadriceps", "hombros", "core"],
        "equipment": "barra", "category": "fuerza", "force": "compound",
    },
    "burpee": {
        "id": "burpee", "name": "Burpee",
        "muscle_primary": "cuerpo_completo", "muscle_secondary": ["pecho", "cuadriceps", "core"],
        "equipment": "peso_corporal", "category": "pliometria", "force": "compound",
    },
    "turkish_get_up": {
        "id": "turkish_get_up", "name": "Turkish get-up",
        "muscle_primary": "cuerpo_completo", "muscle_secondary": ["hombros", "core", "cuadriceps"],
        "equipment": "kettlebell", "category": "fuerza", "force": "compound",
    },
    "kb_swing": {
        "id": "kb_swing", "name": "Kettlebell swing",
        "muscle_primary": "cuerpo_completo", "muscle_secondary": ["gluteos", "isquiotibiales", "core"],
        "equipment": "kettlebell", "category": "fuerza", "force": "compound",
    },
    "kb_clean_press": {
        "id": "kb_clean_press", "name": "Kettlebell clean & press",
        "muscle_primary": "cuerpo_completo", "muscle_secondary": ["hombros", "core"],
        "equipment": "kettlebell", "category": "fuerza", "force": "compound",
    },
    "man_maker": {
        "id": "man_maker", "name": "Man maker",
        "muscle_primary": "cuerpo_completo", "muscle_secondary": ["pecho", "hombros", "espalda"],
        "equipment": "mancuernas", "category": "fuerza", "force": "compound",
    },
    "box_jump": {
        "id": "box_jump", "name": "Salto al cajón",
        "muscle_primary": "cuerpo_completo", "muscle_secondary": ["cuadriceps", "gluteos"],
        "equipment": "ninguno", "category": "pliometria", "force": "compound",
    },

    # ═══════════════════════════════════════════════════════════════════
    # FLEXIBILIDAD / MOVILIDAD
    # ═══════════════════════════════════════════════════════════════════
    "yoga": {
        "id": "yoga", "name": "Yoga",
        "muscle_primary": "cuerpo_completo", "muscle_secondary": ["core"],
        "equipment": "ninguno", "category": "flexibilidad", "force": "isometric",
    },
    "stretching": {
        "id": "stretching", "name": "Estiramientos",
        "muscle_primary": "cuerpo_completo", "muscle_secondary": [],
        "equipment": "ninguno", "category": "flexibilidad", "force": "isometric",
    },
    "foam_rolling": {
        "id": "foam_rolling", "name": "Foam rolling",
        "muscle_primary": "cuerpo_completo", "muscle_secondary": [],
        "equipment": "ninguno", "category": "flexibilidad", "force": "isometric",
    },

    # ═══════════════════════════════════════════════════════════════════
    # ADUCTORES
    # ═══════════════════════════════════════════════════════════════════
    "hip_adduction": {
        "id": "hip_adduction", "name": "Aducción de cadera en máquina",
        "muscle_primary": "aductores", "muscle_secondary": [],
        "equipment": "maquina", "category": "fuerza", "force": "push",
    },
    "copenhagen_plank": {
        "id": "copenhagen_plank", "name": "Plancha Copenhagen",
        "muscle_primary": "aductores", "muscle_secondary": ["core"],
        "equipment": "peso_corporal", "category": "fuerza", "force": "isometric",
    },
}


# ── Helpers ──────────────────────────────────────────────────────────────────

MUSCLE_LABELS: dict[str, str] = {
    "pecho": "Pecho", "espalda": "Espalda", "hombros": "Hombros",
    "biceps": "Bíceps", "triceps": "Tríceps", "antebrazo": "Antebrazo",
    "core": "Core", "cuadriceps": "Cuádriceps", "isquiotibiales": "Isquiotibiales",
    "gluteos": "Glúteos", "gemelos": "Gemelos", "aductores": "Aductores",
    "trapecio": "Trapecio", "cardio": "Cardio", "cuerpo_completo": "Cuerpo completo",
}

EQUIPMENT_LABELS: dict[str, str] = {
    "barra": "Barra", "mancuernas": "Mancuernas", "maquina": "Máquina",
    "cable": "Cable/Polea", "peso_corporal": "Peso corporal",
    "kettlebell": "Kettlebell", "banda_elastica": "Banda elástica",
    "barra_ez": "Barra EZ", "polea": "Polea", "smith": "Smith",
    "trx": "TRX", "ninguno": "Ninguno",
}


def get_exercise(exercise_id: str) -> Optional[ExerciseEntry]:
    return EXERCISE_LIBRARY.get(exercise_id)


def search_exercises(
    query: str = "",
    muscle: str = "",
    equipment: str = "",
    category: str = "",
) -> list[ExerciseEntry]:
    """Filter exercises by search query, muscle, equipment and/or category."""
    results = list(EXERCISE_LIBRARY.values())

    if query:
        q = query.lower()
        results = [e for e in results if q in e["name"].lower() or q in e["id"]]

    if muscle:
        results = [
            e for e in results
            if e["muscle_primary"] == muscle or muscle in e["muscle_secondary"]
        ]

    if equipment:
        results = [e for e in results if e["equipment"] == equipment]

    if category:
        results = [e for e in results if e["category"] == category]

    return results


def list_muscles() -> list[dict]:
    return [{"id": k, "label": v} for k, v in MUSCLE_LABELS.items()]


def list_equipment() -> list[dict]:
    return [{"id": k, "label": v} for k, v in EQUIPMENT_LABELS.items()]
