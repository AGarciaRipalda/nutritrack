"""
Encuesta semanal de sensaciones subjetivas (inspirado en INDYA).
Se hace una vez por semana al arrancar el programa.
Evalúa 4 áreas en escala 1-5: energía, hambre, adherencia percibida, sueño.

Soporte multi-usuario: user_id opcional en todas las funciones.
"""

import json
import os
from datetime import date
from pathlib import Path
from data_dir import DATA_DIR
from user_paths import get_user_data_dir

SURVEY_FILE = DATA_DIR / "survey_history.json"

QUESTIONS = [
    ("energia",    "¿Cómo ha sido tu nivel de ENERGÍA esta semana?  (1=muy baja, 5=excelente)"),
    ("hambre",     "¿Has sentido mucha HAMBRE entre comidas?         (1=mucha hambre, 5=sin hambre)"),
    ("adherencia", "¿Qué tal has seguido el plan alimenticio?        (1=mal, 5=perfecto)"),
    ("sueno",      "¿Cómo ha sido la calidad de tu SUEÑO?            (1=muy mal, 5=excelente)"),
]


def _use_db():
    try:
        from database import is_db_available
        return is_db_available()
    except ImportError:
        return False


def _user_dir(user_id: str | None) -> Path:
    return get_user_data_dir(user_id, default_dir=DATA_DIR)


def _survey_file(user_id: str | None) -> Path:
    return _user_dir(user_id) / "survey_history.json"


def _load(user_id: str | None = None) -> list:
    if _use_db():
        from database import fetchall
        if user_id:
            rows = fetchall("SELECT * FROM survey_history WHERE user_id = %s ORDER BY date", (user_id,))
        else:
            rows = fetchall("SELECT * FROM survey_history ORDER BY date")
        return [
            {
                "date": str(r["date"]),
                "week": r["week"],
                "energia": r["energia"],
                "hambre": r["hambre"],
                "adherencia": r["adherencia"],
                "sueno": r["sueno"],
                "score": float(r["score"]),
            }
            for r in rows
        ]

    sf = _survey_file(user_id)
    if not os.path.exists(sf):
        return []
    with open(sf, "r", encoding="utf-8") as f:
        return json.load(f)


def _save(history: list, user_id: str | None = None) -> None:
    if _use_db():
        return

    sf = _survey_file(user_id)
    with open(sf, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2, ensure_ascii=False)


def needs_survey(user_id: str | None = None) -> bool:
    """True si no hay encuesta de esta semana."""
    if _use_db():
        from database import fetchone
        if user_id:
            row = fetchone(
                "SELECT week FROM survey_history WHERE user_id = %s AND week = %s",
                (user_id, date.today().strftime("%G-W%V"))
            )
        else:
            row = fetchone(
                "SELECT week FROM survey_history WHERE week = %s",
                (date.today().strftime("%G-W%V"),)
            )
        return row is None

    history = _load(user_id)
    if not history:
        return True
    last_week = history[-1].get("week")
    return last_week != date.today().strftime("%G-W%V")


def run_survey() -> dict:
    """Hace la encuesta y guarda los resultados. Devuelve el dict de respuestas."""
    print("\n  ┌─ ENCUESTA SEMANAL DE SENSACIONES ───────┐")
    print("  │  Tómate un momento para reflexionar     │")
    print("  │  sobre cómo te has sentido esta semana. │")
    print("  └─────────────────────────────────────────┘")

    answers = {}
    for key, question in QUESTIONS:
        while True:
            raw = input(f"\n  {question}\n  Tu respuesta (1-5): ").strip()
            if raw.isdigit() and 1 <= int(raw) <= 5:
                answers[key] = int(raw)
                break
            print("  ⚠ Introduce un número del 1 al 5.")

    score = round(sum(answers.values()) / len(answers), 1)
    print(f"\n  Puntuación media esta semana: {score}/5")

    entry = {
        "date":  date.today().isoformat(),
        "week":  date.today().strftime("%G-W%V"),
        **answers,
        "score": score,
    }

    if _use_db():
        from database import execute
        execute("""
            INSERT INTO survey_history (date, week, energia, hambre, adherencia, sueno, score)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (week) DO UPDATE SET
                date = EXCLUDED.date, energia = EXCLUDED.energia,
                hambre = EXCLUDED.hambre, adherencia = EXCLUDED.adherencia,
                sueno = EXCLUDED.sueno, score = EXCLUDED.score
        """, (entry["date"], entry["week"],
              entry["energia"], entry["hambre"],
              entry["adherencia"], entry["sueno"],
              entry["score"]))
    else:
        history = _load()
        history.append(entry)
        _save(history)

    return entry


def print_survey_history(n_weeks: int = 4) -> None:
    """Muestra el historial de encuestas de las últimas n semanas."""
    history = _load()
    if not history:
        print("  Sin encuestas registradas aún.")
        return

    recent = history[-n_weeks:]
    labels = {"energia": "Energía", "hambre": "Sin hambre",
              "adherencia": "Adherencia", "sueno": "Sueño"}

    print("\n" + "="*52)
    print(f"  SENSACIONES SEMANALES  (últimas {len(recent)} semanas)")
    print("="*52)
    for entry in recent:
        print(f"\n  Semana {entry['week']}  (media: {entry['score']}/5)")
        for key, label in labels.items():
            val = entry.get(key, 0)
            bar = "★" * val + "☆" * (5 - val)
            print(f"    {label:<14} {bar}  ({val}/5)")
    print("="*52)


def last_survey_scores(user_id: str | None = None) -> dict:
    """Devuelve las puntuaciones de la última encuesta o dict vacío."""
    if _use_db():
        from database import fetchone
        if user_id:
            row = fetchone("SELECT * FROM survey_history WHERE user_id = %s ORDER BY date DESC LIMIT 1", (user_id,))
        else:
            row = fetchone("SELECT * FROM survey_history ORDER BY date DESC LIMIT 1")
        if row:
            return {
                "date": str(row["date"]),
                "week": row["week"],
                "energia": row["energia"],
                "hambre": row["hambre"],
                "adherencia": row["adherencia"],
                "sueno": row["sueno"],
                "score": float(row["score"]),
            }
        return {}

    history = _load(user_id)
    return history[-1] if history else {}
