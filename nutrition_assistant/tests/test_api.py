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

def test_export_csv():
    """GET /export?format=csv returns a CSV file download."""
    r = client.get("/export?format=csv&from=2026-01-01&to=2026-03-23")
    assert r.status_code == 200
    assert "text/csv" in r.headers.get("content-type", "")
    assert "attachment" in r.headers.get("content-disposition", "")

def test_export_xlsx():
    """GET /export?format=xlsx returns an XLSX file download."""
    r = client.get("/export?format=xlsx&from=2026-01-01&to=2026-03-23")
    assert r.status_code == 200
    assert "spreadsheetml" in r.headers.get("content-type", "") or \
           "octet-stream" in r.headers.get("content-type", "")

def test_micronutrients_history_returns_structure():
    """GET /micronutrients/history returns daily array."""
    r = client.get("/micronutrients/history?days=7")
    assert r.status_code == 200
    body = r.json()
    assert "history" in body
    assert isinstance(body["history"], list)
    assert len(body["history"]) == 7
    for entry in body["history"]:
        assert "date" in entry
        assert "totals" in entry

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


def test_food_search_includes_micronutrients():
    """Food search results include micronutrient fields (may be null)."""
    from unittest.mock import patch, MagicMock
    import urllib.request
    import json as _json

    mock_response = {
        "products": [{
            "product_name": "Arroz cocido",
            "nutriments": {
                "energy-kcal_100g": 130,
                "fiber_100g": 0.3,
                "sodium_100g": 0.001,
                "potassium_100g": 0.035,
                "vitamin-a_100g": None,
                "vitamin-c_100g": 0,
                "calcium_100g": 0.01,
                "iron_100g": 0.002,
            },
            "image_small_url": None,
        }]
    }

    class FakeResp:
        def read(self): return _json.dumps(mock_response).encode()
        def __enter__(self): return self
        def __exit__(self, *a): pass

    with patch("urllib.request.urlopen", return_value=FakeResp()):
        r = client.get("/food/search?q=arroz")
        assert r.status_code == 200
        results = r.json()["results"]
        assert len(results) == 1
        result = results[0]
        assert "fiber_g" in result
        assert "sodium_mg" in result
        assert "potassium_mg" in result
        assert "calcium_mg" in result
        assert "iron_mg" in result


def test_calculate_rda_male():
    """RDA values are reasonable for an adult male."""
    from calculator import calculate_rda
    rda = calculate_rda(gender="male", age=30, weight_kg=80)
    assert rda["calcium_mg"] == 1000
    assert rda["iron_mg"] == 8
    assert rda["vitamin_c_mg"] == 80
    assert "protein_g" not in rda


def test_put_micronutrient_goals(tmp_path):
    """PUT /profile/micronutrient-goals saves and returns goals."""
    from unittest.mock import patch
    import storage
    with patch.object(storage, "PROFILE_FILE", str(tmp_path / "profile.json")):
        client.put("/profile", json={
            "name": "Test", "gender": "male", "age": 30,
            "height_cm": 175, "weight_kg": 80,
            "activity_level": 2, "goal": "maintain", "week_start_day": 0
        })
        goals = {"calcium_mg": 1200, "iron_mg": 10, "vitamin_c_mg": 100,
                 "fiber_g": 30, "sodium_mg": 2000}
        r = client.put("/profile/micronutrient-goals", json=goals)
        assert r.status_code == 200
        assert r.json()["ok"] is True

def test_micronutrients_today_returns_structure():
    """GET /micronutrients/today returns the expected keys."""
    r = client.get("/micronutrients/today", headers={"X-User-Timezone": "Europe/Madrid"})
    assert r.status_code == 200
    body = r.json()
    assert "totals" in body
    assert "goals" in body
    assert isinstance(body["totals"], dict)
    # All 11 MICRO_KEYS present
    micro_keys = ["fiber_g", "sodium_mg", "potassium_mg", "vitamin_a_mcg",
                  "vitamin_c_mg", "vitamin_d_mcg", "vitamin_b12_mcg",
                  "calcium_mg", "iron_mg", "magnesium_mg", "zinc_mg"]
    for key in micro_keys:
        assert key in body["totals"]
    # Values default to None (not 0) when no data
    for val in body["totals"].values():
        assert val is None or isinstance(val, (int, float))
