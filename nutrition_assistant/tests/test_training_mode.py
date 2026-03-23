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
