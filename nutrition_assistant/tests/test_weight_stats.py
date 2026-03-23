import json
import os
import sys
from datetime import date, timedelta
from unittest.mock import patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from fastapi.testclient import TestClient
import weight_tracker
from api import app

client = TestClient(app)


def _write_weight_history(tmp_path, entries):
    p = tmp_path / "weight_history.json"
    p.write_text(json.dumps(entries))
    return p


def test_weight_stats_no_entries(tmp_path):
    hist_file = _write_weight_history(tmp_path, [])
    with patch.object(weight_tracker, "HISTORY_FILE", hist_file):
        r = client.get("/weight/stats")
        assert r.status_code == 200
        data = r.json()
        assert data["weekly_avg"] is None
        assert data["entries_count"] == 0


def test_weight_stats_returns_avg_of_last_7_days(tmp_path):
    today = date.today()
    entries = [
        {"date": (today - timedelta(days=i)).isoformat(), "week": "2026-W12", "weight_kg": 80.0 - i}
        for i in range(10)
    ]
    hist_file = _write_weight_history(tmp_path, entries)
    with patch.object(weight_tracker, "HISTORY_FILE", hist_file):
        r = client.get("/weight/stats")
        assert r.status_code == 200
        data = r.json()
        assert data["entries_count"] == 7
        # Days 0-6: 80, 79, 78, 77, 76, 75, 74 → avg = 77.0
        assert abs(data["weekly_avg"] - 77.0) < 0.01


def test_weight_stats_fewer_than_7_entries(tmp_path):
    today = date.today()
    entries = [
        {"date": (today - timedelta(days=i)).isoformat(), "week": "2026-W12", "weight_kg": 80.0}
        for i in range(3)
    ]
    hist_file = _write_weight_history(tmp_path, entries)
    with patch.object(weight_tracker, "HISTORY_FILE", hist_file):
        r = client.get("/weight/stats")
        assert r.status_code == 200
        data = r.json()
        assert data["entries_count"] == 3
        assert abs(data["weekly_avg"] - 80.0) < 0.01
