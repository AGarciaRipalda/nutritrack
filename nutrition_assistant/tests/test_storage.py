import pytest, json, os, tempfile
from unittest.mock import patch

import storage

@pytest.fixture(autouse=True)
def tmp_session(tmp_path):
    fake = str(tmp_path / "session.json")
    with patch.object(storage, "SESSION_FILE", fake):
        yield fake

def test_save_and_load_exercise_adj(tmp_session):
    storage.save_exercise_adj("2026-03-18", 320, "running 45min")
    session = storage.load_session()
    assert session["exercise_adj"]["2026-03-18"]["extra_kcal"] == 320
    assert session["exercise_adj"]["2026-03-18"]["source"] == "running 45min"

def test_save_and_load_weekly_history(tmp_session):
    summary = {
        "week_start": "2026-03-10",
        "avg_adherence": 0.82,
        "total_exercise_kcal": 1540,
        "weight_start": 74.2,
        "weight_end": 73.8,
        "weight_delta": -0.4,
        "days_logged": 6,
    }
    storage.save_weekly_history(summary)
    history = storage.load_weekly_history()
    assert len(history) == 1
    assert history[0]["week_start"] == "2026-03-10"

def test_weekly_history_newest_first(tmp_session):
    storage.save_weekly_history({"week_start": "2026-03-03", "avg_adherence": 0.7, "total_exercise_kcal": 500, "weight_start": None, "weight_end": None, "weight_delta": None, "days_logged": 5})
    storage.save_weekly_history({"week_start": "2026-03-10", "avg_adherence": 0.85, "total_exercise_kcal": 800, "weight_start": None, "weight_end": None, "weight_delta": None, "days_logged": 7})
    history = storage.load_weekly_history()
    assert history[0]["week_start"] == "2026-03-10"  # newest first

def test_weekly_history_deduplicates_same_week(tmp_session):
    summary_v1 = {"week_start": "2026-03-10", "avg_adherence": 0.5, "total_exercise_kcal": 0, "weight_start": None, "weight_end": None, "weight_delta": None, "days_logged": 3}
    summary_v2 = {"week_start": "2026-03-10", "avg_adherence": 0.9, "total_exercise_kcal": 1200, "weight_start": None, "weight_end": None, "weight_delta": None, "days_logged": 7}
    storage.save_weekly_history(summary_v1)
    storage.save_weekly_history(summary_v2)
    history = storage.load_weekly_history()
    assert len(history) == 1
    assert history[0]["avg_adherence"] == 0.9  # latest version wins

def test_weekly_history_capped_at_12(tmp_session):
    for i in range(15):
        storage.save_weekly_history({
            "week_start": f"2025-01-{i+1:02d}",
            "avg_adherence": 0.8,
            "total_exercise_kcal": 0,
            "weight_start": None,
            "weight_end": None,
            "weight_delta": None,
            "days_logged": 0,
        })
    history = storage.load_weekly_history()
    assert len(history) == 12

def test_exercise_adj_persists_across_save_session(tmp_session):
    storage.save_exercise_adj("2026-03-19", 200, "cycling")
    storage.save_session(week_plan={"days": []})
    session = storage.load_session()
    assert "2026-03-19" in session.get("exercise_adj", {})
