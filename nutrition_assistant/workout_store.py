"""
Workout Store — JSON-file-based CRUD for Routines and Workouts.
Stores data in routines.json, workouts.json, and prs.json.

Soporte multi-usuario: user_id opcional — cuando se proporciona,
los archivos se guardan en DATA_DIR/<user_id>/.
"""

import os
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from exercise_library import EXERCISE_LIBRARY
from data_dir import DATA_DIR
from user_paths import get_user_data_dir

# ── File paths (default, sin user_id) ────────────────────────────────────────
_DIR = os.path.dirname(os.path.abspath(__file__))
ROUTINES_FILE = os.path.join(_DIR, "routines.json")
WORKOUTS_FILE = os.path.join(_DIR, "workouts.json")
PRS_FILE = os.path.join(_DIR, "prs.json")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _uuid() -> str:
    return str(uuid.uuid4())


def _user_dir(user_id: str | None) -> Path:
    return get_user_data_dir(user_id, default_dir=Path(_DIR))


def _load_json(path: str) -> dict:
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def _save_json(path: str, data: dict):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def _load_routines(user_id: str | None = None) -> dict:
    return _load_json(str(_user_dir(user_id) / "routines.json"))


def _save_routines(data: dict, user_id: str | None = None):
    _save_json(str(_user_dir(user_id) / "routines.json"), data)


def _load_workouts(user_id: str | None = None) -> dict:
    return _load_json(str(_user_dir(user_id) / "workouts.json"))


def _save_workouts(data: dict, user_id: str | None = None):
    _save_json(str(_user_dir(user_id) / "workouts.json"), data)


def _load_prs(user_id: str | None = None) -> dict:
    return _load_json(str(_user_dir(user_id) / "prs.json"))


def _save_prs(data: dict, user_id: str | None = None):
    _save_json(str(_user_dir(user_id) / "prs.json"), data)


# ══════════════════════════════════════════════════════════════════════════════
# ROUTINES
# ══════════════════════════════════════════════════════════════════════════════

def list_routines(user_id: str | None = None) -> list:
    """Return all routines sorted by updated_at descending."""
    routines = _load_routines(user_id)
    items = list(routines.values())
    items.sort(key=lambda r: r.get("updated_at", ""), reverse=True)
    return items


def get_routine(routine_id: str, user_id: str | None = None) -> dict:
    """Get a single routine by ID. Raises KeyError if not found."""
    routines = _load_routines(user_id)
    if routine_id not in routines:
        raise KeyError(f"Routine {routine_id} not found")
    return routines[routine_id]


def create_routine(data: dict, user_id: str | None = None) -> dict:
    """Create a new routine from provided data. Returns the created routine."""
    routines = _load_routines(user_id)
    now = _now_iso()
    routine_id = _uuid()

    # Process days — assign IDs and enrich exercise info
    days = []
    for day_data in data.get("days", []):
        day_id = day_data.get("id") or _uuid()
        exercises = []
        for i, ex_data in enumerate(day_data.get("exercises", [])):
            exercise_id = ex_data.get("exercise_id", "")
            lib_entry = EXERCISE_LIBRARY.get(exercise_id, {})
            exercises.append({
                "exercise_id": exercise_id,
                "exercise_name": ex_data.get("exercise_name") or lib_entry.get("name", ""),
                "muscle_primary": ex_data.get("muscle_primary") or lib_entry.get("muscle_primary", ""),
                "target_sets": ex_data.get("target_sets", 3),
                "target_reps": ex_data.get("target_reps", "8-12"),
                "target_weight_kg": ex_data.get("target_weight_kg"),
                "rest_seconds": ex_data.get("rest_seconds", 90),
                "notes": ex_data.get("notes", ""),
                "superset_group": ex_data.get("superset_group"),
                "order": ex_data.get("order", i),
            })
        days.append({
            "id": day_id,
            "label": day_data.get("label", ""),
            "exercises": exercises,
        })

    routine = {
        "id": routine_id,
        "name": data.get("name", "New Routine"),
        "description": data.get("description", ""),
        "days": days,
        "created_at": now,
        "updated_at": now,
    }

    routines[routine_id] = routine
    _save_routines(routines, user_id)
    return routine


def update_routine(routine_id: str, data: dict, user_id: str | None = None) -> dict:
    """Update an existing routine. Raises KeyError if not found."""
    routines = _load_routines(user_id)
    if routine_id not in routines:
        raise KeyError(f"Routine {routine_id} not found")

    routine = routines[routine_id]

    # Update simple fields
    if "name" in data:
        routine["name"] = data["name"]
    if "description" in data:
        routine["description"] = data["description"]

    # Update days if provided
    if "days" in data:
        days = []
        for day_data in data["days"]:
            day_id = day_data.get("id") or _uuid()
            exercises = []
            for i, ex_data in enumerate(day_data.get("exercises", [])):
                exercise_id = ex_data.get("exercise_id", "")
                lib_entry = EXERCISE_LIBRARY.get(exercise_id, {})
                exercises.append({
                    "exercise_id": exercise_id,
                    "exercise_name": ex_data.get("exercise_name") or lib_entry.get("name", ""),
                    "muscle_primary": ex_data.get("muscle_primary") or lib_entry.get("muscle_primary", ""),
                    "target_sets": ex_data.get("target_sets", 3),
                    "target_reps": ex_data.get("target_reps", "8-12"),
                    "target_weight_kg": ex_data.get("target_weight_kg"),
                    "rest_seconds": ex_data.get("rest_seconds", 90),
                    "notes": ex_data.get("notes", ""),
                    "superset_group": ex_data.get("superset_group"),
                    "order": ex_data.get("order", i),
                })
            days.append({
                "id": day_id,
                "label": day_data.get("label", ""),
                "exercises": exercises,
            })
        routine["days"] = days

    routine["updated_at"] = _now_iso()
    routines[routine_id] = routine
    _save_routines(routines, user_id)
    return routine


def delete_routine(routine_id: str, user_id: str | None = None):
    """Delete a routine. Raises KeyError if not found."""
    routines = _load_routines(user_id)
    if routine_id not in routines:
        raise KeyError(f"Routine {routine_id} not found")
    del routines[routine_id]
    _save_routines(routines, user_id)


# ══════════════════════════════════════════════════════════════════════════════
# WORKOUTS
# ══════════════════════════════════════════════════════════════════════════════

def start_workout(
    routine_id: Optional[str] = None,
    routine_day_id: Optional[str] = None,
    name: Optional[str] = None,
    training_block: Optional[str] = None,
    user_id: str | None = None,
) -> dict:
    """Start a new workout session. Optionally from a routine day."""
    workouts = _load_workouts(user_id)

    workout_id = _uuid()
    now = _now_iso()

    exercises = []
    workout_name = name or "Workout"
    linked_routine_id = routine_id
    linked_day_id = routine_day_id

    # If starting from a routine day, pre-populate exercises
    if routine_id and routine_day_id:
        try:
            routine = get_routine(routine_id, user_id)
        except KeyError:
            raise KeyError(f"Routine {routine_id} not found")

        day = None
        for d in routine.get("days", []):
            if d["id"] == routine_day_id:
                day = d
                break
        if not day:
            raise KeyError(f"Day {routine_day_id} not found in routine {routine_id}")

        workout_name = name or f"{routine['name']} — {day['label']}"

        for ex_def in day.get("exercises", []):
            exercise_id = ex_def["exercise_id"]
            prev_sets = get_previous_sets(exercise_id, user_id)

            # Create target sets based on routine definition
            sets = []
            for s_num in range(1, ex_def.get("target_sets", 3) + 1):
                # Pre-fill from previous workout if available
                prev = prev_sets[s_num - 1] if s_num - 1 < len(prev_sets) else None
                sets.append({
                    "id": _uuid(),
                    "set_number": s_num,
                    "set_type": "normal",
                    "weight_kg": prev["weight_kg"] if prev else ex_def.get("target_weight_kg"),
                    "reps": prev["reps"] if prev else None,
                    "rpe": None,
                    "duration_sec": None,
                    "completed": False,
                    "is_pr": False,
                })

            exercises.append({
                "id": _uuid(),
                "exercise_id": exercise_id,
                "exercise_name": ex_def.get("exercise_name", ""),
                "muscle_primary": ex_def.get("muscle_primary", ""),
                "sets": sets,
                "rest_seconds": ex_def.get("rest_seconds", 90),
                "notes": ex_def.get("notes", ""),
                "superset_group": ex_def.get("superset_group"),
                "order": ex_def.get("order", 0),
            })

    workout = {
        "id": workout_id,
        "routine_id": linked_routine_id,
        "routine_day_id": linked_day_id,
        "name": workout_name,
        "status": "active",
        "started_at": now,
        "finished_at": None,
        "duration_seconds": None,
        "exercises": exercises,
        "total_volume_kg": 0.0,
        "total_sets": 0,
        "prs_hit": [],
        "notes": "",
        "training_block": training_block,
    }

    workouts[workout_id] = workout
    _save_workouts(workouts, user_id)
    return workout


def get_active_workout(user_id: str | None = None) -> Optional[dict]:
    """Return the currently active workout, or None."""
    workouts = _load_workouts(user_id)
    for w in workouts.values():
        if w.get("status") == "active":
            return w
    return None


def get_workout(workout_id: str, user_id: str | None = None) -> dict:
    """Get a specific workout. Raises KeyError if not found."""
    workouts = _load_workouts(user_id)
    if workout_id not in workouts:
        raise KeyError(f"Workout {workout_id} not found")
    return workouts[workout_id]


def add_exercise_to_workout(workout_id: str, exercise_id: str, user_id: str | None = None) -> dict:
    """Add an exercise (with empty sets + previous data) to an active workout."""
    workouts = _load_workouts(user_id)
    if workout_id not in workouts:
        raise KeyError(f"Workout {workout_id} not found")

    workout = workouts[workout_id]
    if workout["status"] != "active":
        raise ValueError("Cannot modify a non-active workout")

    lib_entry = EXERCISE_LIBRARY.get(exercise_id)
    if not lib_entry:
        raise KeyError(f"Exercise {exercise_id} not found in library")

    prev_sets = get_previous_sets(exercise_id, user_id)

    # Create 3 default sets, pre-filled from previous workout
    sets = []
    for s_num in range(1, 4):
        prev = prev_sets[s_num - 1] if s_num - 1 < len(prev_sets) else None
        sets.append({
            "id": _uuid(),
            "set_number": s_num,
            "set_type": "normal",
            "weight_kg": prev["weight_kg"] if prev else None,
            "reps": prev["reps"] if prev else None,
            "rpe": None,
            "duration_sec": None,
            "completed": False,
            "is_pr": False,
        })

    current_order = max((e.get("order", 0) for e in workout["exercises"]), default=-1) + 1

    exercise_entry = {
        "id": _uuid(),
        "exercise_id": exercise_id,
        "exercise_name": lib_entry["name"],
        "muscle_primary": lib_entry["muscle_primary"],
        "sets": sets,
        "rest_seconds": 90,
        "notes": "",
        "superset_group": None,
        "order": current_order,
    }

    workout["exercises"].append(exercise_entry)
    workouts[workout_id] = workout
    _save_workouts(workouts, user_id)

    # Return exercise entry with previous_sets info
    exercise_entry["previous_sets"] = prev_sets
    return exercise_entry


def remove_exercise_from_workout(workout_id: str, exercise_id: str, user_id: str | None = None):
    """Remove an exercise from an active workout by its exercise entry ID (not library ID)."""
    workouts = _load_workouts(user_id)
    if workout_id not in workouts:
        raise KeyError(f"Workout {workout_id} not found")

    workout = workouts[workout_id]
    if workout["status"] != "active":
        raise ValueError("Cannot modify a non-active workout")

    original_len = len(workout["exercises"])
    workout["exercises"] = [e for e in workout["exercises"] if e["id"] != exercise_id]

    if len(workout["exercises"]) == original_len:
        raise KeyError(f"Exercise entry {exercise_id} not found in workout")

    # Re-order
    for i, ex in enumerate(workout["exercises"]):
        ex["order"] = i

    workouts[workout_id] = workout
    _save_workouts(workouts, user_id)


def update_set(workout_id: str, exercise_id: str, set_id: str, data: dict, user_id: str | None = None) -> dict:
    """Update a specific set within a workout exercise."""
    workouts = _load_workouts(user_id)
    if workout_id not in workouts:
        raise KeyError(f"Workout {workout_id} not found")

    workout = workouts[workout_id]
    if workout["status"] != "active":
        raise ValueError("Cannot modify a non-active workout")

    # Find exercise
    exercise = None
    for ex in workout["exercises"]:
        if ex["id"] == exercise_id:
            exercise = ex
            break
    if not exercise:
        raise KeyError(f"Exercise entry {exercise_id} not found in workout")

    # Find set
    target_set = None
    for s in exercise["sets"]:
        if s["id"] == set_id:
            target_set = s
            break
    if not target_set:
        raise KeyError(f"Set {set_id} not found in exercise")

    # Update allowed fields
    for field in ("weight_kg", "reps", "rpe", "duration_sec", "completed", "set_type", "is_pr"):
        if field in data:
            target_set[field] = data[field]

    workouts[workout_id] = workout
    _save_workouts(workouts, user_id)
    return target_set


def add_set(workout_id: str, exercise_id: str, user_id: str | None = None) -> dict:
    """Add a new empty set to an exercise in a workout."""
    workouts = _load_workouts(user_id)
    if workout_id not in workouts:
        raise KeyError(f"Workout {workout_id} not found")

    workout = workouts[workout_id]
    if workout["status"] != "active":
        raise ValueError("Cannot modify a non-active workout")

    exercise = None
    for ex in workout["exercises"]:
        if ex["id"] == exercise_id:
            exercise = ex
            break
    if not exercise:
        raise KeyError(f"Exercise entry {exercise_id} not found in workout")

    current_max = max((s["set_number"] for s in exercise["sets"]), default=0)

    # Pre-fill from previous set in this workout if exists
    last_set = exercise["sets"][-1] if exercise["sets"] else None

    new_set = {
        "id": _uuid(),
        "set_number": current_max + 1,
        "set_type": "normal",
        "weight_kg": last_set["weight_kg"] if last_set else None,
        "reps": last_set["reps"] if last_set else None,
        "rpe": None,
        "duration_sec": None,
        "completed": False,
        "is_pr": False,
    }

    exercise["sets"].append(new_set)
    workouts[workout_id] = workout
    _save_workouts(workouts, user_id)
    return new_set


def delete_set(workout_id: str, exercise_id: str, set_id: str, user_id: str | None = None):
    """Delete a set from an exercise in a workout."""
    workouts = _load_workouts(user_id)
    if workout_id not in workouts:
        raise KeyError(f"Workout {workout_id} not found")

    workout = workouts[workout_id]
    if workout["status"] != "active":
        raise ValueError("Cannot modify a non-active workout")

    exercise = None
    for ex in workout["exercises"]:
        if ex["id"] == exercise_id:
            exercise = ex
            break
    if not exercise:
        raise KeyError(f"Exercise entry {exercise_id} not found in workout")

    original_len = len(exercise["sets"])
    exercise["sets"] = [s for s in exercise["sets"] if s["id"] != set_id]

    if len(exercise["sets"]) == original_len:
        raise KeyError(f"Set {set_id} not found")

    # Re-number sets
    for i, s in enumerate(exercise["sets"]):
        s["set_number"] = i + 1

    workouts[workout_id] = workout
    _save_workouts(workouts, user_id)


def finish_workout(workout_id: str, notes: str = "", user_id: str | None = None) -> dict:
    """Finish a workout: calculate volume, detect PRs, mark completed."""
    from pr_tracker import detect_prs

    workouts = _load_workouts(user_id)
    if workout_id not in workouts:
        raise KeyError(f"Workout {workout_id} not found")

    workout = workouts[workout_id]
    if workout["status"] != "active":
        raise ValueError("Workout is not active")

    now = _now_iso()
    started = datetime.fromisoformat(workout["started_at"])
    finished = datetime.fromisoformat(now)
    duration = int((finished - started).total_seconds())

    # Calculate totals
    total_volume = 0.0
    total_sets = 0
    for ex in workout["exercises"]:
        for s in ex["sets"]:
            if s.get("completed"):
                total_sets += 1
                w = s.get("weight_kg") or 0
                r = s.get("reps") or 0
                total_volume += w * r

    workout["status"] = "completed"
    workout["finished_at"] = now
    workout["duration_seconds"] = duration
    workout["total_volume_kg"] = round(total_volume, 1)
    workout["total_sets"] = total_sets
    workout["notes"] = notes

    # Detect PRs
    prs = detect_prs(workout, user_id=user_id)
    workout["prs_hit"] = prs

    # Mark PR sets
    pr_set_ids = {p["set_id"] for p in prs if "set_id" in p}
    for ex in workout["exercises"]:
        for s in ex["sets"]:
            if s["id"] in pr_set_ids:
                s["is_pr"] = True

    workouts[workout_id] = workout
    _save_workouts(workouts, user_id)
    return workout


def discard_workout(workout_id: str, user_id: str | None = None):
    """Discard (cancel) an active workout."""
    workouts = _load_workouts(user_id)
    if workout_id not in workouts:
        raise KeyError(f"Workout {workout_id} not found")

    workout = workouts[workout_id]
    if workout["status"] != "active":
        raise ValueError("Workout is not active")

    workout["status"] = "discarded"
    workout["finished_at"] = _now_iso()
    workouts[workout_id] = workout
    _save_workouts(workouts, user_id)


def list_workouts(limit: int = 20, offset: int = 0, user_id: str | None = None) -> list:
    """List completed workouts, newest first."""
    workouts = _load_workouts(user_id)
    completed = [
        w for w in workouts.values()
        if w.get("status") == "completed"
    ]
    completed.sort(key=lambda w: w.get("finished_at", ""), reverse=True)
    return completed[offset:offset + limit]


def get_previous_sets(exercise_id: str, user_id: str | None = None) -> list:
    """Get sets from the last completed workout containing this exercise."""
    workouts = _load_workouts(user_id)
    completed = [
        w for w in workouts.values()
        if w.get("status") == "completed"
    ]
    completed.sort(key=lambda w: w.get("finished_at", ""), reverse=True)

    for w in completed:
        for ex in w.get("exercises", []):
            if ex.get("exercise_id") == exercise_id:
                return [
                    {
                        "set_number": s["set_number"],
                        "weight_kg": s.get("weight_kg"),
                        "reps": s.get("reps"),
                        "rpe": s.get("rpe"),
                        "set_type": s.get("set_type", "normal"),
                        "completed": s.get("completed", False),
                    }
                    for s in ex.get("sets", [])
                    if s.get("completed")
                ]
    return []


def get_workout_history(days: int = 30, user_id: str | None = None) -> list:
    """Summary of completed workouts in the last N days."""
    from datetime import timedelta

    workouts = _load_workouts(user_id)
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    cutoff_iso = cutoff.isoformat()

    results = []
    for w in workouts.values():
        if w.get("status") != "completed":
            continue
        if w.get("finished_at", "") < cutoff_iso:
            continue

        muscle_groups = list({
            ex.get("muscle_primary", "")
            for ex in w.get("exercises", [])
            if ex.get("muscle_primary")
        })

        results.append({
            "id": w["id"],
            "name": w["name"],
            "started_at": w["started_at"],
            "finished_at": w["finished_at"],
            "duration_seconds": w.get("duration_seconds"),
            "total_volume_kg": w.get("total_volume_kg", 0),
            "total_sets": w.get("total_sets", 0),
            "exercise_count": len(w.get("exercises", [])),
            "muscle_groups": muscle_groups,
            "prs_count": len(w.get("prs_hit", [])),
            "training_block": w.get("training_block"),
        })

    results.sort(key=lambda r: r["finished_at"], reverse=True)
    return results
