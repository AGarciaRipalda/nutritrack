"""
Parser para el Google Sheet de entrenamiento de Alejandro.
Rescata la lógica de excel_parser.py adaptada para leer filas de Google Sheets.

Layout del sheet (idéntico al Excel):
  col[2]  → Nº ejercicio  |  'TIPO DE ENTRENAMIENTO'  |  'FECHA'
  col[3]  → Nombre ejercicio  |  fecha (texto dd/mm/yyyy o similar)
  col[4]  → Reps Serie 1  (número o rango '12-15')
  col[5]  → Kg  Serie 1
  col[7]  → Reps Serie 2
  col[8]  → Kg  Serie 2

Autenticación: Service Account cuyo JSON se espera en
  nutrition_assistant/google_credentials.json
  (la cuenta de servicio debe tener acceso al spreadsheet)

Fallback: si no hay credenciales, intenta leer el Excel local via excel_parser.
"""

from __future__ import annotations

import datetime
import os
import json
from pathlib import Path
from typing import Optional

SPREADSHEET_ID  = "1zxZeuvjVO0hB0zRiq9DcM9iuVoLQh5wzsFC3PWzQVfk"
SHEET_GID       = 627901101

# Credenciales: env var tiene prioridad (producción), luego fichero local (desarrollo)
_CREDS_ENV = os.environ.get("GOOGLE_CREDENTIALS_JSON")
if _CREDS_ENV:
    _tmp = Path("/tmp/google_credentials.json")
    _tmp.write_text(_CREDS_ENV, encoding="utf-8")
    CREDENTIALS_FILE = _tmp
else:
    CREDENTIALS_FILE = Path(__file__).parent / "google_credentials.json"

COMPOUND_KEYWORDS = [
    "peso muerto", "rdl", "sentadilla", "prensa", "leg press",
    "press plano", "press inclinado", "press 45", "press 30", "press 15",
    "press multipower", "kaz press", "press muy inclinado",
    "remo", "seal row", "jalón", "dominadas", "bulgarian", "zancada",
    "hip thrust", "rack pull",
]


def _is_compound(name: str) -> bool:
    n = name.lower()
    return any(kw in n for kw in COMPOUND_KEYWORDS)


def _safe_float(val) -> float | None:
    """Devuelve float si val es numérico y > 0, si no None."""
    if val is None or val == "":
        return None
    if isinstance(val, (int, float)) and not isinstance(val, bool):
        return float(val) if val > 0 else None
    if isinstance(val, str):
        try:
            f = float(val.replace(",", ".").strip())
            return f if f > 0 else None
        except ValueError:
            return None
    return None


def _parse_date(raw) -> Optional[datetime.date]:
    """Intenta parsear la fecha desde texto o datetime."""
    if raw is None or raw == "":
        return None
    if isinstance(raw, datetime.datetime):
        return raw.date()
    if isinstance(raw, datetime.date):
        return raw
    if isinstance(raw, str):
        raw = raw.strip()
        for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%y"):
            try:
                return datetime.datetime.strptime(raw, fmt).date()
            except ValueError:
                continue
    return None


def _parse_exercise_row(row: list) -> dict | None:
    """
    Intenta parsear una fila como ejercicio con datos reales.
    Devuelve None si la fila no corresponde a un ejercicio válido.
    """
    if len(row) < 9:
        return None

    idx  = _safe_float(row[2])
    name = row[3]

    if idx is None or not isinstance(name, str) or not name.strip():
        return None

    reps1 = _safe_float(row[4])
    kg1   = _safe_float(row[5])
    reps2 = _safe_float(row[7]) if len(row) > 7 else None
    kg2   = _safe_float(row[8]) if len(row) > 8 else None

    vol = 0.0
    if reps1 and kg1:
        vol += reps1 * kg1
    if reps2 and kg2:
        vol += reps2 * kg2

    return {
        "name":     name.strip(),
        "reps_s1":  reps1 or 0,
        "kg_s1":    kg1   or 0,
        "reps_s2":  reps2 or 0,
        "kg_s2":    kg2   or 0,
        "volume":   round(vol, 1),
        "compound": _is_compound(name),
    }


def _parse_rows(rows: list[list]) -> list[dict]:
    """
    Recorre las filas del sheet y devuelve lista de sesiones.
    Lógica idéntica a excel_parser.parse_diary_sheet.
    Cada sesión: { type, date, exercises }
    """
    sessions: list[dict] = []
    cur_type:      Optional[str]  = None
    cur_date:      Optional[datetime.date] = None
    cur_exercises: list[dict] = []

    def _flush():
        nonlocal cur_type, cur_date, cur_exercises
        if cur_type and cur_exercises:
            sessions.append({
                "type":      cur_type,
                "date":      cur_date,
                "exercises": cur_exercises,
            })
        cur_type      = None
        cur_date      = None
        cur_exercises = []

    for row in rows:
        padded = list(row) + [None] * max(0, 12 - len(row))
        marker = padded[2]

        if isinstance(marker, str):
            marker_up = marker.strip().upper()
        else:
            marker_up = ""

        # ── Inicio de nueva sesión ──────────────────────────────────────────
        if marker_up == "TIPO DE ENTRENAMIENTO":
            _flush()
            cur_type = str(padded[4]).strip() if padded[4] else "?"
            continue

        # ── Fila de fecha ───────────────────────────────────────────────────
        if marker_up == "FECHA":
            cur_date = _parse_date(padded[3])
            continue

        # ── Cabecera de ejercicios (ignorar) ────────────────────────────────
        if marker_up.startswith("ENTRENAMIENTO"):
            continue

        # ── Fila de ejercicio ───────────────────────────────────────────────
        ex = _parse_exercise_row(padded)
        if ex:
            cur_exercises.append(ex)

    _flush()
    return sessions


# ── Acceso a Google Sheets ────────────────────────────────────────────────────

def _get_worksheet():
    """Abre el worksheet por GID usando Service Account."""
    import gspread
    from google.oauth2.service_account import Credentials

    scopes = [
        "https://www.googleapis.com/auth/spreadsheets.readonly",
        "https://www.googleapis.com/auth/drive.readonly",
    ]
    creds = Credentials.from_service_account_file(str(CREDENTIALS_FILE), scopes=scopes)
    client = gspread.authorize(creds)
    spreadsheet = client.open_by_key(SPREADSHEET_ID)

    # Buscar la worksheet por GID
    for ws in spreadsheet.worksheets():
        if ws.id == SHEET_GID:
            return ws

    raise ValueError(f"No se encontró ningún worksheet con GID={SHEET_GID}")


def fetch_sessions_from_sheets() -> list[dict]:
    """
    Descarga todas las filas del Google Sheet y devuelve la lista de sesiones.
    Lanza excepción si las credenciales no están disponibles o falla la conexión.
    """
    ws   = _get_worksheet()
    rows = ws.get_all_values()   # lista de listas de str
    return _parse_rows(rows)


# ── Fallback al Excel local ───────────────────────────────────────────────────

def fetch_sessions_fallback() -> list[dict]:
    """
    Fallback: lee el mismo diario desde el Excel local (excel_parser.py).
    """
    from excel_parser import get_all_diary_sheets, parse_diary_sheet

    all_sessions: list[dict] = []
    for sheet_name in get_all_diary_sheets():
        all_sessions.extend(parse_diary_sheet(sheet_name))
    return all_sessions


# ── API pública ───────────────────────────────────────────────────────────────

def get_all_sessions() -> tuple[list[dict], str]:
    """
    Devuelve (sessions, source) donde source es 'sheets' o 'excel'.
    Prioriza Google Sheets; si falla usa el Excel local.
    """
    if CREDENTIALS_FILE.exists():
        try:
            sessions = fetch_sessions_from_sheets()
            return sessions, "sheets"
        except Exception as e:
            import warnings
            warnings.warn(f"Google Sheets no disponible ({e}), usando Excel local.")

    try:
        sessions = fetch_sessions_fallback()
        return sessions, "excel"
    except Exception:
        return [], "none"


def get_recent_sessions(days: int = 7) -> tuple[list[dict], str]:
    """
    Devuelve solo las sesiones de los últimos `days` días.
    """
    sessions, source = get_all_sessions()
    cutoff = datetime.date.today() - datetime.timedelta(days=days)
    recent = [
        s for s in sessions
        if s["date"] is not None and s["date"] >= cutoff
    ]
    # Ordenar de más reciente a más antiguo
    recent.sort(key=lambda s: s["date"], reverse=True)
    return recent, source
