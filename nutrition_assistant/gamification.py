"""
Sistema de gamificación — calcula XP acumulado y nivel del usuario
a partir de los datos existentes (ejercicio, adherencia, peso, encuestas).

Soporte multi-usuario: user_id opcional en todas las funciones.
"""

import json
import os
from datetime import date
from pathlib import Path
from data_dir import DATA_DIR

# ── Niveles ───────────────────────────────────────────────────────────────────

LEVELS = [
    {"level": 1, "name": "Principiante",  "xp_required": 0},
    {"level": 2, "name": "Constante",     "xp_required": 200},
    {"level": 3, "name": "Atleta",        "xp_required": 500},
    {"level": 4, "name": "Dedicado",      "xp_required": 1_000},
    {"level": 5, "name": "Élite",         "xp_required": 2_000},
    {"level": 6, "name": "Leyenda",       "xp_required": 4_000},
]

# ── XP por acción ─────────────────────────────────────────────────────────────

XP_TRAINING        = 20   # día con ejercicio registrado
XP_TRAINING_HEALTH =  5   # bonus si la fuente incluye apple_health
XP_DIET_DAY        = 15   # día con adherencia >= 80 %
XP_COMBO           = 10   # mismo día: dieta + ejercicio
XP_WEIGHT_CHECKIN  = 10   # registro de peso
XP_SURVEY          = 30   # encuesta semanal completada
XP_STREAK_WEEK     = 50   # por cada bloque de 7 días consecutivos entrenados


# ── Helpers ───────────────────────────────────────────────────────────────────

def _user_dir(user_id: str | None) -> Path:
    if user_id:
        d = DATA_DIR / user_id
        d.mkdir(parents=True, exist_ok=True)
        return d
    return DATA_DIR


def _load_file(path) -> dict | list:
    if not os.path.exists(path):
        return {}
    with open(path, encoding="utf-8") as f:
        return json.load(f)


# ── Cálculo de XP ─────────────────────────────────────────────────────────────

def compute_xp(user_id: str | None = None) -> dict:
    base = _user_dir(user_id)
    exercise_history = _load_file(base / "exercise_history.json")
    adherence_log    = _load_file(base / "adherence_log.json")
    weight_history   = _load_file(base / "weight_history.json")
    surveys          = _load_file(base / "survey_history.json")

    xp = 0
    breakdown = {
        "training": 0,
        "diet":     0,
        "combo":    0,
        "weight":   0,
        "surveys":  0,
        "streak":   0,
    }

    # ── Ejercicio ─────────────────────────────────────────────────────────────
    trained_dates: set[str] = set()

    if isinstance(exercise_history, dict):
        for day_str, entry in exercise_history.items():
            if entry.get("burned_kcal", 0) > 0:
                trained_dates.add(day_str)
                xp += XP_TRAINING
                breakdown["training"] += XP_TRAINING
                sources = entry.get("sources", [])
                if not sources and entry.get("source"):
                    sources = [entry["source"]]
                if "apple_health" in sources:
                    xp += XP_TRAINING_HEALTH
                    breakdown["training"] += XP_TRAINING_HEALTH

    # ── Dieta ─────────────────────────────────────────────────────────────────
    diet_days: set[str] = set()

    if isinstance(adherence_log, dict):
        for day_str, entry in adherence_log.items():
            if entry.get("pct", 0) >= 80:
                diet_days.add(day_str)
                xp += XP_DIET_DAY
                breakdown["diet"] += XP_DIET_DAY

    # ── Combo ─────────────────────────────────────────────────────────────────
    for day_str in trained_dates & diet_days:
        xp += XP_COMBO
        breakdown["combo"] += XP_COMBO

    # ── Peso ──────────────────────────────────────────────────────────────────
    if isinstance(weight_history, list):
        for _ in weight_history:
            xp += XP_WEIGHT_CHECKIN
            breakdown["weight"] += XP_WEIGHT_CHECKIN

    # ── Encuestas ─────────────────────────────────────────────────────────────
    if isinstance(surveys, list):
        for _ in surveys:
            xp += XP_SURVEY
            breakdown["surveys"] += XP_SURVEY

    # ── Bonus de racha (bloques de 7 días consecutivos) ───────────────────────
    if trained_dates:
        sorted_dates = sorted(trained_dates)
        streak = 1
        completed_weeks = 0
        for i in range(1, len(sorted_dates)):
            d1 = date.fromisoformat(sorted_dates[i - 1])
            d2 = date.fromisoformat(sorted_dates[i])
            if (d2 - d1).days == 1:
                streak += 1
                if streak % 7 == 0:
                    completed_weeks += 1
            else:
                streak = 1
        streak_xp = completed_weeks * XP_STREAK_WEEK
        xp += streak_xp
        breakdown["streak"] = streak_xp

    return {"total_xp": xp, "breakdown": breakdown}


def get_level_info(xp: int) -> dict:
    current    = LEVELS[0]
    next_level = None

    for i, lvl in enumerate(LEVELS):
        if xp >= lvl["xp_required"]:
            current    = lvl
            next_level = LEVELS[i + 1] if i + 1 < len(LEVELS) else None
        else:
            break

    if next_level:
        xp_in_level  = xp - current["xp_required"]
        xp_needed    = next_level["xp_required"] - current["xp_required"]
        progress_pct = round(xp_in_level / xp_needed * 100)
    else:
        xp_in_level  = xp - current["xp_required"]
        xp_needed    = 0
        progress_pct = 100

    return {
        "level":            current["level"],
        "name":             current["name"],
        "xp":               xp,
        "xp_in_level":      xp_in_level,
        "xp_to_next":       next_level["xp_required"] - xp if next_level else 0,
        "xp_next_level":    next_level["xp_required"] if next_level else xp,
        "progress_pct":     progress_pct,
        "is_max_level":     next_level is None,
        "next_level_name":  next_level["name"] if next_level else None,
    }


def gamification_status(user_id: str | None = None) -> dict:
    result     = compute_xp(user_id)
    level_info = get_level_info(result["total_xp"])
    return {**level_info, "breakdown": result["breakdown"]}
