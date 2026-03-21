import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from api import app

client = TestClient(app)

@pytest.fixture(autouse=True)
def mock_storage(tmp_path):
    """Isolate all file I/O."""
    import storage
    # NOTE: storage.PROFILE_FILE is confirmed to exist in storage.py (line 5).
    # NOTE: storage.SESSION_FILE is confirmed to exist in storage.py (line 6).
    with patch.object(storage, "SESSION_FILE", str(tmp_path / "session.json")), \
         patch.object(storage, "PROFILE_FILE", str(tmp_path / "profile.json")):
        yield

def test_get_today_diet_returns_plan_day():
    r = client.get("/diet/today", headers={"X-User-Timezone": "Europe/Madrid"})
    assert r.status_code == 200
    body = r.json()
    assert "date" in body
    assert "dayName" in body
    assert "meals" in body
    assert isinstance(body["meals"], list)
    assert "stale" in body

def test_get_weekly_plan_returns_days_list():
    r = client.get("/diet/weekly")
    assert r.status_code == 200
    body = r.json()
    assert "days" in body
    assert isinstance(body["days"], list)
    assert "stale" in body
    assert "summary" in body

def test_regenerate_weekly_plan_accepts_apply_from():
    r = client.post("/diet/weekly/regenerate", json={"apply_from": "tomorrow"})
    assert r.status_code == 200
    body = r.json()
    assert "days" in body

def test_swap_meal_returns_plan_day():
    # First generate a plan
    client.get("/diet/today")
    r = client.post("/diet/today/swap", json={"meal_id": "desayuno"})
    assert r.status_code == 200
    body = r.json()
    assert "meals" in body
    assert "date" in body

def test_exercise_logged_but_no_plan_auto_generates_and_applies_adj(tmp_path):
    """Edge case: exercise_adj exists in session but no week_plan.
    GET /diet/today must auto-generate the plan first, then apply the adjustment."""
    import storage, json
    from datetime import date
    today = date.today().isoformat()
    import storage as _storage
    week = _storage._this_week()
    session = {
        "saved_date": today,
        "saved_week": week,
        "exercise_adj": {
            today: {"extra_kcal": 400, "source": "running 30min"}
        },
    }
    session_file = str(tmp_path / "session_edge.json")
    with open(session_file, "w") as f:
        json.dump(session, f)
    with patch.object(storage, "SESSION_FILE", session_file):
        r = client.get("/diet/today", headers={"X-User-Timezone": "UTC"})
    assert r.status_code == 200
    body = r.json()
    assert "exerciseAdj" in body, "exerciseAdj must be present when exercise_adj[today] is set"
    assert body["exerciseAdj"]["extraKcal"] == 400
    assert body["exerciseAdj"]["source"] == "running 30min"
