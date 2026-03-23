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


def test_post_and_get_cheatday(tmp_path):
    from unittest.mock import patch

    cheatday_file = tmp_path / "cheatday_history.json"
    payload = {
        "id": "2026-03-20",
        "date": "2026-03-20",
        "weekStart": "2026-03-16",
        "active": True,
        "excess": 450,
        "compensating": True,
        "compensation": [
            {"date": "2026-03-21", "extra_deficit": 150},
            {"date": "2026-03-22", "extra_deficit": 150},
            {"date": "2026-03-23", "extra_deficit": 150},
        ],
    }

    with patch("api.CHEATDAY_FILE", cheatday_file):
        r = client.post("/cheatday", json=payload)
        assert r.status_code == 200
        assert r.json()["ok"] is True

        r2 = client.get("/cheatday")
        assert r2.status_code == 200
        records = r2.json()["records"]
        assert len(records) == 1
        assert records[0]["date"] == "2026-03-20"


def test_get_reports_empty(tmp_path):
    """GET /reports returns empty list when no reports saved."""
    import api as _api
    from unittest.mock import patch
    with patch.object(_api, "REPORTS_DIR", tmp_path / "reports"):
        r = client.get("/reports")
        assert r.status_code == 200
        assert r.json()["reports"] == []

def test_get_reports_after_download(tmp_path):
    """After calling /report/download, GET /reports returns one entry."""
    import api as _api
    from unittest.mock import patch
    reports_dir = tmp_path / "reports"
    reports_dir.mkdir()

    with patch.object(_api, "REPORTS_DIR", reports_dir):
        r = client.get("/report/download")
        assert r.status_code == 200

        r2 = client.get("/reports")
        assert r2.status_code == 200
        reports = r2.json()["reports"]
        assert len(reports) == 1
        assert reports[0]["filename"].startswith("report_")
        assert reports[0]["filename"].endswith(".pdf")
        assert "url" in reports[0]

def test_adherence_metrics_7days():
    """GET /adherence/metrics?days=7 returns expected keys."""
    from unittest.mock import patch
    import adherence as adh_module
    from datetime import date, timedelta

    log = {}
    today = date.today()
    for i in range(7):
        d = (today - timedelta(days=i)).isoformat()
        log[d] = {
            "meals": {
                "desayuno": True, "almuerzo": True, "cena": i % 2 == 0,
            },
            "pct": 100 if i % 2 == 0 else 67,
        }

    with patch.object(adh_module, "_load", return_value=log):
        r = client.get("/adherence/metrics?days=7")
        assert r.status_code == 200
        body = r.json()
        assert "meal_compliance" in body
        assert "daily_trend" in body
        assert "most_skipped" in body
        assert "current_streak" in body
        assert isinstance(body["daily_trend"], list)
        assert len(body["daily_trend"]) == 7
