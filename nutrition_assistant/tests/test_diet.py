import pytest
from datetime import date, timedelta
from diet import generate_week_plan, get_day_from_plan

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

def test_reference_date_determines_monday():
    from datetime import date
    # Pass a specific reference_date and verify generated_at is the Monday of that week
    # 2026-03-18 is a Wednesday → Monday of that week is 2026-03-16
    ref = date(2026, 3, 18)
    plan = generate_week_plan([], [], daily_target=1800, reference_date=ref)
    assert plan["generated_at"] == "2026-03-16"
    # Also verify the first day in the plan is that Monday
    assert plan["days"][0]["date"] == "2026-03-16"
    assert plan["days"][0]["dayName"] == "Lunes"

def test_minimum_target_is_1200_kcal():
    # History with very low adherence and calorie deficit to trigger floor
    history = [{
        "week_start": "2026-03-10",
        "avg_adherence": 0.1,  # very low
        "total_exercise_kcal": 0,
        "weight_start": 60.0,
        "weight_end": 60.5,
        "weight_delta": 0.5,  # gaining → -100 kcal adjustment
        "days_logged": 7,
    }]
    plan = generate_week_plan([], [], daily_target=1200, history=history)
    assert plan["weekly_target_kcal"] >= 1200


@pytest.fixture
def sample_plan():
    return generate_week_plan([], [], daily_target=1800)

def test_get_day_from_plan_returns_correct_day(sample_plan):
    today = date.today()
    monday = today - timedelta(days=today.weekday())
    iso = monday.isoformat()
    result = get_day_from_plan(iso, sample_plan, exercise_adj={})
    assert result is not None
    assert result["date"] == iso

def test_get_day_from_plan_returns_none_for_missing_date(sample_plan):
    result = get_day_from_plan("2020-01-01", sample_plan, exercise_adj={})
    assert result is None

def test_get_day_from_plan_applies_exercise_adj(sample_plan):
    today = date.today()
    monday = today - timedelta(days=today.weekday())
    iso = monday.isoformat()
    adj = {iso: {"extra_kcal": 300, "source": "running 30min"}}
    result = get_day_from_plan(iso, sample_plan, exercise_adj=adj)
    assert result["exerciseAdj"] is not None
    assert result["exerciseAdj"]["extraKcal"] == 300
    # Each meal should have portionScale > 1.0
    for meal in result["meals"]:
        assert meal.get("portionScale", 1.0) > 1.0

def test_portion_scale_capped_at_1_5(sample_plan):
    today = date.today()
    monday = today - timedelta(days=today.weekday())
    iso = monday.isoformat()
    # Extreme exercise to force cap
    adj = {iso: {"extra_kcal": 99999, "source": "extreme"}}
    result = get_day_from_plan(iso, sample_plan, exercise_adj=adj)
    for meal in result["meals"]:
        assert meal.get("portionScale", 1.0) <= 1.5

def test_get_day_from_plan_no_exercise_adj_no_scale(sample_plan):
    today = date.today()
    iso = (today - timedelta(days=today.weekday())).isoformat()
    result = get_day_from_plan(iso, sample_plan, exercise_adj={})
    assert result.get("exerciseAdj") is None
    for meal in result["meals"]:
        assert meal.get("portionScale") is None
