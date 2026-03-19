import json
import os
from datetime import date

PROFILE_FILE = "user_profile.json"
SESSION_FILE = "session.json"

DEFAULT_PROFILE = {
    "name": "Usuario",
    "gender": "male",
    "age": 36,
    "height_cm": 170,
    "weight_kg": 80.0,
    "activity_level": 1,
    "goal": "maintain"
}


def load_profile() -> dict:
    if os.path.exists(PROFILE_FILE):
        with open(PROFILE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return DEFAULT_PROFILE.copy()


def save_profile(profile: dict) -> None:
    with open(PROFILE_FILE, "w", encoding="utf-8") as f:
        json.dump(profile, f, indent=2, ensure_ascii=False)
    print(f"  Perfil guardado en '{PROFILE_FILE}'.")


def _today() -> str:
    return date.today().isoformat()          # "2026-03-19"


def _this_week() -> str:
    return date.today().strftime("%G-W%V")   # "2026-W12"


def load_session() -> dict:
    """
    Carga la sesión persistida.
    Devuelve un dict con:
      - exercise_data   (solo si es del día de hoy)
      - adaptive_day    (solo si es del día de hoy)
      - week_plan       (solo si es de la semana actual)
    """
    result = {"exercise_data": None, "adaptive_day": None,
              "week_plan": None, "today_training": None}

    if not os.path.exists(SESSION_FILE):
        return result

    with open(SESSION_FILE, "r", encoding="utf-8") as f:
        session = json.load(f)

    today = _today()
    week  = _this_week()

    if session.get("saved_date") == today:
        result["exercise_data"]  = session.get("exercise_data")
        result["adaptive_day"]   = session.get("adaptive_day")
        result["today_training"] = session.get("today_training")

    if session.get("saved_week") == week:
        result["week_plan"] = session.get("week_plan")

    return result


_MISSING = object()  # centinela para distinguir "no pasado" de "None explícito"


def save_session(exercise_data=_MISSING,
                 adaptive_day=_MISSING,
                 week_plan=_MISSING,
                 today_training=_MISSING) -> None:
    """
    Persiste el estado de la sesión actual.
    Solo actualiza los campos que se pasen explícitamente.
    Pasar None limpia el campo (lo elimina de la sesión).
    """
    session = {}
    if os.path.exists(SESSION_FILE):
        with open(SESSION_FILE, "r", encoding="utf-8") as f:
            session = json.load(f)

    session["saved_date"] = _today()
    session["saved_week"] = _this_week()

    for key, value in [("exercise_data",  exercise_data),
                       ("adaptive_day",   adaptive_day),
                       ("today_training", today_training),
                       ("week_plan",     week_plan)]:
        if value is _MISSING:
            continue
        if value is None:
            session.pop(key, None)   # limpiar el campo
        else:
            session[key] = value

    with open(SESSION_FILE, "w", encoding="utf-8") as f:
        json.dump(session, f, indent=2, ensure_ascii=False)
