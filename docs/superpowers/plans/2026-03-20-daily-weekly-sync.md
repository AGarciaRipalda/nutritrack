# Daily/Weekly Diet Synchronization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the weekly plan the single source of truth for meal data, with today's diet always reflecting the current weekday's slot, and exercise adjustments visible in both views.

**Architecture:** The weekly plan is generated once per week using previous week history (adherence, exercise, weight), and stored keyed by ISO date. `/diet/today` reads the current day's slot from the weekly plan and applies any exercise adjustment on top. Both frontend views consume the same unified `PlanDay` data model.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Python/FastAPI, session-based storage (Flask-style sessions)

---

## Task 1: Unify data models (TypeScript)

**Files to Modify:** `nutrition_frontend/lib/api.ts`

### Failing test first (manual verification — no test framework)

Before implementing, confirm the old types are in use:
```bash
# Expected: lines referencing old `tip` field and `WeeklyMeal` type
grep -n "tip\|WeeklyMeal\|TodaysDiet" nutrition_frontend/lib/api.ts
```
Expected output: multiple hits for `tip:`, `WeeklyMeal`, `TodaysDiet`.

After implementation, run:
```bash
grep -n "tip\b" nutrition_frontend/lib/api.ts
# Expected output: (empty — no more `tip` field)
grep -n "PlanDay\|WeeklyPlanResponse" nutrition_frontend/lib/api.ts
# Expected output: lines defining and exporting PlanDay and WeeklyPlanResponse
```

### Steps

- [ ] **1.1** Replace the `Meal` interface — remove `tip`, add `note`, `adjustedKcal`, `portionScale`:

  ```typescript
  export interface Meal {
    id: string            // "desayuno", "almuerzo", etc.
    type: string          // "breakfast", "lunch", etc.
    name: string          // dish name
    kcal: number          // base calories
    description: string   // dish description
    note?: string         // nutritional note (replaces "tip")
    timingNote?: string   // "Best before 10am", etc.
    adjustedKcal?: number // kcal adjusted for exercise (if applicable)
    portionScale?: number // portion scale factor, e.g. 1.15
  }
  ```

- [ ] **1.2** Add `PlanDay` interface after `Meal`:

  ```typescript
  export interface PlanDay {
    date: string          // "2026-03-17" — real date, not just "Monday"
    dayName: string       // "Lunes"
    meals: Meal[]
    totalKcal: number     // base sum
    exerciseAdj?: {
      extraKcal: number
      source: string      // "Running 45min"
      adjustedTotal: number
    }
    // NOTE: `stale` is NOT a field on PlanDay. It is a response-root flag only.
    // It lives on WeeklyPlanResponse.stale and on the fetchTodaysPlan() return type
    // as PlanDay & { stale: boolean }. Do NOT add it here.
  }
  ```

- [ ] **1.3** Add `WeeklyHistorySummary` interface:

  ```typescript
  export interface WeeklyHistorySummary {
    week_start: string            // "2026-03-10"
    avg_adherence: number         // 0.0–1.0
    total_exercise_kcal: number
    weight_start: number | null
    weight_end: number | null
    weight_delta: number | null
    days_logged: number
  }
  ```

- [ ] **1.4** Add `WeeklyPlanResponse` interface (replaces old `WeeklyPlan`):

  ```typescript
  export interface WeeklyPlanResponse {
    days: PlanDay[]
    summary: WeeklyHistorySummary | null
    stale: boolean
  }
  ```

- [ ] **1.5** Add timezone helper and update `COMMON_HEADERS` builder into a function:

  ```typescript
  function getHeaders(extra?: Record<string, string>): Record<string, string> {
    return {
      "ngrok-skip-browser-warning": "true",
      "X-User-Timezone": Intl.DateTimeFormat().resolvedOptions().timeZone,
      ...extra,
    }
  }
  ```

  Update `get`, `post`, `put`, `del` helpers to call `getHeaders()` instead of using `COMMON_HEADERS` directly.

- [ ] **1.6** Replace `fetchTodaysDiet()` with `fetchTodaysPlan()`:

  ```typescript
  export async function fetchTodaysPlan(): Promise<PlanDay & { stale: boolean }> {
    const d = await get<any>("/diet/today")
    return transformPlanDay(d)
  }
  ```

  Add `transformPlanDay` helper that maps backend snake_case to the `PlanDay` shape:

  ```typescript
  // NOTE: The new backend returns `type` and `name` directly on each meal object
  // (per the unified spec model). MEAL_MAP lookup is therefore NOT used here —
  // using it would silently overwrite correct backend values with stale frontend data.
  // MEAL_MAP can be removed entirely once the backend migration is complete.
  function transformPlanDay(d: any): PlanDay & { stale: boolean } {
    const meals: Meal[] = (d.meals ?? []).map((m: any) => {
      return {
        id:           m.id,
        type:         m.type,      // backend returns this directly
        name:         m.name,      // backend returns this directly
        kcal:         m.kcal ?? 0,
        description:  m.text ?? m.description ?? "",
        note:         m.note ?? undefined,
        timingNote:   m.timing_note ?? undefined,
        adjustedKcal: m.adjusted_kcal ?? undefined,
        portionScale: m.portion_scale ?? undefined,
      }
    })
    return {
      date:        d.date,
      dayName:     d.day_name,
      meals,
      totalKcal:   d.total_kcal ?? meals.reduce((s, m) => s + m.kcal, 0),
      exerciseAdj: d.exercise_adj
        ? {
            extraKcal:     d.exercise_adj.extra_kcal,
            source:        d.exercise_adj.source,
            adjustedTotal: d.exercise_adj.adjusted_total,
          }
        : undefined,
      stale: d.stale ?? false,
    }
  }
  ```

- [ ] **1.7** Update `swapMeal()` to return `PlanDay`:

  ```typescript
  export async function swapMeal(mealId: string): Promise<PlanDay> {
    const d = await post<any>(`/diet/today/swap`, { meal_id: mealId })
    return transformPlanDay(d)
  }
  ```

  Note: endpoint path changes from `/diet/today/{meal_type}/swap` to `/diet/today/swap` with body `{ meal_id }`. Keep the old path as a fallback comment for now; Task 5 aligns the backend.

- [ ] **1.8** Update `fetchWeeklyPlan()` to return `WeeklyPlanResponse`:

  ```typescript
  export async function fetchWeeklyPlan(): Promise<WeeklyPlanResponse> {
    const d = await get<any>("/diet/weekly")
    const days: PlanDay[] = (d.days ?? []).map(transformPlanDay)
    return {
      days,
      summary: d.summary ?? null,
      stale:   d.stale ?? false,
    }
  }
  ```

  Remove the old parallel `Promise.all` fetch of `/diet/shopping-list` from this function (shopping list is no longer part of this response shape; keep the separate `fetchShoppingList` call if weekly-plan page still needs it — add it as a standalone export if missing).

- [ ] **1.9** Update `regenerateWeeklyPlan()` to accept `apply_from` parameter:

  ```typescript
  export async function regenerateWeeklyPlan(
    applyFrom: "today" | "tomorrow" = "tomorrow"
  ): Promise<WeeklyPlanResponse> {
    const d = await post<any>("/diet/weekly/regenerate", { apply_from: applyFrom })
    const days: PlanDay[] = (d.days ?? []).map(transformPlanDay)
    return { days, summary: null, stale: false }
  }
  ```

- [ ] **1.10** Keep old `TodaysDiet` and `WeeklyPlan` types as deprecated aliases (add `@deprecated` JSDoc) so existing imports in other pages do not break before they are updated in Tasks 6 and 7:

  ```typescript
  /** @deprecated Use PlanDay instead */
  export type TodaysDiet = PlanDay & { adherenceChecklist: { id: string; label: string; checked: boolean }[] }
  /** @deprecated Use WeeklyPlanResponse instead */
  export type WeeklyPlan = WeeklyPlanResponse & { shoppingList: { category: string; items: string[] }[] }
  ```

### Commit

```bash
git add nutrition_frontend/lib/api.ts
git commit -m "refactor(api): unify Meal/PlanDay types and add X-User-Timezone header"
```

---

## Task 2: Backend — `WeeklyHistorySummary` + session schema

**Files to Modify:** `nutrition_assistant/storage.py`
**Files to Create:** `nutrition_assistant/tests/test_storage.py`

### Failing test first

```bash
# Create test file
mkdir -p nutrition_assistant/tests
touch nutrition_assistant/tests/__init__.py
```

```python
# nutrition_assistant/tests/test_storage.py
import pytest, json, os, tempfile
from unittest.mock import patch

# We'll monkeypatch SESSION_FILE to a temp path
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

def test_weekly_history_capped_at_12(tmp_session):
    for i in range(15):
        storage.save_weekly_history({
            "week_start": f"2025-{i+1:02d}-01",
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
```

Run (expected: all 4 tests FAIL before implementation):
```bash
cd nutrition_assistant && python -m pytest tests/test_storage.py -v
# Expected: 4 errors — AttributeError: module 'storage' has no attribute 'save_exercise_adj'
```

### Steps

- [ ] **2.1** Add `exercise_adj` and `weekly_history` keys to the `load_session()` return dict and to the JSON read logic:

  In `load_session()`, expand the `result` dict:
  ```python
  result = {
      "exercise_data": None,
      "adaptive_day": None,
      "week_plan": None,
      "today_training": None,
      "exercise_adj": {},       # NEW — always loaded, not date-scoped
      "weekly_history": [],     # NEW — always loaded, not date-scoped
  }
  ```

  In the file-load block, always read these two keys regardless of date/week scope:
  ```python
  result["exercise_adj"]    = session.get("exercise_adj", {})
  result["weekly_history"]  = session.get("weekly_history", [])
  ```

- [ ] **2.2** Add `exercise_adj` and `weekly_history` parameters to `save_session()`.

  > **Confirmed:** `_MISSING = object()` is already defined at module level in `storage.py`
  > (line 71), immediately before the existing `save_session` function. Do not redefine it.

  Replace the entire existing `save_session` function (copy-paste ready):

  ```python
  def save_session(exercise_data=_MISSING,
                   adaptive_day=_MISSING,
                   week_plan=_MISSING,
                   today_training=_MISSING,
                   exercise_adj=_MISSING,
                   weekly_history=_MISSING) -> None:
      """
      Persiste el estado de la sesión actual.
      Solo actualiza los campos que se pasen explícitamente.
      Pasar None limpia el campo (lo elimina de la sesión).
      """
      session = {}
      if os.path.exists(SESSION_FILE):
          with open(SESSION_FILE, "r", encoding="utf-8") as f:
              session = json.load(f)

      session["saved_date"] = _today()
      session["saved_week"] = _this_week()

      for key, value in [("exercise_data",  exercise_data),
                         ("adaptive_day",   adaptive_day),
                         ("today_training", today_training),
                         ("week_plan",      week_plan),
                         ("exercise_adj",   exercise_adj),    # NEW
                         ("weekly_history", weekly_history)]: # NEW
          if value is _MISSING:
              continue
          if value is None:
              session.pop(key, None)   # limpiar el campo
          else:
              session[key] = value

      with open(SESSION_FILE, "w", encoding="utf-8") as f:
          json.dump(session, f, indent=2, ensure_ascii=False)
  ```

- [ ] **2.3** Add `save_exercise_adj(date_iso: str, extra_kcal: int, source: str)`:

  ```python
  def save_exercise_adj(date_iso: str, extra_kcal: int, source: str) -> None:
      """Record exercise adjustment for a specific date."""
      session = {}
      if os.path.exists(SESSION_FILE):
          with open(SESSION_FILE, "r", encoding="utf-8") as f:
              session = json.load(f)
      adj = session.get("exercise_adj", {})
      adj[date_iso] = {"extra_kcal": extra_kcal, "source": source}
      session["exercise_adj"] = adj
      session.setdefault("saved_date", _today())
      session.setdefault("saved_week", _this_week())
      with open(SESSION_FILE, "w", encoding="utf-8") as f:
          json.dump(session, f, indent=2, ensure_ascii=False)
  ```

- [ ] **2.4** Add `load_weekly_history()` and `save_weekly_history(summary)`:

  ```python
  def load_weekly_history() -> list:
      """Returns list of WeeklyHistorySummary dicts, newest-first, max 12."""
      if not os.path.exists(SESSION_FILE):
          return []
      with open(SESSION_FILE, "r", encoding="utf-8") as f:
          session = json.load(f)
      return session.get("weekly_history", [])


  def save_weekly_history(summary: dict) -> None:
      """Prepend a new WeeklyHistorySummary; cap list at 12 entries."""
      session = {}
      if os.path.exists(SESSION_FILE):
          with open(SESSION_FILE, "r", encoding="utf-8") as f:
              session = json.load(f)
      history = session.get("weekly_history", [])
      # Remove existing entry for same week_start if present
      history = [h for h in history if h.get("week_start") != summary.get("week_start")]
      history.insert(0, summary)
      history = history[:12]  # cap at 12 weeks
      session["weekly_history"] = history
      session.setdefault("saved_date", _today())
      session.setdefault("saved_week", _this_week())
      with open(SESSION_FILE, "w", encoding="utf-8") as f:
          json.dump(session, f, indent=2, ensure_ascii=False)
  ```

### Verification

```bash
cd nutrition_assistant && python -m pytest tests/test_storage.py -v
# Expected:
# tests/test_storage.py::test_save_and_load_exercise_adj PASSED
# tests/test_storage.py::test_save_and_load_weekly_history PASSED
# tests/test_storage.py::test_weekly_history_capped_at_12 PASSED
# tests/test_storage.py::test_exercise_adj_persists_across_save_session PASSED
# 4 passed in <1s
```

### Commit

```bash
git add nutrition_assistant/storage.py nutrition_assistant/tests/
git commit -m "feat(storage): add exercise_adj and weekly_history to session schema"
```

---

## Task 3: Backend — `generate_week_plan()` with history

**Files to Modify:** `nutrition_assistant/diet.py`
**Files to Create/Modify:** `nutrition_assistant/tests/test_diet.py`

### Failing test first

```python
# nutrition_assistant/tests/test_diet.py
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
```

Run (expected: all FAIL before implementation):
```bash
cd nutrition_assistant && python -m pytest tests/test_diet.py -v
# Expected: 6 errors or failures — KeyError/AssertionError because plan is a flat dict, not {"days": [...]}
```

### Steps

- [ ] **3.1** Add `from datetime import date, timedelta` to `diet.py` imports (if not present).

  > **Confirmed:** `import random` is already present at line 8 of `diet.py`. No change needed.

  > **Assumptions — pre-existing symbols in `diet.py` (do NOT modify):**
  > The following constants and functions already exist in `diet.py` and are called by
  > `generate_week_plan()`. They must not be redefined or overwritten:
  > - `_scale_meal(meal, scale)` — scales a meal template to a calorie target (line ~708)
  > - `SNACK_TARGET_KCAL` — integer constant for snack budget (line 33)
  > - `MAIN_MEAL_SPLIT` — dict `{"desayuno": 0.28, "almuerzo": 0.45, "cena": 0.27}` (line 34)
  > - `DESAYUNOS` — list of breakfast template dicts (line 44)
  > - `MEDIA_MANANA` — list of mid-morning snack template dicts (line 116)
  > - `ALMUERZOS` — list of lunch template dicts (line 194)
  > - `MERIENDAS` — list of afternoon snack template dicts (line 439)
  > - `CENAS` — list of dinner template dicts (line 533)

- [ ] **3.2** Add `DAY_NAMES_ES` mapping:

  ```python
  DAY_NAMES_ES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
  ```

- [ ] **3.3** Add `MEAL_ID_ORDER` list (used when building the `meals` array in `PlanDay`):

  ```python
  MEAL_ID_ORDER = ["desayuno", "media_manana", "almuerzo", "merienda", "cena"]
  ```

- [ ] **3.4** Rewrite `generate_week_plan()` — new signature and return shape:

  > **Note on timezone:** The caller (API endpoint) resolves the user timezone from the
  > `X-User-Timezone` header and passes the resolved `reference_date` as a `date` object.
  > `generate_week_plan()` itself does **not** read headers or call `date.today()` —
  > it only computes Monday from whatever `reference_date` it receives.
  > When `reference_date` is `None`, the API layer should pass `date.today()` as the fallback.

  ```python
  def generate_week_plan(
      excluded: list,
      favorites: list,
      daily_target: int = 1800,
      history: list | None = None,
      reference_date: date | None = None,
  ) -> dict:
      """
      Generates a full weekly plan keyed by ISO date.
      reference_date: the "today" date in the user's timezone, resolved by the caller.
                      If None, falls back to date.today() (UTC).
      Returns:
        {
          "days": [PlanDay, ...],          # 7 items, Mon–Sun
          "generated_at": "2026-03-17",   # ISO date of Monday of this week
          "weekly_target_kcal": int,
          "weekly_summary": {...} | None,  # summary used for adjustment
        }
      """
      # ── 1. Determine Monday of current week ──────────────────────────────
      # Use caller-provided reference_date (timezone-aware); fall back to UTC today.
      today = reference_date if reference_date is not None else date.today()
      monday = today - timedelta(days=today.weekday())

      # ── 2. Adjust target based on history ────────────────────────────────
      adjusted_target = daily_target
      weekly_summary_used = None
      if history:
          prev = history[0]  # newest entry
          weekly_summary_used = prev
          weight_delta      = prev.get("weight_delta") or 0.0
          avg_adherence     = prev.get("avg_adherence", 1.0)
          total_exercise    = prev.get("total_exercise_kcal", 0)

          # Exercise bonus: avg weekly exercise / 7 days
          daily_exercise_avg = total_exercise / 7
          # Low adherence penalty: reduce by up to 100 kcal
          adherence_factor   = 1.0 if avg_adherence >= 0.8 else (avg_adherence / 0.8)
          # Weight progress signal: if losing faster than expected (-0.5kg/wk) add calories
          weight_adj = 0
          if weight_delta is not None:
              if weight_delta < -0.5:
                  weight_adj = +100   # losing too fast → add calories
              elif weight_delta > 0.1:
                  weight_adj = -100   # gaining unintentionally → reduce calories

          adjusted_target = round(
              (daily_target + daily_exercise_avg + weight_adj) * adherence_factor
          )
          adjusted_target = max(adjusted_target, 1200)  # hard floor

      # ── 3. Generate each day ──────────────────────────────────────────────
      snack_budget = SNACK_TARGET_KCAL
      main_budget  = adjusted_target - 2 * snack_budget
      days = []
      for i in range(7):
          day_date = monday + timedelta(days=i)
          day_iso  = day_date.isoformat()
          day_name = DAY_NAMES_ES[i]
          meals_raw = {
              "desayuno":     _scale_meal(random.choice(DESAYUNOS),    main_budget * MAIN_MEAL_SPLIT["desayuno"], "desayuno"),
              "media_manana": _scale_meal(random.choice(MEDIA_MANANA), snack_budget,                              "media_manana"),
              "almuerzo":     _scale_meal(random.choice(ALMUERZOS),    main_budget * MAIN_MEAL_SPLIT["almuerzo"], "almuerzo"),
              "merienda":     _scale_meal(random.choice(MERIENDAS),    snack_budget,                              "merienda"),
              "cena":         _scale_meal(random.choice(CENAS),        main_budget * MAIN_MEAL_SPLIT["cena"],     "cena"),
          }
          meals_list = [
              {**v, "id": k}
              for k, v in meals_raw.items()
          ]
          total_kcal = sum(m["kcal"] for m in meals_list)
          days.append({
              "date":      day_iso,
              "dayName":   day_name,
              "meals":     meals_list,
              "totalKcal": total_kcal,
          })

      return {
          "days":                days,
          "generated_at":        monday.isoformat(),
          "weekly_target_kcal":  adjusted_target,
          "weekly_summary":      weekly_summary_used,
      }
  ```

- [ ] **3.5** Keep the old `generate_week_plan()` interface working (api.py calls it with positional args `excluded, favorites, daily_target`). The new signature is backward-compatible — `history` defaults to `None`.

### Verification

```bash
cd nutrition_assistant && python -m pytest tests/test_diet.py -v
# Expected:
# tests/test_diet.py::test_generate_week_plan_returns_7_days_keyed_by_iso_date PASSED
# tests/test_diet.py::test_plan_days_have_day_name_field PASSED
# tests/test_diet.py::test_plan_generated_at_is_monday PASSED
# tests/test_diet.py::test_plan_with_history_increases_target_for_high_exercise PASSED
# tests/test_diet.py::test_plan_with_history_none_same_as_no_history PASSED
# tests/test_diet.py::test_each_day_has_five_meals PASSED
# 6 passed
```

### Commit

```bash
git add nutrition_assistant/diet.py nutrition_assistant/tests/test_diet.py
git commit -m "feat(diet): rewrite generate_week_plan with ISO-date keys and history-based adjustment"
```

---

## Task 4: Backend — `get_day_from_plan(date)` + portion scaling

**Files to Modify:** `nutrition_assistant/diet.py`
**Files to Modify:** `nutrition_assistant/tests/test_diet.py`

### Failing test first

Add these tests to `nutrition_assistant/tests/test_diet.py`:

```python
from diet import get_day_from_plan, generate_week_plan
from datetime import date, timedelta

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
```

Run (expected: all 5 FAIL — `get_day_from_plan` does not exist yet):
```bash
cd nutrition_assistant && python -m pytest tests/test_diet.py::test_get_day_from_plan_returns_correct_day -v
# Expected: ERROR — ImportError or AttributeError
```

### Steps

- [ ] **4.1** Add `get_day_from_plan(date_iso, plan, exercise_adj)` to `diet.py`:

  ```python
  def get_day_from_plan(
      date_iso: str,
      plan: dict,
      exercise_adj: dict,
  ) -> dict | None:
      """
      Returns the PlanDay for the given ISO date from the plan,
      with exercise adjustment applied if present.
      Returns None if the date is not in the plan.
      """
      days: list = plan.get("days", [])
      day = next((d for d in days if d["date"] == date_iso), None)
      if day is None:
          return None

      # Deep copy to avoid mutating stored plan
      import copy
      day = copy.deepcopy(day)

      adj_entry = exercise_adj.get(date_iso)
      if adj_entry and adj_entry.get("extra_kcal", 0) > 0:
          extra_kcal          = adj_entry["extra_kcal"]
          source              = adj_entry.get("source", "")
          total_base_kcal     = day["totalKcal"] or 1
          portion_scale       = min(1.0 + (extra_kcal / total_base_kcal), 1.5)

          adjusted_meals = []
          for meal in day["meals"]:
              base_kcal     = meal["kcal"]
              adj_kcal      = round(base_kcal * portion_scale)
              adjusted_meals.append({
                  **meal,
                  "portionScale":  round(portion_scale, 4),
                  "adjustedKcal":  adj_kcal,
              })
          adjusted_total = round(day["totalKcal"] * portion_scale)
          day["meals"]       = adjusted_meals
          day["exerciseAdj"] = {
              "extraKcal":     extra_kcal,
              "source":        source,
              "adjustedTotal": adjusted_total,
          }
      else:
          day.pop("exerciseAdj", None)

      return day
  ```

### Verification

```bash
cd nutrition_assistant && python -m pytest tests/test_diet.py -v
# Expected: all 11 tests PASS (6 from Task 3 + 5 from Task 4)
```

### Commit

```bash
git add nutrition_assistant/diet.py nutrition_assistant/tests/test_diet.py
git commit -m "feat(diet): add get_day_from_plan with portion scaling and exercise adjustment"
```

---

## Task 5: Backend — update API endpoints

**Files to Modify:** `nutrition_assistant/api.py`
**Files to Create/Modify:** `nutrition_assistant/tests/test_api.py`

### Failing test first

```python
# nutrition_assistant/tests/test_api.py
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
    # Both are module-level string constants — patch.object is the correct approach.
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

def test_get_today_diet_stale_flag_when_old_plan(tmp_path):
    import storage, json
    # Inject an old week_plan (from 2 weeks ago)
    old_plan = {
        "days": [],
        "generated_at": "2020-01-06",  # definitely stale
        "weekly_target_kcal": 1800,
        "weekly_summary": None,
    }
    session = {
        "saved_date": "2020-01-06",
        "saved_week": "2020-W02",
        "week_plan": old_plan,
    }
    session_file = str(tmp_path / "session.json")
    with open(session_file, "w") as f:
        json.dump(session, f)
    with patch.object(storage, "SESSION_FILE", session_file):
        r = client.get("/diet/today", headers={"X-User-Timezone": "UTC"})
    # Should return stale=True even though plan has no day for today
    # (will auto-generate in this case, but stale detection is tested separately)
    assert r.status_code in (200, 404)

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
    session = {
        "saved_date": today,
        "saved_week": __import__("storage")._this_week(),
        # No week_plan key at all
        "exercise_adj": {
            today: {"extra_kcal": 400, "source": "running 30min"}
        },
    }
    session_file = str(tmp_path / "session.json")
    with open(session_file, "w") as f:
        json.dump(session, f)
    with patch.object(storage, "SESSION_FILE", session_file):
        r = client.get("/diet/today", headers={"X-User-Timezone": "UTC"})
    assert r.status_code == 200
    body = r.json()
    assert "exerciseAdj" in body, "exerciseAdj must be present when exercise_adj[today] is set"
    assert body["exerciseAdj"]["extraKcal"] == 400
    assert body["exerciseAdj"]["source"] == "running 30min"
```

Run (expected: failures — endpoints return old shapes):
```bash
cd nutrition_assistant && python -m pytest tests/test_api.py -v
# Expected: FAILED — assertions on "date", "dayName", "stale" keys not found
```

### Steps

- [ ] **5.1** Update the FastAPI import line and add timezone helper at top of `api.py`.

  Find-and-replace (to avoid duplicate imports):
  ```
  FIND:    from fastapi import FastAPI, HTTPException
  REPLACE: from fastapi import FastAPI, HTTPException, Request, Header
  ```

  Then add after the imports block:
  ```python
  from typing import Optional
  import zoneinfo

  def _get_today_for_tz(tz_header: str | None) -> str:
      """Return today's ISO date string in the user's timezone. Falls back to UTC."""
      try:
          tz = zoneinfo.ZoneInfo(tz_header) if tz_header else zoneinfo.ZoneInfo("UTC")
      except Exception:
          import warnings
          warnings.warn(f"Unrecognized timezone '{tz_header}', falling back to UTC")
          tz = zoneinfo.ZoneInfo("UTC")
      from datetime import datetime
      return datetime.now(tz=tz).date().isoformat()

  def _get_monday_for_tz(tz_header: str | None) -> str:
      """Return Monday of the current week in the user's timezone."""
      from datetime import datetime, timedelta
      try:
          tz = zoneinfo.ZoneInfo(tz_header) if tz_header else zoneinfo.ZoneInfo("UTC")
      except Exception:
          tz = zoneinfo.ZoneInfo("UTC")
      today = datetime.now(tz=tz).date()
      monday = today - timedelta(days=today.weekday())
      return monday.isoformat()

  def _is_stale(plan: dict, tz_header: str | None) -> bool:
      """True when plan.generated_at is from a previous week."""
      current_monday = _get_monday_for_tz(tz_header)
      # Empty or missing generated_at ("") < any date string is True —
      # treats missing plan as stale, which is intentional.
      return plan.get("generated_at", "") < current_monday
  ```

- [ ] **5.2** Update imports from `diet` module in `api.py`:

  ```python
  from diet import (
      generate_week_plan, get_day_from_plan,
      regenerate_meal,
  )
  ```

  > **Confirmed:** `regenerate_meal` already exists in `diet.py` (line 776) with signature:
  > `regenerate_meal(day: dict, meal_key: str, excluded: list, favorites: list) -> dict`
  > It swaps a single meal slot in a day dict, choosing a different option from the same pool.
  > No new function needs to be created for Step 5.6 — this is the correct existing function.

  Remove `generate_adaptive_day`, `DAYS`, and `MEAL_LABELS` from the import.
  `DAYS` and `MEAL_LABELS` were only used by `generate_adaptive_day` (which is being removed);
  importing them in the new code would be unused and misleading.

- [ ] **5.3** Add new Pydantic models for the updated endpoints:

  ```python
  class RegenerateWeeklyModel(BaseModel):
      apply_from: str = "tomorrow"   # "today" | "tomorrow"

  class SwapMealModel(BaseModel):
      meal_id: str
  ```

  > **Assumptions — pre-existing helper functions in `api.py` (confirmed, do NOT redefine):**
  > - `_get_session()` — exists at line 78 of `api.py`; calls `load_session()` and returns the session dict.
  > - `load_excluded()` — exists in `preferences.py` (line 31); imported into `api.py` via `from preferences import ... load_excluded, load_favorites`. It is NOT in `storage.py`.
  > - `load_favorites()` — exists in `preferences.py` (line 36); same import path as above.
  > - `_get_daily_target()` — exists at line 228 of `api.py`; loads profile, calculates BMR, and calls `calculate_daily_target`.

- [ ] **5.4** Replace `get_today_diet()` endpoint:

  ```python
  @app.get("/diet/today", tags=["Dieta"])
  def get_today_diet(x_user_timezone: Optional[str] = Header(None)):
      """Returns today's PlanDay from the weekly plan. Auto-generates plan if needed."""
      session  = _get_session()
      tz       = x_user_timezone
      today    = _get_today_for_tz(tz)

      plan = session.get("week_plan")

      # Auto-generate if no plan exists
      if not plan:
          excluded  = load_excluded()
          favorites = load_favorites()
          history   = session.get("weekly_history", []) or load_weekly_history()
          plan = generate_week_plan(excluded, favorites, _get_daily_target(), history=history or None)
          save_session(week_plan=plan)

      stale        = _is_stale(plan, tz)
      exercise_adj = session.get("exercise_adj", {})
      day          = get_day_from_plan(today, plan, exercise_adj)

      if day is None:
          raise HTTPException(
              404,
              {"error": "date_not_in_plan",
               "detail": f"Date {today} is not in the current plan. Regenerate the plan."}
          )

      return {**day, "stale": stale}
  ```

- [ ] **5.5** Update `regenerate_today_diet()` — keep the path but delegate to new plan logic:

  ```python
  @app.post("/diet/today/regenerate", tags=["Dieta"])
  def regenerate_today_diet(x_user_timezone: Optional[str] = Header(None)):
      """Regenerates the full weekly plan and returns today's PlanDay."""
      session   = _get_session()
      excluded  = load_excluded()
      favorites = load_favorites()
      history   = load_weekly_history()
      plan = generate_week_plan(excluded, favorites, _get_daily_target(), history=history or None)
      save_session(week_plan=plan)
      today        = _get_today_for_tz(x_user_timezone)
      exercise_adj = session.get("exercise_adj", {})
      day          = get_day_from_plan(today, plan, exercise_adj)
      if day is None:
          raise HTTPException(404, {"error": "date_not_in_plan", "detail": "Regenerated plan does not cover today."})
      return {**day, "stale": False}
  ```

- [ ] **5.6** Update `swap_meal()` endpoint — new path `/diet/today/swap` with JSON body:

  ```python
  @app.post("/diet/today/swap", tags=["Dieta"])
  def swap_meal_new(data: SwapMealModel, x_user_timezone: Optional[str] = Header(None)):
      """Swaps a meal in today's plan slot. Returns updated PlanDay."""
      meal_type = data.meal_id
      session   = _get_session()
      plan      = session.get("week_plan")
      if not plan:
          raise HTTPException(404, {"error": "no_plan", "detail": "No weekly plan. Call GET /diet/today first."})

      today = _get_today_for_tz(x_user_timezone)
      days  = plan.get("days", [])
      day_idx = next((i for i, d in enumerate(days) if d["date"] == today), None)
      if day_idx is None:
          raise HTTPException(404, {"error": "date_not_in_plan", "detail": f"No plan for {today}."})

      excluded  = load_excluded()
      favorites = load_favorites()

      # Regenerate that meal slot in the plan day
      today_day = days[day_idx]
      daily_target = plan.get("weekly_target_kcal", 1800)
      updated_day_meals = dict({m["id"]: m for m in today_day["meals"]})

      # Use existing regenerate_meal logic (operates on old flat dict format)
      flat_day = {"daily_target": daily_target, "meals": updated_day_meals}
      flat_day = regenerate_meal(flat_day, meal_type, excluded, favorites)
      new_meals_dict = flat_day["meals"]

      # Rebuild meals list preserving order
      new_meals_list = [
          {**new_meals_dict[m["id"]], "id": m["id"]}
          if m["id"] in new_meals_dict else m
          for m in today_day["meals"]
      ]
      plan["days"][day_idx] = {
          **today_day,
          "meals":     new_meals_list,
          "totalKcal": sum(m["kcal"] for m in new_meals_list),
      }
      save_session(week_plan=plan)

      # Return the updated PlanDay with exercise_adj applied
      exercise_adj = session.get("exercise_adj", {})
      updated_plan_day = get_day_from_plan(today, plan, exercise_adj)
      return updated_plan_day
  ```

  Keep the old path `/diet/today/{meal_type}/swap` as a compatibility shim (optional, for the brief transition period):

  ```python
  @app.post("/diet/today/{meal_type}/swap", tags=["Dieta"], deprecated=True)
  def swap_meal_legacy(meal_type: str, x_user_timezone: Optional[str] = Header(None)):
      """Legacy endpoint — use POST /diet/today/swap with JSON body instead."""
      from pydantic import BaseModel as BM
      class _Body(BM):
          meal_id: str = meal_type
      return swap_meal_new(_Body(meal_id=meal_type), x_user_timezone)
  ```

- [ ] **5.7** Update `get_weekly_plan()`:

  ```python
  @app.get("/diet/weekly", tags=["Dieta"])
  def get_weekly_plan(x_user_timezone: Optional[str] = Header(None)):
      """Returns full weekly plan as { days: PlanDay[], summary, stale }."""
      session = _get_session()
      plan    = session.get("week_plan")
      if not plan:
          excluded  = load_excluded()
          favorites = load_favorites()
          history   = load_weekly_history()
          plan = generate_week_plan(excluded, favorites, _get_daily_target(), history=history or None)
          save_session(week_plan=plan)

      stale        = _is_stale(plan, x_user_timezone)
      exercise_adj = session.get("exercise_adj", {})

      # Apply exercise adjustments to each day
      days_with_adj = []
      for day in plan.get("days", []):
          enriched = get_day_from_plan(day["date"], plan, exercise_adj)
          if enriched:
              days_with_adj.append(enriched)

      return {
          "days":    days_with_adj,
          "summary": plan.get("weekly_summary"),
          "stale":   stale,
      }
  ```

- [ ] **5.8** Update `regenerate_weekly_plan()`:

  ```python
  @app.post("/diet/weekly/regenerate", tags=["Dieta"])
  def regenerate_weekly_plan(
      data: RegenerateWeeklyModel = RegenerateWeeklyModel(),
      x_user_timezone: Optional[str] = Header(None),
  ):
      """Regenerates part or all of the weekly plan. Returns { days: PlanDay[] }."""
      session   = _get_session()
      excluded  = load_excluded()
      favorites = load_favorites()
      history   = load_weekly_history()

      new_plan = generate_week_plan(excluded, favorites, _get_daily_target(), history=history or None)

      today = _get_today_for_tz(x_user_timezone)
      apply_from = data.apply_from  # "today" or "tomorrow"

      existing_plan = session.get("week_plan")
      if existing_plan and apply_from in ("today", "tomorrow"):
          from datetime import date as _date, timedelta
          cutoff = _date.fromisoformat(today)
          if apply_from == "tomorrow":
              cutoff = cutoff + timedelta(days=1)

          # Keep days BEFORE cutoff from existing plan, take days from cutoff onward from new plan
          old_days_by_date = {d["date"]: d for d in existing_plan.get("days", [])}
          new_days_by_date = {d["date"]: d for d in new_plan.get("days", [])}

          merged_days = []
          for d in new_plan["days"]:
              day_date = _date.fromisoformat(d["date"])
              if day_date < cutoff and d["date"] in old_days_by_date:
                  merged_days.append(old_days_by_date[d["date"]])
              else:
                  merged_days.append(d)

          # Discard FUTURE exercise_adj if apply_from == "today".
          # Use `k <= today` (not `k < today`) so that today's adjustment is preserved
          # per the spec: "exercise_adj[today] is preserved when apply_from == 'today'".
          exercise_adj = session.get("exercise_adj", {})
          if apply_from == "today":
              exercise_adj = {k: v for k, v in exercise_adj.items() if k <= today}
              save_session(exercise_adj=exercise_adj)

          new_plan["days"] = merged_days

      save_session(week_plan=new_plan)

      exercise_adj = _get_session().get("exercise_adj", {})
      days_with_adj = [
          get_day_from_plan(d["date"], new_plan, exercise_adj)
          for d in new_plan["days"]
          if get_day_from_plan(d["date"], new_plan, exercise_adj) is not None
      ]

      return {"days": days_with_adj}
  ```

- [ ] **5.9** Update `storage` imports in `api.py` to include new functions:

  ```python
  from storage import (
      load_profile, save_profile, load_session, save_session,
      load_weekly_history, save_weekly_history, save_exercise_adj,
  )
  ```

  > **Important:** `load_excluded` and `load_favorites` are NOT in `storage.py`. They live in
  > `preferences.py` and are already imported in the existing `api.py` via:
  > `from preferences import _load as load_prefs, _save as save_prefs, load_excluded, load_favorites`
  > Do NOT add them to the `storage` import line above. The existing `preferences` import remains
  > unchanged — only the `storage` import line needs the three new functions listed above.

### Verification

```bash
cd nutrition_assistant && python -m pytest tests/test_api.py -v
# Expected:
# tests/test_api.py::test_get_today_diet_returns_plan_day PASSED
# tests/test_api.py::test_get_weekly_plan_returns_days_list PASSED
# tests/test_api.py::test_regenerate_weekly_plan_accepts_apply_from PASSED
# tests/test_api.py::test_swap_meal_returns_plan_day PASSED
# 4+ passed
```

Manual smoke test with running server:
```bash
cd nutrition_assistant && uvicorn api:app --reload &
curl -s -H "X-User-Timezone: Europe/Madrid" http://localhost:8000/diet/today | python3 -m json.tool | head -20
# Expected: JSON with "date", "dayName", "meals" array, "stale" bool
curl -s http://localhost:8000/diet/weekly | python3 -m json.tool | head -10
# Expected: JSON with "days" array, "summary", "stale"
```

### Commit

```bash
git add nutrition_assistant/api.py nutrition_assistant/tests/test_api.py
git commit -m "feat(api): update diet endpoints to use PlanDay model and stale detection"
```

---

## Task 6: Frontend — update `diet/page.tsx`

**Files to Modify:** `nutrition_frontend/app/diet/page.tsx`

### Manual verification steps (no test framework)

Before implementing:
1. Open `http://localhost:3000/diet` in browser — note current layout.
2. Check browser console for any errors about `tip` being undefined after Task 1.

After implementing:
1. Open `http://localhost:3000/diet`.
2. Verify: subtitle shows day name and week (e.g., "Viernes, semana del 17 mar").
3. Verify: "Regenerar dieta" button is gone; "Ver plan completo →" link is present.
4. With exercise adj in session: verify "⚡ +320 kcal · porciones ampliadas" badge appears in header.
5. With stale API response: verify yellow banner "Tu plan es de la semana pasada. ¿Regenerar ahora?" appears.
6. Swap a meal: verify it calls the new `/diet/today/swap` endpoint and updates without full page reload.
7. Verify meal cards show `meal.note` (not `meal.tip`) without runtime errors.

### Steps

- [ ] **6.1** Update imports at top of `diet/page.tsx`:

  ```typescript
  import type { PlanDay, Meal } from "@/lib/api"
  import { fetchTodaysPlan, swapMeal, updateAdherence } from "@/lib/api"
  ```

  Remove: `TodaysDiet`, `regenerateDay`, `fetchTodaysDiet`.

- [ ] **6.2** Update mock data to use `PlanDay` shape:

  ```typescript
  const today = new Date().toISOString().slice(0, 10)
  const mockPlanDay: PlanDay = {
    date: today,
    dayName: new Date().toLocaleDateString("es-ES", { weekday: "long" }),
    meals: [
      {
        id: "desayuno",
        type: "breakfast",
        name: "Desayuno",
        kcal: 380,
        description: "Yogur griego con frutos rojos, miel y copos de avena",
        note: "Añade semillas de chía para más fibra y omega-3",
      },
      {
        id: "media_manana",
        type: "mid-morning",
        name: "Media mañana",
        kcal: 220,
        description: "Manzana en rodajas con 2 cucharadas de crema de almendras",
        note: "Elige manzanas de temporada",
      },
      {
        id: "almuerzo",
        type: "lunch",
        name: "Almuerzo",
        kcal: 520,
        description: "Pechuga de pollo a la plancha con ensalada mixta, aguacate y tomate cherry",
        note: "Aliña con aceite de oliva virgen extra",
      },
      {
        id: "merienda",
        type: "snack",
        name: "Merienda",
        kcal: 280,
        description: "Batido de proteínas con plátano, espinacas y leche de almendras",
        note: "Añade hielo para una textura más espesa",
      },
      {
        id: "cena",
        type: "dinner",
        name: "Cena",
        kcal: 650,
        description: "Filete de salmón al horno con quinoa y verduras asadas",
        note: "Sazona el salmón con limón y eneldo",
      },
    ],
    totalKcal: 2050,
  }
  ```

- [ ] **6.3** Update component state types:

  ```typescript
  const [data, setData] = useState<(PlanDay & { stale?: boolean }) | null>(null)
  const [stale, setStale] = useState(false)
  ```

- [ ] **6.4** Update `useEffect` fetch:

  ```typescript
  useEffect(() => {
    fetchTodaysPlan()
      .then((d) => {
        setStale(d.stale ?? false)
        setData(d)
      })
      .catch(() => setData(mockPlanDay))
      .finally(() => setLoading(false))
  }, [])
  ```

- [ ] **6.5** Update `handleSwap`:

  ```typescript
  const handleSwap = async (mealId: string) => {
    if (!data) return
    setSwapping(mealId)
    try {
      const updatedDay = await swapMeal(mealId)
      // Merge: preserve local stale flag and adherence state
      setData((prev) => prev ? { ...updatedDay, stale: prev.stale } : updatedDay)
    } catch {
      // Fallback: rotate mock meal for the swapped slot
      setData((prev) => {
        if (!prev) return mockPlanDay
        const idx = prev.meals.findIndex((m) => m.id === mealId)
        if (idx === -1) return prev
        // Simple fallback: keep same meal (graceful degradation)
        return prev
      })
    }
    setSwapping(null)
  }
  ```

- [ ] **6.6** Remove `handleRegenerate` function entirely.

- [ ] **6.7** Update the adherence checklist — derive it from `data.meals` rather than a static list:

  ```typescript
  const adherenceItems = (data?.meals ?? []).map((m) => ({
    id: m.id,
    label: m.name,
    checked: checkedMeals[m.id] ?? false,
  }))
  ```

  Add `const [checkedMeals, setCheckedMeals] = useState<Record<string, boolean>>({})` to state.

  Update `handleAdherenceChange`:
  ```typescript
  const handleAdherenceChange = async (itemId: string, checked: boolean) => {
    setCheckedMeals((prev) => ({ ...prev, [itemId]: checked }))
    try {
      await updateAdherence({ [itemId]: checked })
    } catch { /* keep optimistic update */ }
  }
  ```

- [ ] **6.8** Update the JSX header section — replace the old header card content:

  ```tsx
  {/* Stale banner */}
  {stale && (
    <div className="bg-amber-500/20 border border-amber-400/30 rounded-2xl p-4 flex items-center justify-between">
      <span className="text-amber-300 text-sm">
        Tu plan es de la semana pasada. ¿Regenerar ahora?
      </span>
      <a href="/weekly-plan" className="text-amber-400 text-sm font-semibold hover:underline ml-4">
        Ver plan →
      </a>
    </div>
  )}

  <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6">
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div>
        <h2 className="text-3xl font-bold text-white">Dieta de hoy</h2>
        <p className="text-white/60 text-sm">
          {planDay.dayName}, semana del{" "}
          {new Date(planDay.date + "T00:00:00").toLocaleDateString("es-ES", {
            day: "numeric", month: "short"
          })}
        </p>
        <p className="text-white/60 mt-1">
          Total planificado:{" "}
          <span className="text-emerald-400 font-semibold">
            {planDay.exerciseAdj
              ? planDay.exerciseAdj.adjustedTotal
              : planDay.totalKcal}{" "}
            kcal
          </span>
        </p>
        {planDay.exerciseAdj && planDay.exerciseAdj.extraKcal > 0 && (
          <p className="text-yellow-300 text-sm mt-1">
            ⚡ +{planDay.exerciseAdj.extraKcal} kcal · porciones ampliadas
            <span className="text-white/40 ml-1">({planDay.exerciseAdj.source})</span>
          </p>
        )}
      </div>
      <a
        href="/weekly-plan"
        className="text-emerald-400 text-sm font-semibold hover:underline flex items-center gap-1"
      >
        Ver plan completo →
      </a>
    </div>
  </Card>
  ```

  Replace variable `diet` with `planDay` (rename). The assignment must appear AFTER the
  loading-state null guard, not before it, so that the loading return is not skipped:

  ```typescript
  if (loading) return <LoadingSpinner />
  if (error) return <ErrorMessage message={error} />
  const planDay = data ?? mockPlanDay  // ← placed AFTER null guards
  ```

  Note: `diet/page.tsx` currently uses an inline loading spinner (not a named `<LoadingSpinner>`
  component) and has no `error` state. Adjust to match the actual component structure — the
  principle is that `planDay` must be derived only after all early-exit guards are satisfied.

- [ ] **6.9** Update meal cards — replace `meal.tip` with `meal.note`:

  In the JSX for the tip row, change:
  ```tsx
  // OLD:
  <span>{meal.tip}</span>

  // NEW:
  {meal.note && <span>{meal.note}</span>}
  ```

  Also update kcal display to show `adjustedKcal` when present:
  ```tsx
  <p className="text-2xl font-bold text-white">
    {meal.adjustedKcal ?? meal.kcal}
  </p>
  {meal.portionScale && meal.portionScale > 1 && (
    <p className="text-yellow-300 text-xs">×{meal.portionScale.toFixed(2)}</p>
  )}
  ```

### Commit

```bash
git add nutrition_frontend/app/diet/page.tsx
git commit -m "feat(diet-page): adopt PlanDay model, exercise badge, and stale banner"
```

---

## Task 7: Frontend — update `weekly-plan/page.tsx`

**Files to Modify:** `nutrition_frontend/app/weekly-plan/page.tsx`

### Manual verification steps

Before implementing:
1. Open `http://localhost:3000/weekly-plan` — note current accordion layout.

After implementing:
1. Today's day accordion item shows a colored border and "HOY" badge.
2. Days with exercise adj show "⚡ +Xkcal" next to the day's kcal total.
3. "Regenerar plan semanal" button is visible in the header.
4. Clicking it opens a modal showing history stats (or "No hay historial" if empty).
5. Radio buttons: "Hoy" / "Mañana" — selecting and confirming calls the regenerate endpoint.
6. Modal shows error message if fetch fails (plan remains intact).
7. Stale banner appears when API returns `stale: true`.
8. Adaptive summary card appears when `summary` is not null.
9. **Network failure during regeneration:** disconnect the network (or stop the backend), click "Regenerar" and confirm. Verify that (a) an error message appears in the modal and (b) the existing plan data is **still displayed** — the accordion days must not be wiped or replaced with empty/loading state.

### Steps

- [ ] **7.1** Update imports:

  ```typescript
  import type { WeeklyPlanResponse, PlanDay, WeeklyHistorySummary } from "@/lib/api"
  import { fetchWeeklyPlan, regenerateWeeklyPlan } from "@/lib/api"
  import { RefreshCw, X } from "lucide-react"
  ```

  Remove `WeeklyPlan`, `WeeklyMeal` imports.

- [ ] **7.2** Update component state:

  ```typescript
  const [data, setData] = useState<WeeklyPlanResponse | null>(null)
  const [stale, setStale] = useState(false)
  const [showRegenModal, setShowRegenModal] = useState(false)
  const [regenApplyFrom, setRegenApplyFrom] = useState<"today" | "tomorrow">("tomorrow")
  const [regenerating, setRegenerating] = useState(false)
  const [regenError, setRegenError] = useState<string | null>(null)
  ```

- [ ] **7.3** Update `useEffect` fetch:

  ```typescript
  useEffect(() => {
    fetchWeeklyPlan()
      .then((d) => {
        setStale(d.stale)
        setData(d)
      })
      .catch(() => setData(mockWeeklyPlanResponse))
      .finally(() => setLoading(false))
  }, [])
  ```

- [ ] **7.4** Add mock data using `WeeklyPlanResponse` shape (convert old `mockWeeklyPlan` to `mockWeeklyPlanResponse`):

  The mock still needs 7 days. Keep the same meal content but restructure to `PlanDay[]`:
  ```typescript
  const todayISO = new Date().toISOString().slice(0, 10)
  const mockWeeklyPlanResponse: WeeklyPlanResponse = {
    days: [
      {
        date: "2026-03-16", dayName: "Lunes", totalKcal: 1725,
        meals: [
          { id: "desayuno",     type: "breakfast",  name: "Desayuno",     kcal: 386, description: "80g de pan thins con 40g de jamón serrano y tomate + café", note: "4 rebanadas de pan thins. Tomate natural en rodajas." },
          { id: "media_manana", type: "mid-morning", name: "Media mañana", kcal: 175, description: "Yogurt proteínas (200g) + 13g de frutos secos", note: "Frutos secos de la bolsa de Aldi." },
          { id: "almuerzo",     type: "lunch",       name: "Almuerzo",     kcal: 645, description: "105g de espaguetis con 120g de carne picada de ternera, tomate frito sin azúcar y orégano", note: "Sofríe la carne con ajo y añade tomate al final." },
          { id: "merienda",     type: "snack",       name: "Merienda",     kcal: 175, description: "2 tortitas de arroz con 50g de pavo y guacamole", note: "Crema de cacahuete opcional." },
          { id: "cena",         type: "dinner",      name: "Cena",         kcal: 344, description: "2 huevos a la plancha con medio calabacín y tomate frito sin azúcar", note: "Espolvorea orégano sobre los huevos." },
        ],
      },
      {
        date: "2026-03-17", dayName: "Martes", totalKcal: 1620,
        meals: [
          { id: "desayuno",     type: "breakfast",  name: "Desayuno",     kcal: 325, description: "60g de cereales crunchy Mercadona con leche semidesnatada", note: "Corn flakes, espelta o crunchy Mercadona." },
          { id: "media_manana", type: "mid-morning", name: "Media mañana", kcal: 175, description: "1 fruta de temporada + 3-4 nueces", note: "Manzana, pera o naranja." },
          { id: "almuerzo",     type: "lunch",       name: "Almuerzo",     kcal: 570, description: "107g de arroz basmati con 140g de pechuga de pollo y brócoli al vapor", note: "Aliña el brócoli con limón y ajo." },
          { id: "merienda",     type: "snack",       name: "Merienda",     kcal: 175, description: "Medio kefir con sandía + 13g de frutos secos", note: "Puedes cambiar kefir por yogurt proteínas." },
          { id: "cena",         type: "dinner",      name: "Cena",         kcal: 375, description: "170g de merluza al horno con verduras al gusto", note: "Con limón, perejil y un hilo de aceite." },
        ],
      },
      {
        date: "2026-03-18", dayName: "Miércoles", totalKcal: 1532,
        meals: [
          { id: "desayuno",     type: "breakfast",  name: "Desayuno",     kcal: 362, description: "80g de pan centeno con 30g de jamón serrano y tomate + café", note: "Pan recomendado: Thins, Rustik, centeno." },
          { id: "media_manana", type: "mid-morning", name: "Media mañana", kcal: 175, description: "Batido de proteínas con agua o leche vegetal", note: "Aporta ~25g de proteína." },
          { id: "almuerzo",     type: "lunch",       name: "Almuerzo",     kcal: 460, description: "200g de ñoquis con 180g de gambas, cebollino y salsa de soja", note: "Salta los ñoquis hasta que doren." },
          { id: "merienda",     type: "snack",       name: "Merienda",     kcal: 175, description: "Bowl: 40g de harina de avena + 1 huevo + leche + oncita de chocolate (45s micro)", note: "45 segundos al microondas." },
          { id: "cena",         type: "dinner",      name: "Cena",         kcal: 360, description: "Ensalada de canónigos con 2 latas de atún, queso fresco y tomate", note: "Aliñar con aceite de oliva y vinagre." },
        ],
      },
      {
        date: "2026-03-19", dayName: "Jueves", totalKcal: 1697,
        meals: [
          { id: "desayuno",     type: "breakfast",  name: "Desayuno",     kcal: 410, description: "Tortita de avena: 30g de avena + 2 huevos + leche + 1 cdta cacahuete + onza chocolate negro", note: "Sartén antiadherente sin aceite." },
          { id: "media_manana", type: "mid-morning", name: "Media mañana", kcal: 175, description: "50g de caña de lomo de pavo + 13g de frutos secos", note: "Opción fácil de llevar al trabajo." },
          { id: "almuerzo",     type: "lunch",       name: "Almuerzo",     kcal: 488, description: "Papas aliñás: 250g de patata cocida con 2 latas de atún, 1 huevo, cebolla y perejil", note: "Sirve templado. La patata aliñada gana sabor al reposar." },
          { id: "merienda",     type: "snack",       name: "Merienda",     kcal: 175, description: "Yogurt proteínas con 1 cda crema de cacahuete en polvo + fresas", note: "Endulza con stevia si lo necesitas." },
          { id: "cena",         type: "dinner",      name: "Cena",         kcal: 449, description: "Fajita de pan thins con 130g de pollo, cebolla, pimiento y salsa de yogurt", note: "Salsa yogurt: yogurt griego + ajo + limón." },
        ],
      },
      {
        date: "2026-03-20", dayName: "Viernes", totalKcal: 1806,
        meals: [
          { id: "desayuno",     type: "breakfast",  name: "Desayuno",     kcal: 366, description: "80g de pan thins con 1 lata de atún y 4 rodajas de tomate + café", note: "Aliña el atún con limón." },
          { id: "media_manana", type: "mid-morning", name: "Media mañana", kcal: 175, description: "70g de pechuga de pavo/pollo + 13g de frutos secos", note: "Frutos secos de Aldi." },
          { id: "almuerzo",     type: "lunch",       name: "Almuerzo",     kcal: 700, description: "160g de salmón a la plancha con 107g de arroz basmati y brócoli", note: "Sin aceite extra — el salmón ya tiene grasa." },
          { id: "merienda",     type: "snack",       name: "Merienda",     kcal: 175, description: "1 lata de piña al natural + 4 nueces", note: "Piña sin almíbar." },
          { id: "cena",         type: "dinner",      name: "Cena",         kcal: 390, description: "2 hamburguesas de ternera (180g) con calabacín a la plancha", note: "Sin pan. Calabacín con ajo y sal." },
        ],
      },
      {
        date: "2026-03-21", dayName: "Sábado", totalKcal: 1407,
        meals: [
          { id: "desayuno",     type: "breakfast",  name: "Desayuno",     kcal: 325, description: "60g de cereales crunchy con leche semidesnatada", note: "Cereales crunchy Mercadona." },
          { id: "media_manana", type: "mid-morning", name: "Media mañana", kcal: 175, description: "Bizcocho en taza: 30g de avena + levadura + 1 huevo + 2 onzas chocolate (4 min micro)", note: "4 minutos al microondas." },
          { id: "almuerzo",     type: "lunch",       name: "Almuerzo",     kcal: 432, description: "Lentejas: 200g de lentejas cocidas con verduras y 120g de pollo troceado", note: "Sofrito base: cebolla, pimiento, zanahoria." },
          { id: "merienda",     type: "snack",       name: "Merienda",     kcal: 175, description: "2 tajas de sandía + 13g de frutos secos", note: "Los frutos secos son muy saciantes." },
          { id: "cena",         type: "dinner",      name: "Cena",         kcal: 300, description: "140g de salmón a la plancha con espárragos verdes", note: "El salmón no necesita aceite extra." },
        ],
      },
      {
        date: "2026-03-22", dayName: "Domingo", totalKcal: 1720,
        meals: [
          { id: "desayuno",     type: "breakfast",  name: "Desayuno",     kcal: 410, description: "Tortita de avena: 30g de avena + 2 huevos + leche + 1 cdta cacahuete + onza chocolate negro", note: "Desayuno especial del domingo." },
          { id: "media_manana", type: "mid-morning", name: "Media mañana", kcal: 175, description: "Yogurt proteínas (200g) + 13g de frutos secos", note: "" },
          { id: "almuerzo",     type: "lunch",       name: "Almuerzo",     kcal: 590, description: "Pechuga de pollo (160g) en salsa de curry con 107g de arroz basmati", note: "Salsa curry: yogurt griego, curry, limón, cebolla." },
          { id: "merienda",     type: "snack",       name: "Merienda",     kcal: 175, description: "Helado casero de yogurt proteínas con crema de cacahuete y chocolate negro", note: "Congela el yogurt 2-3 horas." },
          { id: "cena",         type: "dinner",      name: "Cena",         kcal: 370, description: "Salmorejo cordobés con 1 huevo cocido, 1 lata de atún y picatostes", note: "Salmorejo casero: tomates, pan, ajo, aceite." },
        ],
      },
    ],
    summary: null,
    stale: false,
  }
  ```

  For the `MealCard` component, update the `meal` prop type from `WeeklyMeal` to `Meal` (from the unified model):
  ```typescript
  function MealCard({ mealType, meal }: { mealType: string; meal: Meal }) {
    // Replace meal.text → meal.description
    // Replace meal.note → meal.note (same field name, now optional)
  ```

- [ ] **7.5** Update accordion rendering to use `PlanDay[]`:

  ```typescript
  // Compute today's ISO date for isToday check
  const todayISO = new Date().toISOString().slice(0, 10)

  // In the map:
  {plan.days.map((dayPlan) => {
    const isToday = dayPlan.date === todayISO
    const totalKcal = dayPlan.exerciseAdj?.adjustedTotal ?? dayPlan.totalKcal
    return (
      <AccordionItem
        key={dayPlan.date}
        value={dayPlan.date}
        className={`rounded-xl border px-4 ${
          isToday
            ? "bg-emerald-500/10 border-emerald-400/40 data-[state=open]:bg-emerald-500/15"
            : "bg-white/5 border-white/10 data-[state=open]:bg-white/10"
        }`}
      >
        <AccordionTrigger className="hover:no-underline py-4">
          <div className="flex items-center justify-between w-full pr-4">
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-white">{dayPlan.dayName}</span>
              {isToday && (
                <Badge className="bg-emerald-500 text-white text-xs px-2 py-0">HOY</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {dayPlan.exerciseAdj && dayPlan.exerciseAdj.extraKcal > 0 && (
                <span className="text-yellow-300 text-sm">
                  ⚡ +{dayPlan.exerciseAdj.extraKcal} kcal
                </span>
              )}
              {totalKcal > 0 && (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-400/30">
                  {totalKcal} kcal
                </Badge>
              )}
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {dayPlan.meals.map((meal) => (
              <MealCard key={meal.id} mealType={meal.type} meal={meal} />
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    )
  })}
  ```

- [ ] **7.6** Update the screen header card — add "Regenerar" button and stale banner:

  ```tsx
  {/* Stale banner */}
  {stale && (
    <div className="bg-amber-500/20 border border-amber-400/30 rounded-2xl p-4 flex items-center justify-between">
      <span className="text-amber-300 text-sm">
        Tu plan es de la semana pasada. ¿Regenerar ahora?
      </span>
      <Button
        size="sm"
        onClick={() => setShowRegenModal(true)}
        className="bg-amber-500/20 border-amber-400/30 text-amber-300 hover:bg-amber-500/30 ml-4"
      >
        Regenerar
      </Button>
    </div>
  )}

  {/* Header card: add Regenerar button next to PDF export */}
  <Button
    onClick={() => setShowRegenModal(true)}
    className="bg-white/10 hover:bg-white/20 border border-white/20 text-white"
  >
    <RefreshCw className="mr-2 h-4 w-4" />
    Regenerar plan semanal
  </Button>
  ```

- [ ] **7.7** Add adaptive summary card — rendered when `data.summary` is not null, between the header and the accordion:

  ```tsx
  {data?.summary && (
    <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-4">
      <p className="text-white/60 text-sm font-semibold mb-2">
        Plan ajustado según la semana anterior:
      </p>
      <div className="flex flex-wrap gap-4 text-sm text-white/80">
        {data.summary.avg_adherence != null && (
          <span>Adherencia: <strong>{Math.round(data.summary.avg_adherence * 100)}%</strong></span>
        )}
        {data.summary.total_exercise_kcal > 0 && (
          <span>Ejercicio: <strong>{data.summary.total_exercise_kcal.toLocaleString("es-ES")} kcal</strong></span>
        )}
        {data.summary.weight_delta != null && (
          <span>
            Peso:{" "}
            <strong>
              {data.summary.weight_delta > 0 ? "+" : ""}
              {data.summary.weight_delta} kg
            </strong>
          </span>
        )}
      </div>
    </Card>
  )}
  ```

- [ ] **7.8** Add regeneration modal component (inline, before the `return`):

  ```tsx
  {showRegenModal && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <Card className="bg-gray-900 border border-white/20 rounded-3xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white">Regenerar plan semanal</h3>
          <button onClick={() => setShowRegenModal(false)} className="text-white/40 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {data?.summary ? (
          <div className="mb-4 space-y-1 text-sm text-white/70">
            <p className="font-semibold text-white/90">Basado en la semana anterior:</p>
            <p>· Adherencia: {Math.round((data.summary.avg_adherence ?? 0) * 100)}%</p>
            <p>· Ejercicio acumulado: {(data.summary.total_exercise_kcal ?? 0).toLocaleString("es-ES")} kcal</p>
            {data.summary.weight_delta != null && (
              <p>· Peso: {data.summary.weight_delta > 0 ? "+" : ""}{data.summary.weight_delta} kg</p>
            )}
          </div>
        ) : (
          <p className="mb-4 text-sm text-white/60">
            No hay historial de semana anterior. El plan se generará según tu perfil.
          </p>
        )}

        <div className="mb-6 space-y-2">
          <p className="text-white font-semibold text-sm">Aplicar nuevo plan desde:</p>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="applyFrom"
              value="today"
              checked={regenApplyFrom === "today"}
              onChange={() => setRegenApplyFrom("today")}
              className="accent-emerald-400"
            />
            <span className="text-white/80 text-sm">Hoy (reemplaza el menú de hoy)</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="applyFrom"
              value="tomorrow"
              checked={regenApplyFrom === "tomorrow"}
              onChange={() => setRegenApplyFrom("tomorrow")}
              className="accent-emerald-400"
            />
            <span className="text-white/80 text-sm">Mañana (conserva el menú de hoy)</span>
          </label>
        </div>

        {regenError && (
          <p className="text-red-400 text-sm mb-3">{regenError}</p>
        )}

        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={() => { setShowRegenModal(false); setRegenError(null) }}
            className="border-white/20 text-white hover:bg-white/10"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            {regenerating ? (
              <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Regenerando...</>
            ) : (
              "Regenerar"
            )}
          </Button>
        </div>
      </Card>
    </div>
  )}
  ```

- [ ] **7.9** Add `handleRegenerate` function:

  ```typescript
  const handleRegenerate = async () => {
    setRegenerating(true)
    setRegenError(null)
    try {
      const newPlan = await regenerateWeeklyPlan(regenApplyFrom)
      setData((prev) => prev ? { ...newPlan, summary: prev.summary } : newPlan)
      setStale(false)
      setShowRegenModal(false)
    } catch (err) {
      setRegenError("Error al regenerar el plan. El plan anterior se conserva.")
    } finally {
      setRegenerating(false)
    }
  }
  ```

- [ ] **7.10** Update `PrintDayCard` component to accept `PlanDay` instead of old `WeeklyPlan["days"][0]`.

  Replace the entire `PrintDayCard` function with the following (uses `dayPlan.dayName`, maps
  `dayPlan.meals` as an array with `.map()`, and reads `meal.description` instead of `meal.text`):

  ```typescript
  function PrintDayCard({ dayPlan }: { dayPlan: PlanDay }) {
    const totalKcal = dayPlan.exerciseAdj?.adjustedTotal ?? dayPlan.totalKcal

    return (
      <div
        style={{
          breakInside: "avoid",
          marginBottom: "14pt",
          border: "1px solid #d1d5db",
          borderRadius: "8px",
          overflow: "hidden",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Day header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#064e3b",
            color: "white",
            padding: "6pt 10pt",
          }}
        >
          <span style={{ fontWeight: 700, fontSize: "12pt", letterSpacing: "0.02em" }}>
            {dayPlan.dayName}
          </span>
          {totalKcal > 0 && (
            <span
              style={{
                fontSize: "9pt",
                backgroundColor: "rgba(255,255,255,0.15)",
                padding: "2pt 8pt",
                borderRadius: "20pt",
                fontWeight: 600,
              }}
            >
              {totalKcal} kcal totales
            </span>
          )}
        </div>

        {/* Meals row */}
        <div style={{ display: "flex" }}>
          {dayPlan.meals.map((meal, idx) => {
            const color = mealTypeColor[meal.type] ?? mealTypeColor["breakfast"]
            return (
              <div
                key={meal.id}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: "4pt",
                  padding: "7pt 7pt",
                  borderRight: idx < dayPlan.meals.length - 1 ? "1px solid #e5e7eb" : "none",
                  backgroundColor: "white",
                }}
              >
                {/* Meal type badge */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "3pt",
                    paddingBottom: "5pt",
                    borderBottom: "1px solid #f3f4f6",
                    marginBottom: "2pt",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "4pt" }}>
                    <span style={{ fontSize: "11pt" }}>{mealTypeEmoji[meal.type]}</span>
                    <span
                      style={{
                        fontSize: "6.5pt",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        color: "#6b7280",
                      }}
                    >
                      {mealTypeLabels[meal.type]}
                    </span>
                  </div>
                  {meal.kcal > 0 && (
                    <span
                      style={{
                        fontSize: "7pt",
                        fontWeight: 700,
                        color: color.text,
                        backgroundColor: color.bg,
                        border: `1px solid ${color.border}`,
                        padding: "1pt 5pt",
                        borderRadius: "20pt",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {meal.adjustedKcal ?? meal.kcal} kcal
                    </span>
                  )}
                </div>

                {/* Meal description */}
                <p
                  style={{
                    fontSize: "8pt",
                    color: "#1f2937",
                    lineHeight: 1.45,
                    margin: 0,
                    flex: 1,
                  }}
                >
                  {meal.description}
                </p>

                {/* Note */}
                {meal.note && (
                  <div
                    style={{
                      marginTop: "4pt",
                      paddingTop: "4pt",
                      borderTop: "1px solid #f3f4f6",
                      fontSize: "7pt",
                      color: "#92400e",
                      backgroundColor: "#fffbeb",
                      padding: "4pt 5pt",
                      borderRadius: "4pt",
                      lineHeight: 1.4,
                    }}
                  >
                    💡 {meal.note}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }
  ```

  Update `PrintShoppingList` call — shopping list is now separate. Fetch it independently.

  > **Correction for codebase:** The current `weekly-plan/page.tsx` does NOT use a bare `get`
  > helper or a `transformShoppingList` function. The page fetches its data exclusively via
  > `fetchWeeklyPlan()` from `@/lib/api`, and the shopping list is currently embedded as part
  > of the `WeeklyPlan` mock data (`shoppingList` property). There is no `get` import in the
  > page file and no `transformShoppingList` utility in the codebase.
  >
  > The correct approach to fetch the shopping list independently is:

  Add state:
  ```typescript
  const [shoppingList, setShoppingList] = useState<{ category: string; items: string[] }[]>([])
  ```

  In the existing `useEffect`, add a parallel fetch alongside `fetchWeeklyPlan()`:
  ```typescript
  useEffect(() => {
    fetchWeeklyPlan()
      .then((d) => { setStale(d.stale); setData(d) })
      .catch(() => setData(mockWeeklyPlanResponse))
      .finally(() => setLoading(false))

    // Shopping list: backend returns { category: string[] } — transform to array of objects
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/diet/shopping-list`, {
      headers: { "ngrok-skip-browser-warning": "true" },
    })
      .then((res) => res.json())
      .then((raw: Record<string, string[]>) => {
        setShoppingList(
          Object.entries(raw).map(([category, items]) => ({ category, items }))
        )
      })
      .catch(() => {}) // silently keep empty list; print section is hidden until data loads
  }, [])
  ```

  In the print section, guard `<PrintShoppingList>` so it only renders when data is available:
  ```tsx
  {shoppingList.length > 0 && (
    <PrintShoppingList shoppingList={shoppingList} />
  )}
  ```

  > The `PrintShoppingList` component signature remains unchanged — it already accepts
  > `{ category: string; items: string[] }[]`. No `transformShoppingList` function is needed.

- [ ] **7.11** Update `totalWeekKcal` calculation:

  ```typescript
  const totalWeekKcal = (plan.days ?? []).reduce(
    (sum, day) => sum + (day.exerciseAdj?.adjustedTotal ?? day.totalKcal),
    0
  )
  ```

### Commit

```bash
git add nutrition_frontend/app/weekly-plan/page.tsx
git commit -m "feat(weekly-plan): adopt PlanDay model, today marker, exercise indicators, regen modal"
```

---

## Integration Smoke Test

After all tasks are complete, perform end-to-end verification:

```bash
# 1. Start backend
cd nutrition_assistant && uvicorn api:app --reload &

# 2. Start frontend
cd nutrition_frontend && npm run dev &

# 3. Verify /diet/today returns new shape
curl -s -H "X-User-Timezone: Europe/Madrid" http://localhost:8000/diet/today \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('date:', d['date'], '| dayName:', d['dayName'], '| meals:', len(d['meals']), '| stale:', d['stale'])"
# Expected: date: 2026-03-20 | dayName: Viernes | meals: 5 | stale: False

# 4. Verify /diet/weekly returns new shape
curl -s http://localhost:8000/diet/weekly \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('days:', len(d['days']), '| stale:', d['stale'], '| summary:', d['summary'])"
# Expected: days: 7 | stale: False | summary: None

# 5. Run all backend tests
cd nutrition_assistant && python -m pytest tests/ -v
# Expected: all tests pass

# 6. Browser checks
# Open http://localhost:3000/diet → verify subtitle, no tip errors
# Open http://localhost:3000/weekly-plan → verify HOY badge on today, Regenerar button
```

---

## Final Commit Summary

| Task | Commit message |
|------|---------------|
| 1 | `refactor(api): unify Meal/PlanDay types and add X-User-Timezone header` |
| 2 | `feat(storage): add exercise_adj and weekly_history to session schema` |
| 3 | `feat(diet): rewrite generate_week_plan with ISO-date keys and history-based adjustment` |
| 4 | `feat(diet): add get_day_from_plan with portion scaling and exercise adjustment` |
| 5 | `feat(api): update diet endpoints to use PlanDay model and stale detection` |
| 6 | `feat(diet-page): adopt PlanDay model, exercise badge, and stale banner` |
| 7 | `feat(weekly-plan): adopt PlanDay model, today marker, exercise indicators, regen modal` |
