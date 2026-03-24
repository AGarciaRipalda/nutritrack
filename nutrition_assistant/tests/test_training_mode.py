import json
import os
import sys
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from fastapi.testclient import TestClient
import storage
from api import app

client = TestClient(app)


def test_profile_default_training_mode_is_gym(tmp_path):
    """Profile returns training_mode=gym by default."""
    with patch.object(storage, "PROFILE_FILE", str(tmp_path / "profile.json")):
        client.put("/profile", json={
            "name": "Test", "gender": "male", "age": 30, "height_cm": 175,
            "weight_kg": 80, "activity_level": 2, "goal": "maintain", "week_start_day": 0
        })
        r = client.get("/profile")
        assert r.status_code == 200
        assert r.json().get("training_mode", "gym") == "gym"


def test_put_profile_saves_training_mode_home(tmp_path):
    """PUT /profile saves training_mode=home."""
    with patch.object(storage, "PROFILE_FILE", str(tmp_path / "profile.json")):
        r = client.put("/profile", json={
            "name": "Test", "gender": "male", "age": 30, "height_cm": 175,
            "weight_kg": 80, "activity_level": 2, "goal": "maintain",
            "week_start_day": 0, "training_mode": "home"
        })
        assert r.status_code == 200
        r2 = client.get("/profile")
        assert r2.json()["training_mode"] == "home"


def test_put_profile_saves_training_mode_gym(tmp_path):
    """PUT /profile saves training_mode=gym."""
    with patch.object(storage, "PROFILE_FILE", str(tmp_path / "profile.json")):
        r = client.put("/profile", json={
            "name": "Test", "gender": "male", "age": 30, "height_cm": 175,
            "weight_kg": 80, "activity_level": 2, "goal": "maintain",
            "week_start_day": 0, "training_mode": "gym"
        })
        assert r.status_code == 200
        r2 = client.get("/profile")
        assert r2.json()["training_mode"] == "gym"


def test_dashboard_applies_home_training_multiplier(tmp_path):
    """GET /dashboard applies 0.85 multiplier to bonus_kcal when training_mode=home."""
    import weight_tracker

    base_profile = {
        "name": "Test", "gender": "male", "age": 30, "height_cm": 175,
        "weight_kg": 80, "activity_level": 2, "goal": "maintain",
        "week_start_day": 0,
    }
    from datetime import date
    today_iso = date.today().isoformat()
    session_data = json.dumps({
        "saved_date": today_iso,
        "today_training": {"bonus_kcal": 400, "training_type": "weights"},
    })

    weight_file = tmp_path / "weight_history.json"
    weight_file.write_text(json.dumps([]))

    # --- home mode ---
    profile_home = tmp_path / "profile_home.json"
    profile_home.write_text(json.dumps({**base_profile, "training_mode": "home"}))
    session_home = tmp_path / "session_home.json"
    session_home.write_text(session_data)

    with (
        patch.object(storage, "PROFILE_FILE", str(profile_home)),
        patch.object(storage, "SESSION_FILE", str(session_home)),
        patch.object(weight_tracker, "HISTORY_FILE", weight_file),
    ):
        r_home = client.get("/dashboard")
        assert r_home.status_code == 200
        target_home = r_home.json()["nutrition"]["daily_target"]

    # --- gym mode ---
    profile_gym = tmp_path / "profile_gym.json"
    profile_gym.write_text(json.dumps({**base_profile, "training_mode": "gym"}))
    session_gym = tmp_path / "session_gym.json"
    session_gym.write_text(session_data)

    with (
        patch.object(storage, "PROFILE_FILE", str(profile_gym)),
        patch.object(storage, "SESSION_FILE", str(session_gym)),
        patch.object(weight_tracker, "HISTORY_FILE", weight_file),
    ):
        r_gym = client.get("/dashboard")
        assert r_gym.status_code == 200
        target_gym = r_gym.json()["nutrition"]["daily_target"]

    # home bonus = round(400 * 0.85) = 340; gym bonus = 400
    # so home daily_target must be lower than gym daily_target
    assert target_home < target_gym, (
        f"Expected home target ({target_home}) < gym target ({target_gym}) "
        "because 0.85 multiplier reduces bonus from 400 to 340"
    )
