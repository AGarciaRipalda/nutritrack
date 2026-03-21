"""
Encuesta semanal de sensaciones subjetivas (inspirado en INDYA).
Se hace una vez por semana al arrancar el programa.
Evalúa 4 áreas en escala 1-5: energía, hambre, adherencia percibida, sueño.
"""

import json
import os
from datetime import date
from data_dir import DATA_DIR

SURVEY_FILE = DATA_DIR / "survey_history.json"

QUESTIONS = [
    ("energia",    "¿Cómo ha sido tu nivel de ENERGÍA esta semana?  (1=muy baja, 5=excelente)"),
    ("hambre",     "¿Has sentido mucha HAMBRE entre comidas?         (1=mucha hambre, 5=sin hambre)"),
    ("adherencia", "¿Qué tal has seguido el plan alimenticio?        (1=mal, 5=perfecto)"),
    ("sueno",      "¿Cómo ha sido la calidad de tu SUEÑO?            (1=muy mal, 5=excelente)"),
]


def _load() -> list:
    if not os.path.exists(SURVEY_FILE):
        return []
    with open(SURVEY_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def _save(history: list) -> None:
    with open(SURVEY_FILE, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2, ensure_ascii=False)


def needs_survey() -> bool:
    """True si no hay encuesta de esta semana."""
    history = _load()
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


def last_survey_scores() -> dict:
    """Devuelve las puntuaciones de la última encuesta o dict vacío."""
    history = _load()
    return history[-1] if history else {}
