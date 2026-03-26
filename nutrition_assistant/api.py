"""
FastAPI backend para el Asistente de Nutrición y Entrenamiento.
Ejecutar con: uvicorn api:app --reload
Documentación automática en: http://localhost:8000/docs
"""

import os, json
from datetime import date, timedelta
from typing import Optional, List
import zoneinfo

# Fijar el directorio de trabajo al directorio del script
# (necesario para que los módulos Python locales se importen correctamente)
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.dirname(os.path.abspath(__file__)))

import tempfile
import urllib.request
import urllib.parse

from fastapi import FastAPI, HTTPException, Request, Header, Query
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, model_validator

# ── Módulos del proyecto ──────────────────────────────────────────────────────
from storage import (
    load_profile, save_profile, load_session, save_session,
    load_weekly_history, save_weekly_history,
)
from calculator import (
    calculate_bmr, calculate_tdee, calculate_daily_target,
    calculate_macros, ACTIVITY_LEVELS, GOAL_ADJUSTMENTS,
)
from diet import (
    generate_week_plan, get_day_from_plan,
    regenerate_meal, FAVORITE_CARBS,
)
from exercise_log import (
    EXERCISES, RECOVERY_FACTOR, TODAY_BONUS_KCAL, TODAY_TIMING,
    calculate_exercise_kcal,
)
from exercise_history import record_today, HISTORY_FILE as EX_HISTORY_FILE, _load as _load_ex_history
from weight_tracker import (
    HISTORY_FILE as W_HISTORY_FILE, EXPECTED_WEEKLY_CHANGE, needs_weigh_in,
    _load as load_weight_history, _save as save_weight_history,
)
from adherence import ADHERENCE_FILE, weekly_adherence, _load as _load_adh_log
from weekly_survey import (
    needs_survey, last_survey_scores,
    _load as load_surveys, _save as save_surveys, QUESTIONS,
)
from weekly_report import (
    _last_week_exercise, _weight_change, _recommendation,
    needs_weekly_report, mark_report_shown,
)
from competition_planner import (
    get_event, days_to_event, COMPETITION_FILE, event_calorie_adjustment,
)
from preferences import (
    _load as load_prefs, _save as save_prefs,
    load_excluded, load_favorites,
)
from shopping_list import build_shopping_list
from training import (
    FULL_BODY_ROUTINE, PPL_ROUTINE, CALISTENIA, CALISTENIA_PLANS,
    _build_ppl_plan, _filter_exercises,
)
from gamification import gamification_status
from pdf_export import export_week_plan_pdf

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Nutrition Assistant API",
    description="Backend para el asistente de nutrición y entrenamiento",
    version="1.0.0",
origins = [
    "http://localhost:3000",      # Tu Next.js en el PC
    "capacitor://localhost",      # Tu App en el iPhone (iOS)
    "http://localhost",            # Tu App en Android
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,         # Deja pasar a los de la lista
    allow_credentials=True,
    allow_methods=["*"],           # Permite GET, POST, PUT, DELETE...
    allow_headers=["*"],           # Permite cualquier cabecera (auth, etc)
)

# ── Helpers para acceso a datos (delegan a módulos DB-aware) ─────────────────
_cache: dict = {}


def _load_exercise_history_data() -> dict:
    """Carga historial de ejercicio usando el módulo DB-aware."""
    return _load_ex_history()


def _load_adherence_data() -> dict:
    """Carga log de adherencia usando el módulo DB-aware."""
    return _load_adh_log()


def _get_session():
    return load_session()


def _get_today_for_tz(tz_header: str | None) -> str:
    """Return today's ISO date string in the user's timezone. Falls back to UTC."""
    # Empty or unrecognized timezone → fall back to UTC, log warning
    try:
        tz = zoneinfo.ZoneInfo(tz_header) if tz_header else zoneinfo.ZoneInfo("UTC")
    except Exception:
        import warnings
        warnings.warn(f"Unrecognized timezone '{tz_header}', falling back to UTC")
        tz = zoneinfo.ZoneInfo("UTC")
    from datetime import datetime
    return datetime.now(tz=tz).date().isoformat()


def _get_week_start_for_tz(tz_header: str | None) -> str:
    """Return the most recent week-start day in the user's timezone.

    week_start_day comes from the profile (0=Monday … 6=Sunday).
    Example: if week_start_day=3 (Thursday) and today is Wednesday the 19th,
    the current week started on Thursday the 13th.
    """
    from datetime import datetime, timedelta
    try:
        tz = zoneinfo.ZoneInfo(tz_header) if tz_header else zoneinfo.ZoneInfo("UTC")
    except Exception:
        tz = zoneinfo.ZoneInfo("UTC")
    today = datetime.now(tz=tz).date()
    week_start_day = load_profile().get("week_start_day", 0)
    days_since_start = (today.weekday() - week_start_day) % 7
    return (today - timedelta(days=days_since_start)).isoformat()


def _is_stale(plan: dict, tz_header: str | None) -> bool:
    """True when plan.generated_at is from a previous week cycle."""
    current_week_start = _get_week_start_for_tz(tz_header)
    # Empty or missing generated_at ("") < any date string is True —
    # treats missing plan as stale, which is intentional.
    return plan.get("generated_at", "") < current_week_start


# ══════════════════════════════════════════════════════════════════════════════
# MODELOS PYDANTIC
# ══════════════════════════════════════════════════════════════════════════════

class ProfileModel(BaseModel):
    name: str
    gender: str           # "male" | "female"
    age: int
    height_cm: int
    weight_kg: float
    activity_level: int   # 1-4
    goal: str             # "lose" | "maintain" | "gain"
    week_start_day: int = 0  # 0=Monday … 6=Sunday


class ExerciseEntryModel(BaseModel):
    exercise_key: str     # "1"-"7"
    minutes: int


class YesterdayExerciseModel(BaseModel):
    rested: bool
    entries: Optional[List[ExerciseEntryModel]] = []


class ExerciseLogByDateModel(BaseModel):
    date: str                                      # ISO format YYYY-MM-DD
    rested: bool
    entries: Optional[List[ExerciseEntryModel]] = []


class HealthSyncModel(BaseModel):
    date: str                                   # ISO YYYY-MM-DD
    active_calories: Optional[float] = None     # nombre preferido
    burned_kcal: Optional[float] = None         # alias que envía el Shortcut
    workout_type: Optional[str] = None          # "Strength Training", "Running", etc.
    duration_min: Optional[int] = None
    steps: Optional[int] = None
    heart_rate_avg: Optional[int] = None
    heart_rate_max: Optional[int] = None

    @model_validator(mode="after")
    def resolve_calories(self):
        # Acepta burned_kcal como sinónimo de active_calories
        if self.active_calories is None and self.burned_kcal is not None:
            self.active_calories = self.burned_kcal
        if self.active_calories is None:
            raise ValueError("Se requiere 'active_calories' o 'burned_kcal'")
        return self


class TodayTrainingModel(BaseModel):
    trains: bool
    exercise_key: Optional[str] = None   # "1"-"7"
    training_block: Optional[str] = None


class WeightModel(BaseModel):
    weight_kg: float


class SurveyModel(BaseModel):
    energia: int     # 1-5
    hambre: int      # 1-5
    adherencia: int  # 1-5
    sueno: int       # 1-5


class AdherenceModel(BaseModel):
    meals: dict                    # {meal_key: bool}
    kcal_map: dict = {}            # {meal_key: kcal}
    skipped_meals: dict = {}       # {meal_key: {foods: [{name, kcal}]}}


class PreferencesModel(BaseModel):
    excluded: List[str]
    favorites: List[str]
    disliked: List[str]


class EventModel(BaseModel):
    name: str
    date: str    # ISO format YYYY-MM-DD


class RegenerateWeeklyModel(BaseModel):
    apply_from: str = "tomorrow"   # "today" | "tomorrow"


class SwapMealModel(BaseModel):
    meal_id: str


class SwapWeeklyMealModel(BaseModel):
    date:    str   # ISO YYYY-MM-DD
    meal_id: str


# ══════════════════════════════════════════════════════════════════════════════
# PERFIL
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/profile", tags=["Perfil"])
def get_profile():
    return load_profile()


@app.put("/profile", tags=["Perfil"])
def update_profile(data: ProfileModel):
    profile = data.model_dump()
    save_profile(profile)
    return {"ok": True, "profile": profile}


@app.get("/profile/nutrition", tags=["Perfil"])
def get_nutrition(exercise_adj: int = 0):
    """Calcula BMR, TDEE y macros con ajuste de ejercicio opcional."""
    profile = load_profile()
    bmr     = calculate_bmr(profile["gender"], profile["age"],
                            profile["height_cm"], profile["weight_kg"])
    tdee    = calculate_tdee(bmr, profile["activity_level"])
    target  = calculate_daily_target(bmr, profile["goal"], exercise_adj,
                                     activity_level=profile.get("activity_level", 1))
    macros  = calculate_macros(profile["weight_kg"], target, profile["goal"])
    return {
        "bmr":          round(bmr),
        "tdee_ref":     round(tdee),
        "base_sedentary": round(bmr * 1.2),
        "daily_target": target,
        "goal_adjustment": GOAL_ADJUSTMENTS.get(profile["goal"], 0),
        "macros":       macros,
        "activity_level_name": ACTIVITY_LEVELS[profile["activity_level"]][0],
    }


# ══════════════════════════════════════════════════════════════════════════════
# DIETA DEL DÍA
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/diet/today", tags=["Dieta"])
def get_today_diet(x_user_timezone: Optional[str] = Header(None)):
    """Returns today's PlanDay from the weekly plan. Auto-generates plan if needed."""
    session  = _get_session()
    tz       = x_user_timezone
    today    = _get_today_for_tz(tz)

    plan = session.get("week_plan")

    # Auto-generate if no plan exists
    if not plan:
        excluded  = load_excluded()
        favorites = load_favorites()
        history   = session.get("weekly_history", []) or load_weekly_history()
        plan = generate_week_plan(excluded, favorites, _get_daily_target(), history=history or None)
        save_session(week_plan=plan)

    stale         = _is_stale(plan, tz)
    exercise_adj  = dict(session.get("exercise_adj", {}))
    today_training = session.get("today_training") or {}
    bonus_kcal     = today_training.get("bonus_kcal", 0)
    if bonus_kcal:
        existing_extra = exercise_adj.get(today, {}).get("extra_kcal", 0)
        exercise_adj[today] = {
            "extra_kcal": existing_extra + bonus_kcal,
            "source":     "today_training",
        }
    day          = get_day_from_plan(today, plan, exercise_adj)

    if day is None:
        raise HTTPException(
            404,
            {"error": "date_not_in_plan",
             "detail": f"Date {today} is not in the current plan. Regenerate the plan."}
        )

    # Attach persisted adherence state so the frontend can restore it on reload
    adh_log = {}
    if os.path.exists(ADHERENCE_FILE):
        with open(ADHERENCE_FILE) as f:
            adh_log = json.load(f)
    today_adh = adh_log.get(today, {})

    return {
        **day,
        "stale": stale,
        "adherence": {
            "meals":         today_adh.get("meals", {}),
            "skipped_meals": today_adh.get("skipped_meals", {}),
            "consumed_kcal": today_adh.get("consumed_kcal", 0),
        },
    }


@app.post("/diet/today/regenerate", tags=["Dieta"])
def regenerate_today_diet(x_user_timezone: Optional[str] = Header(None)):
    """Regenerates the full weekly plan and returns today's PlanDay."""
    session   = _get_session()
    excluded  = load_excluded()
    favorites = load_favorites()
    history   = load_weekly_history()
    plan = generate_week_plan(excluded, favorites, _get_daily_target(), history=history or None)
    save_session(week_plan=plan)
    today        = _get_today_for_tz(x_user_timezone)
    exercise_adj = session.get("exercise_adj", {})
    day          = get_day_from_plan(today, plan, exercise_adj)
    if day is None:
        raise HTTPException(404, {"error": "date_not_in_plan", "detail": "Regenerated plan does not cover today."})
    return {**day, "stale": False}


@app.post("/diet/today/swap", tags=["Dieta"])
def swap_meal_new(data: SwapMealModel, x_user_timezone: Optional[str] = Header(None)):
    """Swaps a meal in today's plan slot. Returns updated PlanDay."""
    meal_type = data.meal_id
    session   = _get_session()
    plan      = session.get("week_plan")
    if not plan:
        raise HTTPException(404, {"error": "no_plan", "detail": "No weekly plan. Call GET /diet/today first."})

    today = _get_today_for_tz(x_user_timezone)
    days  = plan.get("days", [])
    day_idx = next((i for i, d in enumerate(days) if d["date"] == today), None)
    if day_idx is None:
        raise HTTPException(404, {"error": "date_not_in_plan", "detail": f"No plan for {today}."})

    excluded  = load_excluded()
    favorites = load_favorites()

    # Regenerate that meal slot in the plan day
    today_day = days[day_idx]
    daily_target = plan.get("weekly_target_kcal", 1800)
    updated_day_meals = dict({m["id"]: m for m in today_day["meals"]})

    # Use existing regenerate_meal logic
    flat_day = {"daily_target": daily_target, "meals": updated_day_meals}
    flat_day = regenerate_meal(flat_day, meal_type, excluded, favorites)
    new_meals_dict = flat_day["meals"]

    # Rebuild meals list preserving order
    new_meals_list = [
        {**new_meals_dict[m["id"]], "id": m["id"]}
        if m["id"] in new_meals_dict else m
        for m in today_day["meals"]
    ]
    plan["days"][day_idx] = {
        **today_day,
        "meals":     new_meals_list,
        "totalKcal": sum(m["kcal"] for m in new_meals_list),
    }
    save_session(week_plan=plan)

    # Return the updated PlanDay with exercise_adj applied
    exercise_adj = session.get("exercise_adj", {})
    updated_plan_day = get_day_from_plan(today, plan, exercise_adj)
    return updated_plan_day


@app.post("/diet/today/{meal_type}/swap", tags=["Dieta"], deprecated=True)
def swap_meal_legacy(meal_type: str, x_user_timezone: Optional[str] = Header(None)):
    """Legacy endpoint — use POST /diet/today/swap with JSON body instead."""
    from pydantic import BaseModel as BM
    class _Body(BM):
        meal_id: str = meal_type
    return swap_meal_new(_Body(meal_id=meal_type), x_user_timezone)


# ══════════════════════════════════════════════════════════════════════════════
# PLAN SEMANAL
# ══════════════════════════════════════════════════════════════════════════════

def _get_daily_target() -> int:
    profile  = load_profile()
    bmr      = calculate_bmr(profile["gender"], profile["age"],
                              profile["height_cm"], profile["weight_kg"])
    return calculate_daily_target(bmr, profile["goal"],
                                  activity_level=profile.get("activity_level", 1))


@app.get("/diet/carbs", tags=["Dieta"])
def get_favorite_carbs():
    """Returns the list of swappable carb sources for the UI selector."""
    return {"carbs": FAVORITE_CARBS}


@app.get("/diet/weekly", tags=["Dieta"])
def get_weekly_plan(x_user_timezone: Optional[str] = Header(None)):
    """Returns full weekly plan as { days: PlanDay[], summary, stale }."""
    session = _get_session()
    plan    = session.get("week_plan")
    if not plan:
        excluded  = load_excluded()
        favorites = load_favorites()
        history   = load_weekly_history()
        plan = generate_week_plan(excluded, favorites, _get_daily_target(), history=history or None)
        save_session(week_plan=plan)

    stale        = _is_stale(plan, x_user_timezone)
    exercise_adj = session.get("exercise_adj", {})

    # Apply exercise adjustments to each day
    days_with_adj = []
    for day in plan.get("days", []):
        enriched = get_day_from_plan(day["date"], plan, exercise_adj)
        if enriched:
            days_with_adj.append(enriched)

    return {
        "days":    days_with_adj,
        "summary": plan.get("weekly_summary"),
        "stale":   stale,
    }


@app.post("/diet/weekly/swap", tags=["Dieta"])
def swap_weekly_meal(data: SwapWeeklyMealModel, x_user_timezone: Optional[str] = Header(None)):
    """Cambia una sola comida de cualquier día del plan semanal. Devuelve el PlanDay actualizado."""
    session = _get_session()
    plan    = session.get("week_plan")
    if not plan:
        raise HTTPException(404, {"error": "no_plan", "detail": "No hay plan semanal. Regenera el plan primero."})

    days    = plan.get("days", [])
    day_idx = next((i for i, d in enumerate(days) if d["date"] == data.date), None)
    if day_idx is None:
        raise HTTPException(404, {"error": "date_not_in_plan", "detail": f"No hay plan para {data.date}."})

    excluded  = load_excluded()
    favorites = load_favorites()

    today_day    = days[day_idx]
    daily_target = plan.get("weekly_target_kcal", 1800)

    # Reutiliza la lógica ya existente de regenerate_meal
    flat_day  = {"daily_target": daily_target, "meals": {m["id"]: m for m in today_day["meals"]}}
    flat_day  = regenerate_meal(flat_day, data.meal_id, excluded, favorites)
    new_meals = flat_day["meals"]

    new_meals_list = [
        {**new_meals[m["id"]], "id": m["id"]} if m["id"] in new_meals else m
        for m in today_day["meals"]
    ]
    plan["days"][day_idx] = {
        **today_day,
        "meals":     new_meals_list,
        "totalKcal": sum(m["kcal"] for m in new_meals_list),
    }
    save_session(week_plan=plan)

    exercise_adj  = session.get("exercise_adj", {})
    updated_day   = get_day_from_plan(data.date, plan, exercise_adj)
    return updated_day


@app.post("/diet/weekly/regenerate", tags=["Dieta"])
def regenerate_weekly_plan(
    data: RegenerateWeeklyModel = RegenerateWeeklyModel(),
    x_user_timezone: Optional[str] = Header(None),
):
    """Regenerates part or all of the weekly plan. Returns { days: PlanDay[] }."""
    session   = _get_session()
    excluded  = load_excluded()
    favorites = load_favorites()
    history   = load_weekly_history()

    new_plan = generate_week_plan(excluded, favorites, _get_daily_target(), history=history or None)

    today = _get_today_for_tz(x_user_timezone)
    apply_from = data.apply_from  # "today" or "tomorrow"

    existing_plan = session.get("week_plan")
    if existing_plan and apply_from in ("today", "tomorrow"):
        from datetime import date as _date, timedelta
        cutoff = _date.fromisoformat(today)
        if apply_from == "tomorrow":
            cutoff = cutoff + timedelta(days=1)

        # Keep days BEFORE cutoff from existing plan, take days from cutoff onward from new plan
        old_days_by_date = {d["date"]: d for d in existing_plan.get("days", [])}

        merged_days = []
        for d in new_plan["days"]:
            day_date = _date.fromisoformat(d["date"])
            if day_date < cutoff and d["date"] in old_days_by_date:
                merged_days.append(old_days_by_date[d["date"]])
            else:
                merged_days.append(d)

        # Discard FUTURE exercise_adj if apply_from == "today".
        # Use `k <= today` (not `k < today`) so that today's adjustment is preserved
        # per the spec: "exercise_adj[today] is preserved when apply_from == 'today'".
        exercise_adj = session.get("exercise_adj", {})
        if apply_from == "today":
            exercise_adj = {k: v for k, v in exercise_adj.items() if k <= today}
            save_session(exercise_adj=exercise_adj)

        new_plan["days"] = merged_days

    save_session(week_plan=new_plan)

    exercise_adj = _get_session().get("exercise_adj", {})
    days_with_adj = [
        get_day_from_plan(d["date"], new_plan, exercise_adj)
        for d in new_plan["days"]
        if get_day_from_plan(d["date"], new_plan, exercise_adj) is not None
    ]

    return {"days": days_with_adj}


@app.get("/diet/shopping-list", tags=["Dieta"])
def get_shopping_list():
    """Lista de la compra a partir del plan semanal actual."""
    session = _get_session()
    plan    = session.get("week_plan")
    if not plan:
        excluded  = load_excluded()
        favorites = load_favorites()
        plan = generate_week_plan(excluded, favorites)
        save_session(week_plan=plan)
    shopping = build_shopping_list(plan)
    # Convertir sets a listas para JSON
    return {cat: sorted(items) for cat, items in shopping.items()}


# ══════════════════════════════════════════════════════════════════════════════
# EJERCICIO
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/exercise/types", tags=["Ejercicio"])
def get_exercise_types():
    """Lista de tipos de ejercicio disponibles."""
    return {k: {"name": v["name"], "met": v["met"]} for k, v in EXERCISES.items()}


@app.get("/exercise/yesterday", tags=["Ejercicio"])
def get_yesterday_exercise():
    session = _get_session()
    return session.get("exercise_data") or {"burned_kcal": 0, "adjustment_kcal": 0, "exercises": []}


@app.post("/exercise/yesterday", tags=["Ejercicio"])
def log_yesterday_exercise(data: YesterdayExerciseModel):
    """Registra el ejercicio de ayer y calcula el ajuste calórico."""
    profile = load_profile()
    goal    = profile["goal"]

    if data.rested or not data.entries:
        ex_data = {"burned_kcal": 0, "adjustment_kcal": 0, "exercises": []}
    else:
        total_burned = 0.0
        log = []
        for entry in data.entries:
            ex = EXERCISES.get(entry.exercise_key)
            if not ex:
                raise HTTPException(400, f"Ejercicio '{entry.exercise_key}' no válido")
            kcal = calculate_exercise_kcal(ex["met"], profile["weight_kg"], entry.minutes)
            total_burned += kcal
            log.append({"key": entry.exercise_key, "name": ex["name"],
                         "minutes": entry.minutes, "burned": round(kcal), "kcal": round(kcal)})

        factor = RECOVERY_FACTOR.get(goal, 0.60)
        adj    = round(total_burned * factor)
        ex_data = {
            "burned_kcal":     round(total_burned),
            "adjustment_kcal": adj,
            "exercises":       log,
        }

    save_session(exercise_data=ex_data, adaptive_day=None)
    record_today(ex_data)
    return ex_data


@app.get("/exercise/today-training", tags=["Ejercicio"])
def get_today_training():
    session = _get_session()
    return session.get("today_training") or {"bonus_kcal": 0, "training_type": None, "training_block": None}


@app.post("/exercise/today-training", tags=["Ejercicio"])
def log_today_training(data: TodayTrainingModel):
    """Registra si el usuario entrena hoy y qué tipo."""
    if not data.trains or not data.exercise_key:
        today_data = {"bonus_kcal": 0, "training_type": None, "exercise_key": None, "training_block": None}
    else:
        bonus = TODAY_BONUS_KCAL.get(data.exercise_key, 250)
        ttype = TODAY_TIMING.get(data.exercise_key, "fuerza")
        today_data = {
            "bonus_kcal": bonus,
            "training_type": ttype,
            "exercise_key": data.exercise_key,
            "training_block": data.training_block,
        }

    save_session(today_training=today_data, adaptive_day=None)
    return today_data


@app.get("/exercise/gym-history", tags=["Ejercicio"])
def get_gym_history(days: int = 7):
    """
    Historial de sesiones de gym de los últimos N días leído desde Google Sheets
    (o Excel local como fallback). Incluye ejercicios y kcal estimadas.
    """
    from sheets_parser import get_recent_sessions
    from calorie_estimator import estimate_session_calories

    sessions, source = get_recent_sessions(days=days)

    result = []
    for s in sessions:
        kcal = estimate_session_calories(s)
        result.append({
            "date":      s["date"].isoformat() if s["date"] else None,
            "type":      s["type"],
            "kcal":      round(kcal),
            "exercises": [
                {
                    "name":     ex["name"],
                    "volume":   ex["volume"],
                    "kg_s1":    ex["kg_s1"],
                    "reps_s1":  ex["reps_s1"],
                    "kg_s2":    ex["kg_s2"],
                    "reps_s2":  ex["reps_s2"],
                    "compound": ex["compound"],
                }
                for ex in s["exercises"]
            ],
        })

    # Sincronizar sesiones del gym al exercise_history.json (sin sobreescribir registros manuales)
    if sessions:
        history = {}
        if os.path.exists(EX_HISTORY_FILE):
            with open(EX_HISTORY_FILE) as f:
                history = json.load(f)

        changed = False
        goal = load_profile()["goal"]
        for s in sessions:
            if s["date"] is None:
                continue
            date_str = s["date"].isoformat() if hasattr(s["date"], "isoformat") else str(s["date"])
            existing  = history.get(date_str, {})
            has_health = "apple_health" in existing.get("sources", [])

            # Siempre actualizar el detalle de gym (Sheets), pero respetar kcal de Apple Health
            gym_detail = [{"name": ex["name"], "volume": ex.get("volume"), "compound": ex.get("compound")}
                          for ex in s["exercises"]]
            sheets_kcal = round(estimate_session_calories(s))

            if has_health:
                # Apple Health ya tiene las kcal → solo actualizamos gym_detail y tipo
                history[date_str]["gym_detail"]    = gym_detail
                history[date_str]["session_type"]  = s["type"]
                sources = existing.get("sources", [])
                if source not in sources:
                    sources.append(source)
                history[date_str]["sources"] = sources
            else:
                # Sin Apple Health → usamos estimación de Sheets como hasta ahora
                sources = existing.get("sources", [source])
                if source not in sources:
                    sources.append(source)
                history[date_str] = {
                    **existing,
                    "burned_kcal":     sheets_kcal,
                    "adjustment_kcal": round(sheets_kcal * RECOVERY_FACTOR.get(goal, 0.85)),
                    "gym_detail":      gym_detail,
                    "session_type":    s["type"],
                    "sources":         sources,
                }
            changed = True

        if changed:
            with open(EX_HISTORY_FILE, "w") as f:
                json.dump(history, f, indent=2, ensure_ascii=False)

    return {
        "source":   source,
        "sessions": result,
        "credentials_configured": (
            __import__("pathlib").Path("google_credentials.json").exists()
        ),
    }


@app.get("/exercise/history", tags=["Ejercicio"])
def get_exercise_history(days: int = 7):
    """Historial de ejercicio de los últimos N días."""
    history = {}
    if os.path.exists(EX_HISTORY_FILE):
        with open(EX_HISTORY_FILE) as f:
            history = json.load(f)

    today = date.today()
    result = []
    streak = 0
    for i in range(days - 1, -1, -1):
        d      = today - timedelta(days=i)
        iso    = d.isoformat()
        entry  = history.get(iso, {})
        burned = int(entry.get("burned_kcal", 0))
        result.append({
            "date":        iso,
            "day_label":   d.strftime("%a %d/%m"),
            "burned_kcal": burned,
            "trained":     burned > 0,
            "exercises":   entry.get("exercises", []),
            "sources":      entry.get("sources", [entry["source"]] if "source" in entry else []),
            "health_data":  entry.get("health_data"),
            "gym_detail":   entry.get("gym_detail"),
            "session_type": entry.get("session_type"),
        })
        if burned > 0 and i > 0:
            streak += 1
        elif burned == 0 and i > 0:
            streak = 0

    return {"history": result, "streak": streak,
            "total_kcal": sum(r["burned_kcal"] for r in result),
            "trained_days": sum(1 for r in result if r["trained"])}


@app.post("/exercise/log", tags=["Ejercicio"])
def log_exercise_by_date(data: ExerciseLogByDateModel):
    """Registra ejercicio para cualquier fecha y evalúa su impacto en el plan semanal."""
    try:
        target_date = date.fromisoformat(data.date)
    except ValueError:
        raise HTTPException(400, "Formato de fecha inválido. Usa YYYY-MM-DD.")

    today = date.today()
    # Determinar el inicio de la semana según la preferencia del usuario
    profile_tmp   = load_profile()
    wsd           = profile_tmp.get("week_start_day", 0)
    monday        = today - timedelta(days=(today.weekday() - wsd) % 7)
    sunday        = monday + timedelta(days=6)

    if data.rested or not data.entries:
        ex_data = {"burned_kcal": 0, "adjustment_kcal": 0, "exercises": []}
    else:
        profile = load_profile()
        total_burned = 0.0
        log = []
        for entry in data.entries:
            ex = EXERCISES.get(entry.exercise_key)
            if not ex:
                raise HTTPException(400, f"Ejercicio '{entry.exercise_key}' no válido")
            kcal = calculate_exercise_kcal(ex["met"], profile["weight_kg"], entry.minutes)
            total_burned += kcal
            log.append({"key": entry.exercise_key, "name": ex["name"],
                         "minutes": entry.minutes, "burned": round(kcal), "kcal": round(kcal)})

        factor = RECOVERY_FACTOR.get(profile["goal"], 0.60)
        adj    = round(total_burned * factor)
        ex_data = {
            "burned_kcal":     round(total_burned),
            "adjustment_kcal": adj,
            "exercises":       log,
        }

    # Guardar en historial para la fecha indicada
    history = {}
    if os.path.exists(EX_HISTORY_FILE):
        with open(EX_HISTORY_FILE) as f:
            history = json.load(f)
    history[data.date] = ex_data
    with open(EX_HISTORY_FILE, "w") as f:
        json.dump(history, f, indent=2, ensure_ascii=False)

    # Evaluación de impacto en el plan semanal
    in_current_week = monday <= target_date <= sunday
    is_today        = target_date == today
    is_yesterday    = target_date == today - timedelta(days=1)
    is_future       = target_date > today

    if is_future:
        impact_type = "scheduled"
        impact_msg  = f"Actividad programada para el {target_date.strftime('%d/%m')}. Se registrará en el historial pero no afecta el plan actual."
    elif is_today:
        impact_type = "today"
        impact_msg  = "Actividad registrada para hoy. Afecta tu objetivo calórico del día actual."
    elif is_yesterday:
        impact_type = "yesterday"
        impact_msg  = "Actividad de ayer registrada. Se aplica ajuste de recuperación a las calorías de hoy."
    elif in_current_week:
        impact_type = "this_week"
        # Contar días entrenados esta semana
        days_trained = sum(
            1 for i in range(7)
            if history.get((monday + timedelta(days=i)).isoformat(), {}).get("burned_kcal", 0) > 0
        )
        impact_msg = (
            f"Actividad dentro de la semana actual. Llevas {days_trained} día{'s' if days_trained != 1 else ''} "
            f"de entrenamiento esta semana ({monday.strftime('%d/%m')} – {sunday.strftime('%d/%m')})."
        )
    else:
        impact_type = "past_week"
        impact_msg  = f"Actividad de una semana anterior ({target_date.strftime('%d/%m/%Y')}). No afecta el plan semanal actual."

    return {
        "ok":           True,
        "date":         data.date,
        "exercise_data": ex_data,
        "impact": {
            "type":           impact_type,
            "message":        impact_msg,
            "in_current_week": in_current_week,
            "is_today":       is_today,
            "is_yesterday":   is_yesterday,
            "is_future":      is_future,
        },
    }


@app.delete("/exercise/log/{target_date}", tags=["Ejercicio"])
def delete_exercise_by_date(target_date: str):
    """Elimina el registro de ejercicio de una fecha concreta."""
    try:
        date.fromisoformat(target_date)
    except ValueError:
        raise HTTPException(400, "Formato de fecha inválido. Usa YYYY-MM-DD.")

    history = {}
    if os.path.exists(EX_HISTORY_FILE):
        with open(EX_HISTORY_FILE) as f:
            history = json.load(f)

    if target_date not in history:
        raise HTTPException(404, f"No hay registro de ejercicio para {target_date}.")

    del history[target_date]
    with open(EX_HISTORY_FILE, "w") as f:
        json.dump(history, f, indent=2, ensure_ascii=False)

    return {"ok": True, "deleted_date": target_date}


@app.post("/health/sync", tags=["Apple Health"])
def sync_health_data(data: HealthSyncModel):
    """
    Recibe datos de Apple Health (vía iOS Shortcuts) y los fusiona con el historial
    de ejercicio. Apple Health tiene prioridad sobre la estimación por fórmula para
    burned_kcal, pero preserva el detalle de ejercicios de Google Sheets si existe.

    Reglas de merge:
    - Si ya hay un registro para esa fecha con datos de Sheets → mantiene gym_detail,
      reemplaza burned_kcal con el valor de Apple Health (más preciso).
    - Si no hay registro previo → crea uno nuevo con los datos de Health.
    - Siempre recalcula adjustment_kcal sobre el burned_kcal final.
    """
    try:
        date.fromisoformat(data.date)
    except ValueError:
        raise HTTPException(400, "Formato de fecha inválido. Usa YYYY-MM-DD.")

    if data.active_calories < 0:
        raise HTTPException(400, "active_calories debe ser >= 0.")

    # Cargar historial existente
    history: dict = {}
    if os.path.exists(EX_HISTORY_FILE):
        with open(EX_HISTORY_FILE) as f:
            history = json.load(f)

    existing = history.get(data.date, {})
    profile  = load_profile()
    factor   = RECOVERY_FACTOR.get(profile["goal"], 0.85)

    # Apple Health es la fuente de verdad para kcal cuando está disponible
    burned_kcal     = round(data.active_calories)
    adjustment_kcal = round(burned_kcal * factor)

    # Construir sources — preservar fuentes previas
    sources = list(existing.get("sources", []))
    if existing.get("source") and existing["source"] not in sources:
        sources.append(existing["source"])
    if "apple_health" not in sources:
        sources.append("apple_health")

    # Preservar detalle de gym (Sheets) si existe
    gym_detail = existing.get("gym_detail") or existing.get("exercises")

    merged = {
        **existing,
        "burned_kcal":     burned_kcal,
        "adjustment_kcal": adjustment_kcal,
        "duration_min":    data.duration_min or existing.get("duration_min"),
        "sources":         sources,
        "health_data": {
            "active_calories": round(data.active_calories),
            "workout_type":    data.workout_type,
            "duration_min":    data.duration_min,
            "steps":           round(data.steps) if data.steps else data.steps,
            "heart_rate_avg":  round(data.heart_rate_avg) if data.heart_rate_avg else data.heart_rate_avg,
            "heart_rate_max":  round(data.heart_rate_max) if data.heart_rate_max else data.heart_rate_max,
        },
    }
    if gym_detail:
        merged["gym_detail"] = gym_detail

    history[data.date] = merged
    with open(EX_HISTORY_FILE, "w") as f:
        json.dump(history, f, indent=2, ensure_ascii=False)

    return {
        "ok":              True,
        "date":            data.date,
        "burned_kcal":     burned_kcal,
        "adjustment_kcal": adjustment_kcal,
        "sources":         sources,
        "had_gym_detail":  bool(gym_detail),
    }


# ══════════════════════════════════════════════════════════════════════════════
# PESO
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/weight/history", tags=["Peso"])
def get_weight_history():
    """Historial completo de peso con análisis de progreso."""
    history = load_weight_history()
    profile = load_profile()
    goal    = profile["goal"]
    expected = EXPECTED_WEEKLY_CHANGE.get(goal, 0)

    analysis = None
    if len(history) >= 2:
        first = history[0]
        last  = history[-1]
        weeks = max(
            (date.fromisoformat(last["date"]) - date.fromisoformat(first["date"])).days / 7, 1
        )
        total_change = last["weight_kg"] - first["weight_kg"]
        real_weekly  = total_change / weeks
        diff_plan    = real_weekly - expected

        if abs(diff_plan) < 0.1:
            status = "on_track"
            message = "Vas exactamente según el plan."
        elif goal == "lose" and diff_plan > 0.1:
            status = "warning"
            message = "Pierdes menos de lo esperado. Revisa las porciones."
        elif goal == "lose" and diff_plan < -0.2:
            status = "warning"
            message = "Pierdes más rápido de lo ideal. Asegúrate de comer suficiente."
        elif goal == "gain" and diff_plan < -0.1:
            status = "warning"
            message = "Ganas menos masa de lo esperado. Considera aumentar calorías."
        else:
            status = "ok"
            message = "Progreso dentro del rango esperado."

        analysis = {
            "total_change":   round(total_change, 1),
            "real_weekly":    round(real_weekly, 2),
            "expected_weekly": expected,
            "weeks_elapsed":  round(weeks, 1),
            "status":         status,
            "message":        message,
        }

    return {
        "history":        history,
        "needs_weigh_in": needs_weigh_in(),
        "expected_weekly": expected,
        "analysis":       analysis,
        "current_weight": history[-1]["weight_kg"] if history else None,
    }


@app.post("/weight", tags=["Peso"])
def add_weight(data: WeightModel):
    """Registra el peso actual."""
    if not (30 <= data.weight_kg <= 300):
        raise HTTPException(400, "Peso fuera de rango (30-300 kg)")

    history = load_weight_history()
    today   = date.today()
    entry   = {
        "date":      today.isoformat(),
        "week":      today.strftime("%G-W%V"),
        "weight_kg": data.weight_kg,
    }
    # Reemplazar si ya hay registro de hoy
    history = [e for e in history if e.get("date") != entry["date"]]
    history.append(entry)
    save_weight_history(history)

    # Actualizar perfil
    profile = load_profile()
    profile["weight_kg"] = data.weight_kg
    save_profile(profile)
    save_session(adaptive_day=None)

    return {"ok": True, "entry": entry}


# ══════════════════════════════════════════════════════════════════════════════
# ADHERENCIA
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/adherence", tags=["Adherencia"])
def get_adherence(days: int = 7):
    """Historial de adherencia de los últimos N días."""
    adh_log = {}
    if os.path.exists(ADHERENCE_FILE):
        with open(ADHERENCE_FILE) as f:
            raw = json.load(f)
        # Normalizar: puede ser dict {date: {pct}} o lista [{date, pct}]
        if isinstance(raw, list):
            adh_log = {e["date"]: e for e in raw if "date" in e}
        elif isinstance(raw, dict):
            adh_log = raw

    today = date.today()
    result = []
    for i in range(days - 1, -1, -1):
        d   = today - timedelta(days=i)
        iso = d.isoformat()
        entry = adh_log.get(iso)
        result.append({
            "date":      iso,
            "day_label": d.strftime("%a %d/%m"),
            "pct":       entry["pct"] if entry else None,
            "has_data":  entry is not None,
        })

    weekly_avg = weekly_adherence()
    return {"history": result, "weekly_average": weekly_avg}


@app.post("/adherence", tags=["Adherencia"])
def log_adherence_endpoint(data: AdherenceModel):
    """Registra la adherencia del día (qué comidas se han cumplido)."""
    meals     = data.meals        # {meal_key: bool}
    kcal_map  = data.kcal_map     # {meal_key: kcal}
    followed  = sum(1 for v in meals.values() if v)
    total     = len(meals)
    pct       = round(followed / total * 100) if total else 0
    today_iso = date.today().isoformat()

    # Kcal de comidas seguidas del plan
    plan_kcal = sum(
        kcal_map.get(k, 0) for k, v in meals.items()
        if v and k not in data.skipped_meals
    ) if kcal_map else 0

    # Kcal de alimentos alternativos en comidas saltadas
    replacement_kcal = sum(
        sum(f.get("kcal", 0) for f in v.get("foods", []))
        for v in data.skipped_meals.values()
    )

    consumed_kcal = round(plan_kcal + replacement_kcal) if (kcal_map or data.skipped_meals) else None

    adh_log = {}
    if os.path.exists(ADHERENCE_FILE):
        with open(ADHERENCE_FILE) as f:
            adh_log = json.load(f)

    entry = {"meals": meals, "pct": pct}
    if data.skipped_meals:
        entry["skipped_meals"] = data.skipped_meals
    if consumed_kcal is not None:
        entry["consumed_kcal"] = consumed_kcal

    adh_log[today_iso] = entry
    with open(ADHERENCE_FILE, "w") as f:
        json.dump(adh_log, f, indent=2)

    return {"ok": True, "pct": pct, "followed": followed, "total": total,
            "consumed_kcal": entry.get("consumed_kcal", 0)}


@app.get("/adherence/today", tags=["Adherencia"])
def get_today_adherence():
    """Devuelve las kcal consumidas y adherencia del día de hoy."""
    today_iso = date.today().isoformat()
    adh_log   = {}
    if os.path.exists(ADHERENCE_FILE):
        with open(ADHERENCE_FILE) as f:
            adh_log = json.load(f)
    entry = adh_log.get(today_iso, {})
    return {
        "pct":           entry.get("pct", 0),
        "consumed_kcal": entry.get("consumed_kcal", 0),
        "meals":         entry.get("meals", {}),
    }


# ══════════════════════════════════════════════════════════════════════════════
# ENCUESTA SEMANAL
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/survey", tags=["Encuesta"])
def get_survey():
    """Última encuesta y si hace falta rellenar una nueva."""
    return {
        "needs_survey": needs_survey(),
        "last_scores":  last_survey_scores(),
        "history":      load_surveys()[-4:],   # últimas 4 semanas
        "questions":    [{"key": k, "label": q} for k, q in QUESTIONS],
    }


@app.post("/survey", tags=["Encuesta"])
def submit_survey(data: SurveyModel):
    vals   = data.model_dump()
    score  = round(sum(vals.values()) / len(vals), 1)
    today  = date.today()
    entry  = {
        "date":  today.isoformat(),
        "week":  today.strftime("%G-W%V"),
        **vals,
        "score": score,
    }
    history = load_surveys()
    history.append(entry)
    save_surveys(history)
    return {"ok": True, "score": score, "entry": entry}


# ══════════════════════════════════════════════════════════════════════════════
# INFORME SEMANAL
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/report/weekly", tags=["Informe"])
def get_weekly_report():
    profile       = load_profile()
    goal          = profile["goal"]
    ex_days, ex_kcal = _last_week_exercise()
    prev_w, curr_w   = _weight_change()
    adherence        = weekly_adherence()
    survey           = last_survey_scores()
    weight_change    = round(curr_w - prev_w, 1) if prev_w and curr_w else None
    rec_raw          = _recommendation(goal, adherence, ex_days, weight_change, survey)
    recommendations  = [line.strip().lstrip("•").strip()
                        for line in rec_raw.strip().split("\n") if line.strip()]

    if needs_weekly_report():
        mark_report_shown()

    return {
        "exercise": {"days_trained": ex_days, "kcal_burned": ex_kcal},
        "weight":   {"current": curr_w, "previous": prev_w, "change": weight_change},
        "adherence": adherence,
        "survey":    survey,
        "recommendations": recommendations,
        "needs_report": False,   # ya lo marcamos como visto
    }


# ══════════════════════════════════════════════════════════════════════════════
# ALERTAS / DASHBOARD
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/dashboard", tags=["Dashboard"])
def get_dashboard():
    """Todo lo necesario para el dashboard en un solo request."""
    profile  = load_profile()
    session  = _get_session()
    ex_data  = session.get("exercise_data") or {"burned_kcal": 0, "adjustment_kcal": 0, "exercises": []}

    # Enrich exercise_data with health_data from exercise history
    # (Apple Health data is stored in the history file, not the session)
    today_iso = date.today().isoformat()
    yesterday_iso = (date.today() - timedelta(days=1)).isoformat()
    ex_history = {}
    if os.path.exists(EX_HISTORY_FILE):
        with open(EX_HISTORY_FILE) as f:
            ex_history = json.load(f)

    # Today's health data (steps, HR, active_calories synced from Apple Health)
    today_health = ex_history.get(today_iso, {}).get("health_data")
    # Yesterday's full exercise entry for the "exercise card"
    yesterday_entry = ex_history.get(yesterday_iso, {})
    if yesterday_entry.get("burned_kcal", 0) > 0:
        ex_data = {**ex_data, **yesterday_entry}

    # Kcal consumidas hoy (desde adherencia)
    adh_log   = {}
    if os.path.exists(ADHERENCE_FILE):
        with open(ADHERENCE_FILE) as f:
            adh_log = json.load(f)
    consumed_kcal = adh_log.get(today_iso, {}).get("consumed_kcal", 0)
    today_tr = session.get("today_training") or {}
    ex_adj   = ex_data.get("adjustment_kcal", 0) + today_tr.get("bonus_kcal", 0)

    bmr     = calculate_bmr(profile["gender"], profile["age"],
                            profile["height_cm"], profile["weight_kg"])
    tdee    = calculate_tdee(bmr, profile["activity_level"])
    target  = calculate_daily_target(bmr, profile["goal"], ex_adj,
                                     activity_level=profile.get("activity_level", 1))
    macros  = calculate_macros(profile["weight_kg"], target, profile["goal"])

    d_event = days_to_event()
    event   = get_event()

    alerts = []
    if needs_weigh_in():
        alerts.append({"type": "weigh_in", "message": "Toca registrar tu peso esta semana"})
    if needs_survey():
        alerts.append({"type": "survey", "message": "Encuesta semanal pendiente"})
    if needs_weekly_report():
        alerts.append({"type": "weekly_report", "message": "Informe semanal disponible"})
    if d_event is not None and d_event <= 7:
        alerts.append({"type": "event", "message": f"Evento '{event['name']}' en {d_event} días",
                       "days": d_event})

    # Active calories burned today (from Apple Health sync)
    today_active_kcal = 0
    today_entry = ex_history.get(today_iso, {})
    hd = today_entry.get("health_data")
    if hd and hd.get("active_calories"):
        today_active_kcal = round(hd["active_calories"])
    elif today_entry.get("burned_kcal", 0) > 0:
        today_active_kcal = round(today_entry["burned_kcal"])

    goal_adj = GOAL_ADJUSTMENTS.get(profile["goal"], 0)

    return {
        "profile":      profile,
        "nutrition":    {"bmr": round(bmr), "tdee_ref": round(tdee),
                         "daily_target": target, "macros": macros,
                         "consumed_kcal": consumed_kcal},
        "exercise_data": ex_data,
        "today_health":  today_health,
        "today_active_kcal": today_active_kcal,
        "goal_balance": {
            "goal":            profile["goal"],
            "target_adjustment": goal_adj,
            "consumed_kcal":   consumed_kcal,
            "active_kcal":     today_active_kcal,
            "net_balance":     consumed_kcal - today_active_kcal,
            "target_net":      target - today_active_kcal,
        },
        "today_training": today_tr,
        "alerts":        alerts,
        "session_has_exercise": session.get("exercise_data") is not None,
    }


# ══════════════════════════════════════════════════════════════════════════════
# PREFERENCIAS
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/preferences", tags=["Preferencias"])
def get_preferences():
    return load_prefs()


@app.put("/preferences", tags=["Preferencias"])
def update_preferences(data: PreferencesModel):
    prefs = {"excluded": data.excluded, "favorites": data.favorites, "disliked": data.disliked}
    save_prefs(prefs)
    save_session(week_plan=None, adaptive_day=None)
    return {"ok": True, "preferences": prefs}


@app.post("/preferences/excluded", tags=["Preferencias"])
def add_excluded(keyword: str):
    prefs = load_prefs()
    if keyword not in prefs["excluded"]:
        prefs["excluded"].append(keyword.lower().strip())
        save_prefs(prefs)
        save_session(week_plan=None, adaptive_day=None)
    return prefs


@app.delete("/preferences/excluded/{keyword}", tags=["Preferencias"])
def remove_excluded(keyword: str):
    prefs = load_prefs()
    prefs["excluded"] = [k for k in prefs["excluded"] if k != keyword]
    save_prefs(prefs)
    save_session(week_plan=None, adaptive_day=None)
    return prefs


@app.post("/preferences/favorites", tags=["Preferencias"])
def add_favorite(keyword: str):
    prefs = load_prefs()
    if keyword not in prefs["favorites"]:
        prefs["favorites"].append(keyword.lower().strip())
        save_prefs(prefs)
        save_session(week_plan=None, adaptive_day=None)
    return prefs


@app.delete("/preferences/favorites/{keyword}", tags=["Preferencias"])
def remove_favorite(keyword: str):
    prefs = load_prefs()
    prefs["favorites"] = [k for k in prefs["favorites"] if k != keyword]
    save_prefs(prefs)
    save_session(week_plan=None, adaptive_day=None)
    return prefs


# ══════════════════════════════════════════════════════════════════════════════
# EVENTOS / COMPETICIÓN
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/event", tags=["Evento"])
def get_event_status():
    event = get_event()
    d     = days_to_event()
    if not event:
        return {"has_event": False}

    _, msg = event_calorie_adjustment(2000)  # mensaje con base ficticia
    return {
        "has_event":   True,
        "name":        event["name"],
        "date":        event["date"],
        "days_to_event": d,
        "message":     msg.strip(),
    }


@app.post("/event", tags=["Evento"])
def create_event(data: EventModel):
    event_date = date.fromisoformat(data.date)
    if event_date <= date.today():
        raise HTTPException(400, "La fecha debe ser futura")
    event = {"name": data.name, "date": data.date}
    with open(COMPETITION_FILE, "w") as f:
        json.dump(event, f, indent=2)
    save_session(adaptive_day=None)
    return {"ok": True, "event": event}


@app.delete("/event", tags=["Evento"])
def delete_event():
    if os.path.exists(COMPETITION_FILE):
        os.remove(COMPETITION_FILE)
    save_session(adaptive_day=None)
    return {"ok": True}


# ══════════════════════════════════════════════════════════════════════════════
# ENTRENAMIENTO (rutinas)
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/training/routine", tags=["Entrenamiento"])
def get_routine(days: int = 3, type: str = "gym"):
    """
    Genera una rutina de entrenamiento.
    type: "gym" | "calistenia"
    """
    profile = load_profile()
    weight  = profile["weight_kg"]

    if type == "gym":
        if days <= 3:
            return {
                "type":       "full_body",
                "days":       days,
                "day_plan":   [{"day": i + 1, "label": "Full Body", "exercises": FULL_BODY_ROUTINE}
                               for i in range(days)],
                "protein_post": round(weight * 0.3),
            }
        else:
            day_plan_keys = _build_ppl_plan(days)
            return {
                "type":       "ppl",
                "days":       days,
                "day_plan":   [{"day": i + 1, "label": key, "exercises": PPL_ROUTINE[key]}
                               for i, key in enumerate(day_plan_keys)],
                "protein_post": round(weight * 0.3),
            }
    else:
        return {
            "type":       "calistenia",
            "days":       days,
            "levels":     ["principiante", "intermedio", "avanzado"],
            "blocks":     {block: list(levels.keys())
                           for block, levels in CALISTENIA.items()},
        }


@app.get("/training/calistenia", tags=["Entrenamiento"])
def get_calistenia_routine(
    days: int = 3,
    level: str = "intermedio",
    has_barra: bool = True,
    has_paralelas: bool = True,
):
    profile  = load_profile()
    capped   = min(max(days, 2), 5)
    plan     = CALISTENIA_PLANS.get(capped, CALISTENIA_PLANS[3])
    day_list = []
    for day_num, blocks in enumerate(plan, 1):
        block_list = []
        for block in blocks:
            exercises = CALISTENIA[block].get(level, [])
            exercises = _filter_exercises(exercises, has_barra, has_paralelas)
            block_list.append({"block": block, "exercises": exercises})
        day_list.append({"day": day_num, "label": " + ".join(blocks), "blocks": block_list})

    return {
        "type":             "calistenia",
        "level":            level,
        "days":             capped,
        "has_barra":        has_barra,
        "has_paralelas":    has_paralelas,
        "day_plan":         day_list,
        "protein_post":     round(profile["weight_kg"] * 0.3),
    }


# ══════════════════════════════════════════════════════════════════════════════
# GAMIFICACIÓN
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/gamification/status", tags=["Gamificación"])
def get_gamification_status():
    """Devuelve el nivel, XP total, progreso al siguiente nivel y desglose de puntos."""
    return gamification_status()


# ══════════════════════════════════════════════════════════════════════════════
# PDF EXPORT
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/report/download", tags=["Informe"])
def download_report_pdf():
    """Genera y descarga el informe semanal en PDF."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import cm
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable, Table, TableStyle
    from reportlab.lib.enums import TA_CENTER

    profile = load_profile()
    goal = profile["goal"]
    ex_days, ex_kcal = _last_week_exercise()
    prev_w, curr_w = _weight_change()
    adherence = weekly_adherence()
    survey = last_survey_scores()
    weight_change = round(curr_w - prev_w, 1) if prev_w and curr_w else None
    rec_raw = _recommendation(goal, adherence, ex_days, weight_change, survey)
    recommendations = [line.strip().lstrip("•").strip()
                       for line in rec_raw.strip().split("\n") if line.strip()]

    tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    tmp.close()

    GREEN_DARK = colors.HexColor("#2E7D32")
    GREY_MID = colors.HexColor("#E0E0E0")

    base = getSampleStyleSheet()
    s_title = ParagraphStyle("RTitle", parent=base["Normal"], fontSize=20,
                             textColor=GREEN_DARK, alignment=TA_CENTER,
                             fontName="Helvetica-Bold", spaceAfter=4)
    s_sub = ParagraphStyle("RSub", parent=base["Normal"], fontSize=10,
                           textColor=colors.grey, alignment=TA_CENTER, spaceAfter=2)
    s_h2 = ParagraphStyle("RH2", parent=base["Normal"], fontSize=12,
                          textColor=GREEN_DARK, fontName="Helvetica-Bold",
                          spaceBefore=14, spaceAfter=6)
    s_body = ParagraphStyle("RBody", parent=base["Normal"], fontSize=10,
                            textColor=colors.black, leading=14)
    s_rec = ParagraphStyle("RRec", parent=base["Normal"], fontSize=10,
                           textColor=colors.black, leading=14, leftIndent=12)
    s_foot = ParagraphStyle("RFoot", parent=base["Normal"], fontSize=8,
                            textColor=colors.grey, alignment=TA_CENTER)

    doc = SimpleDocTemplate(tmp.name, pagesize=A4,
                            leftMargin=2*cm, rightMargin=2*cm,
                            topMargin=1.8*cm, bottomMargin=1.8*cm)
    story = []

    name = profile.get("name", "Usuario")
    goal_map = {"lose": "Perder peso", "maintain": "Mantener peso", "gain": "Ganar músculo"}

    story.append(Paragraph("Informe Semanal", s_title))
    story.append(Paragraph(f"{name}  ·  {goal_map.get(goal, '')}  ·  {date.today().strftime('%d/%m/%Y')}", s_sub))
    story.append(Spacer(1, 0.4*cm))
    story.append(HRFlowable(width="100%", thickness=1.5, color=GREEN_DARK))
    story.append(Spacer(1, 0.4*cm))

    # Exercise
    story.append(Paragraph("Ejercicio", s_h2))
    story.append(Paragraph(f"Días entrenados: <b>{ex_days}/7</b>", s_body))
    story.append(Paragraph(f"Calorías quemadas: <b>{ex_kcal} kcal</b>", s_body))

    # Weight
    story.append(Paragraph("Peso", s_h2))
    if curr_w:
        story.append(Paragraph(f"Peso actual: <b>{curr_w:.1f} kg</b>", s_body))
        if weight_change is not None:
            arrow = "↓" if weight_change < 0 else "↑" if weight_change > 0 else "→"
            story.append(Paragraph(f"Cambio semanal: <b>{weight_change:+.1f} kg {arrow}</b>", s_body))
    else:
        story.append(Paragraph("Sin datos de peso esta semana.", s_body))

    # Adherence
    story.append(Paragraph("Adherencia al plan", s_h2))
    story.append(Paragraph(f"<b>{adherence}%</b>", s_body))

    # Survey
    if survey:
        story.append(Paragraph("Sensaciones", s_h2))
        labels = {"energia": "Energía", "hambre": "Sin hambre",
                  "adherencia": "Adherencia percibida", "sueno": "Sueño"}
        for key, lbl in labels.items():
            v = survey.get(key, 0)
            if v:
                story.append(Paragraph(f"{lbl}: {'★'*v}{'☆'*(5-v)} ({v}/5)", s_body))

    # Recommendations
    story.append(Paragraph("Recomendaciones", s_h2))
    for i, rec in enumerate(recommendations, 1):
        story.append(Paragraph(f"{i}. {rec}", s_rec))

    story.append(Spacer(1, 0.6*cm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=GREY_MID))
    story.append(Spacer(1, 0.2*cm))
    story.append(Paragraph("METABOLIC  ·  Informe generado automáticamente", s_foot))

    doc.build(story)

    return FileResponse(
        tmp.name,
        media_type="application/pdf",
        filename=f"informe_semanal_{date.today().isoformat()}.pdf",
    )


# ══════════════════════════════════════════════════════════════════════════════
# FOOD SEARCH (OpenFoodFacts proxy)
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/food/search", tags=["Alimentos"])
def search_food(q: str = Query(..., min_length=2, description="Nombre del alimento")):
    """
    Busca alimentos en OpenFoodFacts y devuelve nombre + kcal por 100g.
    Actúa como proxy para evitar CORS y normalizar la respuesta.
    """
    params = urllib.parse.urlencode({
        "search_terms": q,
        "search_simple": 1,
        "action": "process",
        "json": 1,
        "page_size": 10,
        "fields": "product_name,nutriments,image_small_url",
    })
    url = f"https://world.openfoodfacts.org/cgi/search.pl?{params}"

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "METABOLIC/1.0"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode())
    except Exception:
        raise HTTPException(502, "No se pudo consultar OpenFoodFacts")

    results = []
    for product in data.get("products", []):
        name = product.get("product_name", "").strip()
        kcal = product.get("nutriments", {}).get("energy-kcal_100g")
        if not name or kcal is None:
            continue
        results.append({
            "name": name,
            "kcal_100g": round(kcal),
            "image": product.get("image_small_url"),
        })

    return {"results": results}
