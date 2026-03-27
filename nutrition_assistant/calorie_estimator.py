"""
Estimate calories for gym sessions parsed from Sheets/Excel.

The goal here is consistency, not physiological precision. The estimate should
scale with session size and training density so diet adjustments remain stable.
"""

from __future__ import annotations

from typing import Any


def estimate_session_calories(session: dict[str, Any]) -> int:
    exercises = session.get("exercises") or []
    if not exercises:
        return 0

    total_volume = sum(_to_float(ex.get("volume")) for ex in exercises)
    compound_count = sum(1 for ex in exercises if ex.get("compound"))
    exercise_count = len(exercises)

    # Baseline for showing up plus a simple workload heuristic:
    # - volume contributes gently
    # - compound lifts cost more
    # - extra exercise count accounts for longer sessions
    estimate = 90 + (total_volume * 0.05) + (compound_count * 18) + (exercise_count * 12)

    # Keep the output inside a sane gym-session range.
    return int(round(max(120, min(estimate, 900))))


def _to_float(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0
