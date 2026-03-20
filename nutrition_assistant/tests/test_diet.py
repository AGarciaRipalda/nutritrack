import pytest
from datetime import date, timedelta
from diet import generate_week_plan

# Helper: Monday of the week containing a given date
def monday_of(d: date) -> date:
    return d - timedelta(days=d.weekday())

def test_generate_week_plan_returns_7_days_keyed_by_iso_date():
    plan = generate_week_plan([], [], daily_target=1800)
    assert len(plan["days"]) == 7
    dates = [d["date"] for d in plan["days"]]
    # All dates are valid ISO strings
    for iso in dates:
        date.fromisoformat(iso)  # raises ValueError if invalid

def test_plan_days_have_day_name_field():
    plan = generate_week_plan([], [], daily_target=1800)
    for day in plan["days"]:
        assert "dayName" in day
        assert day["dayName"] in ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

def test_plan_generated_at_is_monday():
    plan = generate_week_plan([], [], daily_target=1800)
    generated_at = date.fromisoformat(plan["generated_at"])
    assert generated_at.weekday() == 0  # 0 = Monday

def test_plan_with_history_increases_target_for_high_exercise():
    history = [{
        "week_start": "2026-03-10",
        "avg_adherence": 0.85,
        "total_exercise_kcal": 2000,
        "weight_start": 75.0,
        "weight_end": 74.5,
        "weight_delta": -0.5,
        "days_logged": 7,
    }]
    plan_no_history = generate_week_plan([], [], daily_target=1800)
    plan_with_history = generate_week_plan([], [], daily_target=1800, history=history)
    base_kcal = plan_no_history["weekly_target_kcal"]
    adj_kcal  = plan_with_history["weekly_target_kcal"]
    # High exercise should increase target
    assert adj_kcal >= base_kcal

def test_plan_with_history_none_same_as_no_history():
    plan_a = generate_week_plan([], [], daily_target=1800, history=None)
    plan_b = generate_week_plan([], [], daily_target=1800)
    assert plan_a["weekly_target_kcal"] == plan_b["weekly_target_kcal"]

def test_each_day_has_five_meals():
    plan = generate_week_plan([], [], daily_target=1800)
    for day in plan["days"]:
        assert len(day["meals"]) == 5
