"""
PR Tracker — Personal Record detection, 1RM estimation, and training analytics.
"""

import os
import json
from datetime import datetime, timezone, timedelta
from typing import Optional

_DIR = os.path.dirname(os.path.abspath(__file__))
PRS_FILE = os.path.join(_DIR, "prs.json")
WORKOUTS_FILE = os.path.join(_DIR, "workouts.json")

from exercise_library import EXERCISE_LIBRARY, MUSCLE_LABELS


def _load_json(path: str) -> dict:
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def _save_json(path: str, data: dict):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def _load_prs() -> dict:
    return _load_json(PRS_FILE)


def _save_prs(data: dict):
    _save_json(PRS_FILE, data)


def _load_workouts() -> dict:
    return _load_json(WORKOUTS_FILE)


# ── 1RM Estimation ──────────────────────────────────────────────────────────

def estimate_1rm(weight_kg: float, reps: int) -> float:
    """Brzycki formula for estimated 1 rep max."""
    if reps <= 0 or weight_kg <= 0:
        return 0.0
    if reps == 1:
        return weight_kg
    if reps > 36:
        reps = 36
    return round(weight_kg * (36.0 / (37.0 - reps)), 1)


# ── PR Detection ────────────────────────────────────────────────────────────

def detect_prs(workout: dict) -> list:
    """
    Compare each completed set in the workout against stored PRs.
    Returns list of new PR records and updates prs.json.
    """
    prs_db = _load_prs()
    new_prs = []
    date = workout.get("finished_at", workout.get("started_at", ""))[:10]
    workout_id = workout.get("id", "")

    for ex in workout.get("exercises", []):
        exercise_id = ex.get("exercise_id", "")
        exercise_name = ex.get("exercise_name", "")
        if not exercise_id:
            continue

        if exercise_id not in prs_db:
            prs_db[exercise_id] = {
                "best_weight": 0,
                "best_1rm": 0,
                "best_volume_set": 0,
                "best_reps": 0,
                "set_records": {},
            }

        ex_prs = prs_db[exercise_id]

        for s in ex.get("sets", []):
            if not s.get("completed"):
                continue
            if s.get("set_type") == "warmup":
                continue

            w = s.get("weight_kg") or 0
            r = s.get("reps") or 0
            set_id = s.get("id", "")

            if w <= 0 and r <= 0:
                continue

            # PR: heaviest weight
            if w > ex_prs.get("best_weight", 0):
                ex_prs["best_weight"] = w
                new_prs.append({
                    "exercise_id": exercise_id,
                    "exercise_name": exercise_name,
                    "pr_type": "weight",
                    "value": w,
                    "reps": r,
                    "weight_kg": w,
                    "date": date,
                    "workout_id": workout_id,
                    "set_id": set_id,
                })

            # PR: best estimated 1RM
            if w > 0 and r > 0:
                est = estimate_1rm(w, r)
                if est > ex_prs.get("best_1rm", 0):
                    ex_prs["best_1rm"] = est
                    new_prs.append({
                        "exercise_id": exercise_id,
                        "exercise_name": exercise_name,
                        "pr_type": "1rm",
                        "value": est,
                        "reps": r,
                        "weight_kg": w,
                        "date": date,
                        "workout_id": workout_id,
                        "set_id": set_id,
                    })

            # PR: best single-set volume
            vol = w * r
            if vol > ex_prs.get("best_volume_set", 0):
                ex_prs["best_volume_set"] = vol
                new_prs.append({
                    "exercise_id": exercise_id,
                    "exercise_name": exercise_name,
                    "pr_type": "volume",
                    "value": round(vol, 1),
                    "reps": r,
                    "weight_kg": w,
                    "date": date,
                    "workout_id": workout_id,
                    "set_id": set_id,
                })

            # PR: most reps (at any weight > 0)
            if r > ex_prs.get("best_reps", 0) and w > 0:
                ex_prs["best_reps"] = r
                new_prs.append({
                    "exercise_id": exercise_id,
                    "exercise_name": exercise_name,
                    "pr_type": "reps",
                    "value": r,
                    "reps": r,
                    "weight_kg": w,
                    "date": date,
                    "workout_id": workout_id,
                    "set_id": set_id,
                })

            # Set records: best weight per rep count
            if w > 0 and r > 0:
                rep_key = str(r)
                current_best = ex_prs.get("set_records", {}).get(rep_key, {}).get("weight_kg", 0)
                if w > current_best:
                    if "set_records" not in ex_prs:
                        ex_prs["set_records"] = {}
                    ex_prs["set_records"][rep_key] = {
                        "weight_kg": w,
                        "date": date,
                        "workout_id": workout_id,
                    }

        prs_db[exercise_id] = ex_prs

    _save_prs(prs_db)
    return new_prs


# ── Exercise Stats ──────────────────────────────────────────────────────────

def get_exercise_stats(exercise_id: str) -> dict:
    """Full statistics for a specific exercise."""
    prs_db = _load_prs()
    workouts = _load_workouts()
    lib_entry = EXERCISE_LIBRARY.get(exercise_id, {})

    ex_prs = prs_db.get(exercise_id, {})

    # Build history from completed workouts
    history = []
    total_times = 0
    last_performed = None

    completed = [w for w in workouts.values() if w.get("status") == "completed"]
    completed.sort(key=lambda w: w.get("finished_at", ""))

    for w in completed:
        for ex in w.get("exercises", []):
            if ex.get("exercise_id") != exercise_id:
                continue

            total_times += 1
            w_date = (w.get("finished_at") or w.get("started_at", ""))[:10]
            last_performed = w_date

            top_weight = 0
            top_reps = 0
            total_vol = 0
            best_1rm = 0

            for s in ex.get("sets", []):
                if not s.get("completed"):
                    continue
                sw = s.get("weight_kg") or 0
                sr = s.get("reps") or 0
                total_vol += sw * sr
                if sw > top_weight or (sw == top_weight and sr > top_reps):
                    top_weight = sw
                    top_reps = sr
                if sw > 0 and sr > 0:
                    est = estimate_1rm(sw, sr)
                    if est > best_1rm:
                        best_1rm = est

            history.append({
                "date": w_date,
                "estimated_1rm": best_1rm if best_1rm > 0 else None,
                "total_volume": round(total_vol, 1),
                "top_set_weight": top_weight,
                "top_set_reps": top_reps,
            })

    return {
        "exercise_id": exercise_id,
        "exercise_name": lib_entry.get("name", exercise_id),
        "estimated_1rm": ex_prs.get("best_1rm"),
        "best_weight": ex_prs.get("best_weight"),
        "best_volume_set": ex_prs.get("best_volume_set"),
        "best_total_volume": max((h["total_volume"] for h in history), default=None),
        "total_times_performed": total_times,
        "last_performed": last_performed,
        "set_records": ex_prs.get("set_records", {}),
        "history": history[-30:],  # last 30 sessions max
    }


# ── Muscle Volume Analytics ─────────────────────────────────────────────────

def get_muscle_volume(days: int = 7) -> list:
    """Sets and volume per muscle group in the last N days."""
    workouts = _load_workouts()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    volume_map: dict[str, dict] = {}

    for w in workouts.values():
        if w.get("status") != "completed":
            continue
        if (w.get("finished_at") or "") < cutoff:
            continue

        for ex in w.get("exercises", []):
            muscle = ex.get("muscle_primary", "")
            if not muscle:
                continue

            if muscle not in volume_map:
                volume_map[muscle] = {"sets": 0, "volume_kg": 0.0}

            for s in ex.get("sets", []):
                if not s.get("completed"):
                    continue
                volume_map[muscle]["sets"] += 1
                sw = s.get("weight_kg") or 0
                sr = s.get("reps") or 0
                volume_map[muscle]["volume_kg"] += sw * sr

    total_sets = sum(v["sets"] for v in volume_map.values())

    results = []
    for muscle, data in volume_map.items():
        pct = round(data["sets"] / total_sets * 100, 1) if total_sets > 0 else 0
        results.append({
            "muscle": muscle,
            "label": MUSCLE_LABELS.get(muscle, muscle),
            "sets": data["sets"],
            "volume_kg": round(data["volume_kg"], 1),
            "percentage": pct,
        })

    results.sort(key=lambda r: r["sets"], reverse=True)
    return results


# ── Weekly Stats ────────────────────────────────────────────────────────────

def get_weekly_stats(weeks: int = 4) -> list:
    """Weekly training summaries for the last N weeks."""
    workouts = _load_workouts()
    now = datetime.now(timezone.utc)

    results = []
    for week_offset in range(weeks):
        week_end = now - timedelta(weeks=week_offset)
        week_start = week_end - timedelta(days=7)
        start_iso = week_start.isoformat()
        end_iso = week_end.isoformat()

        week_workouts = [
            w for w in workouts.values()
            if w.get("status") == "completed"
            and start_iso <= (w.get("finished_at") or "") <= end_iso
        ]

        total_vol = 0.0
        total_sets = 0
        total_dur = 0
        prs_count = 0
        muscle_sets: dict[str, dict] = {}

        for w in week_workouts:
            total_vol += w.get("total_volume_kg", 0)
            total_sets += w.get("total_sets", 0)
            total_dur += (w.get("duration_seconds") or 0) // 60
            prs_count += len(w.get("prs_hit", []))

            for ex in w.get("exercises", []):
                muscle = ex.get("muscle_primary", "")
                if not muscle:
                    continue
                if muscle not in muscle_sets:
                    muscle_sets[muscle] = {"sets": 0, "volume_kg": 0.0}
                for s in ex.get("sets", []):
                    if s.get("completed"):
                        muscle_sets[muscle]["sets"] += 1
                        muscle_sets[muscle]["volume_kg"] += (s.get("weight_kg") or 0) * (s.get("reps") or 0)

        total_m_sets = sum(v["sets"] for v in muscle_sets.values())
        muscle_dist = []
        for m, d in muscle_sets.items():
            pct = round(d["sets"] / total_m_sets * 100, 1) if total_m_sets > 0 else 0
            muscle_dist.append({
                "muscle": m,
                "label": MUSCLE_LABELS.get(m, m),
                "sets": d["sets"],
                "volume_kg": round(d["volume_kg"], 1),
                "percentage": pct,
            })
        muscle_dist.sort(key=lambda x: x["sets"], reverse=True)

        results.append({
            "week_start": week_start.strftime("%Y-%m-%d"),
            "workouts_count": len(week_workouts),
            "total_volume_kg": round(total_vol, 1),
            "total_sets": total_sets,
            "total_duration_min": total_dur,
            "muscle_distribution": muscle_dist,
            "prs_count": prs_count,
        })

    return results


# ── Calendar ────────────────────────────────────────────────────────────────

def get_calendar(year: int, month: int) -> list:
    """Training days for a given month. Also merges data from exercise_history.json."""
    import calendar

    workouts = _load_workouts()

    # Build day map from v2 workouts
    day_map: dict[str, dict] = {}
    for w in workouts.values():
        if w.get("status") != "completed":
            continue
        w_date = (w.get("finished_at") or w.get("started_at", ""))[:10]
        if not w_date.startswith(f"{year:04d}-{month:02d}"):
            continue

        if w_date not in day_map:
            day_map[w_date] = {
                "date": w_date,
                "trained": True,
                "workout_names": [],
                "total_volume_kg": 0.0,
                "muscles_hit": set(),
                "source": set(),
            }

        day_map[w_date]["workout_names"].append(w.get("name", ""))
        day_map[w_date]["total_volume_kg"] += w.get("total_volume_kg", 0)
        for ex in w.get("exercises", []):
            if ex.get("muscle_primary"):
                day_map[w_date]["muscles_hit"].add(ex["muscle_primary"])
        day_map[w_date]["source"].add("manual")

    # Also merge from legacy exercise_history.json
    history_file = os.path.join(_DIR, "exercise_history.json")
    if os.path.exists(history_file):
        with open(history_file, "r", encoding="utf-8") as f:
            history_data = json.load(f)
        for date_key, entry in history_data.items():
            if not date_key.startswith(f"{year:04d}-{month:02d}"):
                continue
            if date_key not in day_map:
                day_map[date_key] = {
                    "date": date_key,
                    "trained": True,
                    "workout_names": [],
                    "total_volume_kg": 0.0,
                    "muscles_hit": set(),
                    "source": set(),
                }
            burned = entry.get("burned_kcal", 0)
            if burned > 0:
                day_map[date_key]["trained"] = True
            sources = entry.get("sources", [])
            for src in sources:
                day_map[date_key]["source"].add(src)

    # Build full month calendar
    _, num_days = calendar.monthrange(year, month)
    result = []
    for day_num in range(1, num_days + 1):
        date_str = f"{year:04d}-{month:02d}-{day_num:02d}"
        if date_str in day_map:
            entry = day_map[date_str]
            result.append({
                "date": date_str,
                "trained": entry["trained"],
                "workout_names": entry["workout_names"],
                "total_volume_kg": round(entry["total_volume_kg"], 1),
                "muscles_hit": list(entry["muscles_hit"]),
                "source": list(entry["source"]),
            })
        else:
            result.append({
                "date": date_str,
                "trained": False,
                "workout_names": [],
                "total_volume_kg": 0,
                "muscles_hit": [],
                "source": [],
            })

    return result


# ── Recent PRs ──────────────────────────────────────────────────────────────

def get_recent_prs(limit: int = 20) -> list:
    """Get most recent PRs across all exercises."""
    workouts = _load_workouts()
    all_prs = []

    completed = [w for w in workouts.values() if w.get("status") == "completed"]
    completed.sort(key=lambda w: w.get("finished_at", ""), reverse=True)

    for w in completed:
        for pr in w.get("prs_hit", []):
            all_prs.append(pr)
            if len(all_prs) >= limit:
                return all_prs

    return all_prs
