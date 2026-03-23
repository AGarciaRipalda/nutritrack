#!/usr/bin/env python3
"""
migrate_data.py — Migra datos de archivos JSON a PostgreSQL.

Lee exercise_history.json, adherence_log.json, user_profile.json,
session.json, weight_history.json, survey_history.json,
competition.json y preferences.json e inserta los datos en las
tablas correspondientes de PostgreSQL.

Uso:
    export DATABASE_URL=postgresql://nutritrack:password@db:5432/nutritrack
    python migrate_data.py [--data-dir /ruta/a/archivos]

O dentro de Docker:
    docker compose exec backend python /app/migrate_data.py
"""

import argparse
import json
import os
import sys
from pathlib import Path

import psycopg2
from psycopg2.extras import Json


def get_connection(database_url: str):
    """Crea y devuelve una conexión a PostgreSQL."""
    conn = psycopg2.connect(database_url)
    conn.autocommit = False
    return conn


def load_json(filepath: Path) -> dict | list | None:
    """Carga un archivo JSON si existe."""
    if not filepath.exists():
        print(f"  ⚠ No encontrado: {filepath}")
        return None
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def migrate_profile(conn, data_dir: Path):
    """Migra user_profile.json → user_profiles."""
    data = load_json(data_dir / "user_profile.json")
    if not data:
        return 0

    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM user_profiles")
    if cur.fetchone()[0] > 0:
        print("  ℹ Ya existe un perfil en la DB, actualizando...")
        cur.execute("""
            UPDATE user_profiles SET
                name = %(name)s, gender = %(gender)s, age = %(age)s,
                height_cm = %(height_cm)s, weight_kg = %(weight_kg)s,
                activity_level = %(activity_level)s, goal = %(goal)s,
                week_start_day = %(week_start_day)s, updated_at = NOW()
            WHERE id = 1
        """, data)
    else:
        cur.execute("""
            INSERT INTO user_profiles (name, gender, age, height_cm, weight_kg,
                                       activity_level, goal, week_start_day)
            VALUES (%(name)s, %(gender)s, %(age)s, %(height_cm)s, %(weight_kg)s,
                    %(activity_level)s, %(goal)s, %(week_start_day)s)
        """, {**{"week_start_day": 0}, **data})
    conn.commit()
    print("  ✓ Perfil migrado.")
    return 1


def migrate_exercise_history(conn, data_dir: Path):
    """Migra exercise_history.json → exercise_history + exercise_entries."""
    data = load_json(data_dir / "exercise_history.json")
    if not data:
        return 0

    cur = conn.cursor()
    count = 0

    for date_str, entry in data.items():
        burned = entry.get("burned_kcal", 0)
        adj = entry.get("adjustment_kcal", 0)
        duration = entry.get("duration_min")
        session_type = entry.get("session_type")
        sources = entry.get("sources", [])
        if isinstance(sources, str):
            sources = [sources]
        health_data = entry.get("health_data")
        gym_detail = entry.get("gym_detail")

        cur.execute("""
            INSERT INTO exercise_history (date, burned_kcal, adjustment_kcal,
                                          duration_min, session_type, sources,
                                          health_data, gym_detail)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (date) DO UPDATE SET
                burned_kcal = EXCLUDED.burned_kcal,
                adjustment_kcal = EXCLUDED.adjustment_kcal,
                duration_min = EXCLUDED.duration_min,
                session_type = EXCLUDED.session_type,
                sources = EXCLUDED.sources,
                health_data = EXCLUDED.health_data,
                gym_detail = EXCLUDED.gym_detail
            RETURNING id
        """, (date_str, burned, adj, duration, session_type,
              sources, Json(health_data) if health_data else None,
              Json(gym_detail) if gym_detail else None))

        history_id = cur.fetchone()[0]

        # Insertar ejercicios individuales
        exercises = entry.get("exercises", [])
        if exercises:
            cur.execute("DELETE FROM exercise_entries WHERE history_id = %s", (history_id,))
            for ex in exercises:
                cur.execute("""
                    INSERT INTO exercise_entries (history_id, exercise_key, name, minutes, burned_kcal)
                    VALUES (%s, %s, %s, %s, %s)
                """, (history_id, ex.get("key"), ex.get("name", ""),
                      ex.get("minutes", 0), ex.get("burned", ex.get("kcal", 0))))

        count += 1

    conn.commit()
    print(f"  ✓ Historial de ejercicio: {count} días migrados.")
    return count


def migrate_adherence(conn, data_dir: Path):
    """Migra adherence_log.json → adherence_log + adherence_meals."""
    data = load_json(data_dir / "adherence_log.json")
    if not data:
        return 0

    cur = conn.cursor()
    count = 0

    # El formato puede ser dict {date: {pct, meals}} o lista
    if isinstance(data, list):
        entries = {e["date"]: e for e in data if "date" in e}
    else:
        entries = data

    for date_str, entry in entries.items():
        pct = entry.get("pct", 0)
        consumed = entry.get("consumed_kcal")
        skipped = entry.get("skipped_meals", {})

        cur.execute("""
            INSERT INTO adherence_log (date, pct, consumed_kcal, skipped_meals)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (date) DO UPDATE SET
                pct = EXCLUDED.pct,
                consumed_kcal = EXCLUDED.consumed_kcal,
                skipped_meals = EXCLUDED.skipped_meals
            RETURNING id
        """, (date_str, pct, consumed, Json(skipped) if skipped else Json({})))

        adh_id = cur.fetchone()[0]

        meals = entry.get("meals", {})
        if meals:
            cur.execute("DELETE FROM adherence_meals WHERE adherence_id = %s", (adh_id,))
            for meal_key, followed in meals.items():
                cur.execute("""
                    INSERT INTO adherence_meals (adherence_id, meal_key, followed)
                    VALUES (%s, %s, %s)
                """, (adh_id, meal_key, bool(followed)))

        count += 1

    conn.commit()
    print(f"  ✓ Adherencia: {count} días migrados.")
    return count


def migrate_weight(conn, data_dir: Path):
    """Migra weight_history.json → weight_history."""
    data = load_json(data_dir / "weight_history.json")
    if not data:
        return 0

    cur = conn.cursor()
    count = 0

    for entry in data:
        cur.execute("""
            INSERT INTO weight_history (date, week, weight_kg)
            VALUES (%s, %s, %s)
            ON CONFLICT (date) DO UPDATE SET
                week = EXCLUDED.week,
                weight_kg = EXCLUDED.weight_kg
        """, (entry["date"], entry.get("week", ""), entry["weight_kg"]))
        count += 1

    conn.commit()
    print(f"  ✓ Historial de peso: {count} registros migrados.")
    return count


def migrate_surveys(conn, data_dir: Path):
    """Migra survey_history.json → survey_history."""
    data = load_json(data_dir / "survey_history.json")
    if not data:
        return 0

    cur = conn.cursor()
    count = 0

    for entry in data:
        cur.execute("""
            INSERT INTO survey_history (date, week, energia, hambre, adherencia, sueno, score)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (week) DO UPDATE SET
                date = EXCLUDED.date,
                energia = EXCLUDED.energia,
                hambre = EXCLUDED.hambre,
                adherencia = EXCLUDED.adherencia,
                sueno = EXCLUDED.sueno,
                score = EXCLUDED.score
        """, (entry["date"], entry["week"],
              entry["energia"], entry["hambre"],
              entry["adherencia"], entry["sueno"],
              entry["score"]))
        count += 1

    conn.commit()
    print(f"  ✓ Encuestas: {count} semanas migradas.")
    return count


def migrate_event(conn, data_dir: Path):
    """Migra competition.json → events."""
    data = load_json(data_dir / "competition.json")
    if not data or "date" not in data:
        return 0

    cur = conn.cursor()
    cur.execute("""
        INSERT INTO events (name, date)
        VALUES (%s, %s)
    """, (data.get("name", "Evento"), data["date"]))
    conn.commit()
    print("  ✓ Evento migrado.")
    return 1


def migrate_preferences(conn, data_dir: Path):
    """Migra preferences.json → food_preferences."""
    data = load_json(data_dir / "preferences.json")
    if not data:
        return 0

    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM food_preferences")
    if cur.fetchone()[0] > 0:
        cur.execute("""
            UPDATE food_preferences SET
                excluded = %s, favorites = %s, disliked = %s, updated_at = NOW()
            WHERE id = 1
        """, (data.get("excluded", []), data.get("favorites", []),
              data.get("disliked", [])))
    else:
        cur.execute("""
            INSERT INTO food_preferences (excluded, favorites, disliked)
            VALUES (%s, %s, %s)
        """, (data.get("excluded", []), data.get("favorites", []),
              data.get("disliked", [])))
    conn.commit()
    print("  ✓ Preferencias migradas.")
    return 1


def migrate_session(conn, data_dir: Path):
    """Migra session.json → sessions."""
    data = load_json(data_dir / "session.json")
    if not data:
        return 0

    cur = conn.cursor()
    cur.execute("""
        INSERT INTO sessions (saved_date, saved_week, week_plan,
                              exercise_data, adaptive_day, today_training,
                              exercise_adj, weekly_history)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        data.get("saved_date", "1970-01-01"),
        data.get("saved_week", "1970-W01"),
        Json(data.get("week_plan")),
        Json(data.get("exercise_data")),
        Json(data.get("adaptive_day")),
        Json(data.get("today_training")),
        Json(data.get("exercise_adj", {})),
        Json(data.get("weekly_history", [])),
    ))
    conn.commit()
    print("  ✓ Sesión migrada.")
    return 1


def main():
    parser = argparse.ArgumentParser(description="Migra datos JSON a PostgreSQL")
    parser.add_argument(
        "--data-dir",
        type=str,
        default=os.environ.get("DATA_DIR", os.path.dirname(os.path.abspath(__file__))),
        help="Directorio con los archivos JSON (default: DATA_DIR o directorio actual)",
    )
    parser.add_argument(
        "--database-url",
        type=str,
        default=os.environ.get("DATABASE_URL"),
        help="URL de conexión PostgreSQL (default: $DATABASE_URL)",
    )
    args = parser.parse_args()

    if not args.database_url:
        print("❌ Se requiere DATABASE_URL (variable de entorno o --database-url)")
        sys.exit(1)

    data_dir = Path(args.data_dir)
    print(f"\n{'='*60}")
    print(f"  NutriTrack — Migración JSON → PostgreSQL")
    print(f"  Directorio de datos: {data_dir}")
    print(f"{'='*60}\n")

    conn = get_connection(args.database_url)
    total = 0

    try:
        total += migrate_profile(conn, data_dir)
        total += migrate_exercise_history(conn, data_dir)
        total += migrate_adherence(conn, data_dir)
        total += migrate_weight(conn, data_dir)
        total += migrate_surveys(conn, data_dir)
        total += migrate_event(conn, data_dir)
        total += migrate_preferences(conn, data_dir)
        total += migrate_session(conn, data_dir)
    except Exception as e:
        conn.rollback()
        print(f"\n❌ Error durante la migración: {e}")
        sys.exit(1)
    finally:
        conn.close()

    print(f"\n{'='*60}")
    print(f"  ✅ Migración completada. {total} operaciones realizadas.")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
