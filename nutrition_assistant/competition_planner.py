"""
Planificación nutricional para eventos y competiciones.
- Permite registrar la fecha de un evento próximo.
- La semana previa al evento: avisa y sugiere aumentar carbohidratos +15%.
- El día del evento: plan ligero (fácil digestión, bajo en fibra).
- Datos guardados en competition.json o PostgreSQL.
"""

import json
import os
from datetime import date, timedelta
from data_dir import DATA_DIR

COMPETITION_FILE = DATA_DIR / "competition.json"


def _use_db():
    try:
        from database import is_db_available
        return is_db_available()
    except ImportError:
        return False


def _load() -> dict:
    if _use_db():
        from database import fetchone
        row = fetchone("SELECT name, date FROM events WHERE date >= %s ORDER BY date LIMIT 1",
                       (date.today().isoformat(),))
        if row:
            return {"name": row["name"], "date": str(row["date"])}
        return {}

    if not os.path.exists(COMPETITION_FILE):
        return {}
    with open(COMPETITION_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def _save(data: dict) -> None:
    if _use_db():
        from database import execute
        execute("INSERT INTO events (name, date) VALUES (%s, %s)",
                (data.get("name", "Evento"), data["date"]))
        return

    with open(COMPETITION_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def get_event() -> dict | None:
    """Devuelve el próximo evento registrado, o None si no hay ninguno vigente."""
    data = _load()
    if not data or "date" not in data:
        return None
    event_date = date.fromisoformat(data["date"])
    if event_date < date.today():
        return None
    return data


def days_to_event() -> int | None:
    """Días hasta el próximo evento, o None si no hay."""
    event = get_event()
    if not event:
        return None
    return (date.fromisoformat(event["date"]) - date.today()).days


def register_event() -> dict:
    """Submenú para registrar o borrar un evento."""
    current = get_event()
    if current:
        print(f"\n  Evento actual: {current['name']} — {current['date']}")
        opt = input("  ¿Cambiar evento? (s/n): ").strip().lower()
        if opt != "s":
            return current

    print("\n  ┌─ REGISTRAR EVENTO ──────────────────────┐")
    name = input("  │  Nombre del evento: ").strip()
    if not name:
        name = "Evento"

    while True:
        raw = input("  │  Fecha del evento (DD/MM/YYYY): ").strip()
        try:
            event_date = date.strptime(raw, "%d/%m/%Y") if hasattr(date, "strptime") \
                         else __import__("datetime").datetime.strptime(raw, "%d/%m/%Y").date()
            if event_date <= date.today():
                print("  │  ⚠ La fecha debe ser futura.")
                continue
            break
        except ValueError:
            print("  │  ⚠ Formato incorrecto. Usa DD/MM/YYYY.")

    data = {"name": name, "date": event_date.isoformat()}
    _save(data)
    print(f"  └─ Evento '{name}' registrado para el {event_date.strftime('%d/%m/%Y')}.")
    return data


def event_calorie_adjustment(base_target: int) -> tuple[int, str]:
    """
    Calcula el ajuste calórico según la proximidad al evento.
    Devuelve (kcal_ajustadas, mensaje_informativo).
    """
    days = days_to_event()
    event = get_event()

    if days is None:
        return base_target, ""

    if days == 0:
        return base_target - 200, (
            f"⚡ HOY ES EL DÍA DEL EVENTO: {event['name']}!\n"
            "  Plan ligero: evita fibra alta y alimentos nuevos."
        )
    elif days <= 2:
        return base_target + 150, (
            f"  🏁 El evento '{event['name']}' es en {days} día(s).\n"
            "  Carga de glucógeno: prioriza los carbohidratos hoy."
        )
    elif days <= 7:
        extra = round(base_target * 0.08)
        return base_target + extra, (
            f"  📅 Quedan {days} días para '{event['name']}'.\n"
            f"  Semana de carga: +{extra} kcal extra (más carbohidratos)."
        )

    return base_target, f"  📅 Evento '{event['name']}' en {days} días."


def print_event_status() -> None:
    """Muestra el estado del próximo evento."""
    event = get_event()
    if not event:
        print("  No hay eventos registrados.")
        return
    days  = days_to_event()
    edate = date.fromisoformat(event["date"]).strftime("%d/%m/%Y")
    print(f"\n  Próximo evento: {event['name']}")
    print(f"  Fecha: {edate}  ({days} días)")
    if days == 0:
        print("  ⚡ ¡HOY ES EL DÍA!")
    elif days <= 2:
        print("  🏁 Mañana o pasado — carga de glucógeno.")
    elif days <= 7:
        print("  📅 Semana de carga: más carbohidratos.")
    else:
        print("  Entrena y sigue el plan habitual.")
