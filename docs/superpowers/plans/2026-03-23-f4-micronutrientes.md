# F4 — Micronutrientes Completo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full micronutrient tracking — extend the food model, compute RDA defaults, let users set custom goals, track daily intake, and show historical charts.

**Architecture:** Tasks build on each other: Task 1 extends the food data model in `api.py` (OpenFoodFacts mapper) and `diet.py` (plan generation). Task 2 adds RDA calculations to `calculator.py` and a new profile endpoint. Task 3 adds `GET /micronutrients/today` that sums from today's adherence log. Task 4 adds `GET /micronutrients/history` and a new progress page tab. Each task has independent backend endpoints and frontend sections that can be verified in isolation.

**Tech Stack:** FastAPI, Pydantic, JSON storage, Next.js 15, Recharts 2.15, `@radix-ui/react-tabs` (already installed), Tailwind CSS.

---

## Files Modified/Created

- `nutrition_assistant/api.py` — extend OpenFoodFacts mapper, add micronutrient endpoints (Tasks 1, 3, 4)
- `nutrition_assistant/diet.py` — extend meal dict schema with micronutrient keys (Task 1)
- `nutrition_assistant/calculator.py` — add `calculate_rda()` function (Task 2)
- `nutrition_frontend/lib/api.ts` — add micronutrient API functions (Tasks 2, 3, 4)
- `nutrition_frontend/app/settings/page.tsx` — add collapsible micronutrient goals section (Task 2)
- `nutrition_frontend/app/diet/page.tsx` — add collapsible micronutrient section (Task 3)
- `nutrition_frontend/app/progress/page.tsx` — add micronutrients tab (Task 4)

---

### Task 1: Extend Food Model with Micronutrients

**Files:**
- Modify: `nutrition_assistant/api.py`
- Modify: `nutrition_assistant/diet.py`

**Pre-task audit:** The OpenFoodFacts proxy in `api.py` is at line 1564–1599. It currently maps only `energy-kcal_100g`. The `diet.py` file stores meals as plain dicts with keys: `id`, `type`, `name`, `kcal`, `text`, `note`, `timing_note`, `adjusted_kcal`, `portion_scale`, `fixedKcal`, `targetKcal`, `carb_g`. No `models.py` or `food_parser.py` exist.

- [ ] Step 1: Write a failing pytest. Add to `nutrition_assistant/tests/test_api.py`:

  ```python
  def test_food_search_includes_micronutrients():
      """Food search results include micronutrient fields (may be null)."""
      from unittest.mock import patch, MagicMock
      import urllib.request

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
          def read(self): return json.dumps(mock_response).encode()
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
  ```

- [ ] Step 2: Run the test to confirm it fails:
  ```bash
  cd /Users/practica/nutritrack/nutrition_assistant
  python -m pytest tests/test_api.py::test_food_search_includes_micronutrients -v
  ```
  Expected: `FAILED` — missing keys in result dict.

- [ ] Step 3: In `nutrition_assistant/api.py`, modify the `search_food` endpoint's result mapping (around line 1588). Replace:

  ```python
  results.append({
      "name": name,
      "kcal_100g": round(kcal),
      "image": product.get("image_small_url"),
  })
  ```

  With:

  ```python
  n = product.get("nutriments", {})

  def _mg(key: str) -> float | None:
      v = n.get(key)
      return round(v * 1000, 1) if v is not None else None

  def _g(key: str) -> float | None:
      v = n.get(key)
      return round(v, 2) if v is not None else None

  def _mcg(key: str) -> float | None:
      v = n.get(key)
      return round(v * 1_000_000, 1) if v is not None else None

  results.append({
      "name":          name,
      "kcal_100g":     round(kcal),
      "image":         product.get("image_small_url"),
      # Micronutrients (per 100g, units noted in key suffix)
      "fiber_g":       _g("fiber_100g"),
      "sodium_mg":     _mg("sodium_100g"),
      "potassium_mg":  _mg("potassium_100g"),
      "vitamin_a_mcg": _mcg("vitamin-a_100g"),
      "vitamin_c_mg":  _mg("vitamin-c_100g"),
      "vitamin_d_mcg": _mcg("vitamin-d_100g"),
      "vitamin_b12_mcg": _mcg("vitamin-b12_100g"),
      "calcium_mg":    _mg("calcium_100g"),
      "iron_mg":       _mg("iron_100g"),
      "magnesium_mg":  _mg("magnesium_100g"),
      "zinc_mg":       _mg("zinc_100g"),
  })
  ```

- [ ] Step 4: In `nutrition_assistant/diet.py`, find where meal dicts are constructed (look for lines that build dicts with `"id"`, `"kcal"`, `"text"` keys). Add the micronutrient keys with `None` defaults. This ensures the plan generation pipeline passes the fields through even when data is unavailable. Typically meal dicts are built with `dict(...)` or literal dict syntax. Add these keys wherever a meal dict is finalized:

  ```python
  # Micronutrients — populated when food data is available; None otherwise
  "fiber_g":          None,
  "sodium_mg":        None,
  "potassium_mg":     None,
  "vitamin_a_mcg":    None,
  "vitamin_c_mg":     None,
  "vitamin_d_mcg":    None,
  "vitamin_b12_mcg":  None,
  "calcium_mg":       None,
  "iron_mg":          None,
  "magnesium_mg":     None,
  "zinc_mg":          None,
  ```

  **Important:** Read `diet.py` lines 60–200 first to find the exact location where individual meal dicts are created (look for `"id":` pattern).

- [ ] Step 5: Run the test to confirm it passes:
  ```bash
  cd /Users/practica/nutritrack/nutrition_assistant
  python -m pytest tests/test_api.py::test_food_search_includes_micronutrients -v
  ```
  Expected: `PASSED`.

- [ ] Step 6: Run the full test suite to confirm no regressions:
  ```bash
  cd /Users/practica/nutritrack/nutrition_assistant
  python -m pytest tests/ -v
  ```
  Expected: all previously passing tests still pass.

- [ ] Step 7: Commit:
  ```bash
  cd /Users/practica/nutritrack
  git add nutrition_assistant/api.py nutrition_assistant/diet.py
  git commit -m "feat: extend food model with 11 micronutrient fields from OpenFoodFacts"
  ```

---

### Task 2: Configurable Micronutrient Goals

**Files:**
- Modify: `nutrition_assistant/calculator.py`
- Modify: `nutrition_assistant/api.py`
- Modify: `nutrition_frontend/lib/api.ts`
- Modify: `nutrition_frontend/app/settings/page.tsx`

#### Sub-task 2a: Backend — RDA calculation and profile endpoint

- [ ] Step 1: Write a failing pytest. Add to `nutrition_assistant/tests/test_api.py`:

  ```python
  def test_calculate_rda_male():
      """RDA values are reasonable for an adult male."""
      from calculator import calculate_rda
      rda = calculate_rda(gender="male", age=30, weight_kg=80)
      assert rda["calcium_mg"] == 1000
      assert rda["iron_mg"] == 8
      assert rda["vitamin_c_mg"] == 90
      assert isinstance(rda["protein_g"], (int, float))

  def test_put_micronutrient_goals(tmp_path):
      """PUT /profile/micronutrient-goals saves and returns goals."""
      from unittest.mock import patch
      import storage
      with patch.object(storage, "PROFILE_FILE", str(tmp_path / "profile.json")):
          # First create a profile
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
  ```

- [ ] Step 2: Run the tests to confirm they fail:
  ```bash
  cd /Users/practica/nutritrack/nutrition_assistant
  python -m pytest tests/test_api.py::test_calculate_rda_male tests/test_api.py::test_put_micronutrient_goals -v
  ```
  Expected: `FAILED`.

- [ ] Step 3: Add `calculate_rda()` to `nutrition_assistant/calculator.py` (append after `calculate_macros`):

  ```python
  # RDA reference values (EU NRV / NIH DRI — adult averages)
  # Sources: EFSA NRV 2019, NIH Office of Dietary Supplements
  _RDA_BASE = {
      "fiber_g":          25,    # g/day
      "sodium_mg":        2000,  # mg/day (upper limit)
      "potassium_mg":     3500,  # mg/day
      "vitamin_a_mcg":    800,   # mcg/day RAE
      "vitamin_c_mg":     80,    # mg/day
      "vitamin_d_mcg":    15,    # mcg/day
      "vitamin_b12_mcg":  2.4,   # mcg/day
      "calcium_mg":       1000,  # mg/day
      "iron_mg":          8,     # mg/day (men); overridden for women below
      "magnesium_mg":     375,   # mg/day
      "zinc_mg":          10,    # mg/day
  }

  _RDA_FEMALE_OVERRIDES = {
      "iron_mg":       18,   # premenopausal
      "calcium_mg":    1000,
      "zinc_mg":       8,
  }

  def calculate_rda(gender: str, age: int, weight_kg: float) -> dict:
      """
      Returns Recommended Dietary Allowances (RDA) per day based on profile.
      Uses EU NRV as baseline; adjusts for gender and age.
      """
      rda = dict(_RDA_BASE)

      # Gender adjustments
      if gender == "female":
          rda.update(_RDA_FEMALE_OVERRIDES)
          if age >= 51:
              rda["iron_mg"] = 8       # postmenopausal
              rda["calcium_mg"] = 1200  # increased in older women

      # Age adjustments
      if age >= 70:
          rda["calcium_mg"] = 1200
          rda["vitamin_d_mcg"] = 20

      # Protein (g/day) based on weight — add to RDA for completeness
      protein_factor = PROTEIN_FACTORS.get("maintain", 2.0)
      rda["protein_g"] = round(weight_kg * protein_factor)

      return {k: round(v, 1) if isinstance(v, float) else v for k, v in rda.items()}
  ```

- [ ] Step 4: In `nutrition_assistant/api.py`, add to the calculator import:
  ```python
  from calculator import (
      calculate_bmr, calculate_tdee, calculate_daily_target,
      calculate_macros, ACTIVITY_LEVELS, GOAL_ADJUSTMENTS,
      calculate_rda,
  )
  ```

  Add a Pydantic model and the new endpoint (place after `PUT /profile`):

  ```python
  class MicronutrientGoalsModel(BaseModel):
      fiber_g:          Optional[float] = None
      sodium_mg:        Optional[float] = None
      potassium_mg:     Optional[float] = None
      vitamin_a_mcg:    Optional[float] = None
      vitamin_c_mg:     Optional[float] = None
      vitamin_d_mcg:    Optional[float] = None
      vitamin_b12_mcg:  Optional[float] = None
      calcium_mg:       Optional[float] = None
      iron_mg:          Optional[float] = None
      magnesium_mg:     Optional[float] = None
      zinc_mg:          Optional[float] = None

  @app.put("/profile/micronutrient-goals", tags=["Perfil"])
  def update_micronutrient_goals(data: MicronutrientGoalsModel):
      """Guarda objetivos de micronutrientes personalizados en user_profile.json."""
      profile = load_profile()
      goals = {k: v for k, v in data.model_dump().items() if v is not None}
      profile["micronutrient_goals"] = goals
      save_profile(profile)
      return {"ok": True, "micronutrient_goals": goals}

  @app.get("/profile/micronutrient-goals", tags=["Perfil"])
  def get_micronutrient_goals():
      """Devuelve objetivos de micronutrientes (custom si existen, RDA por defecto si no)."""
      profile = load_profile()
      custom = profile.get("micronutrient_goals", {})
      rda = calculate_rda(
          gender=profile.get("gender", "male"),
          age=profile.get("age", 30),
          weight_kg=profile.get("weight_kg", 70),
      )
      # Merge: custom values override RDA defaults
      return {**rda, **custom}
  ```

- [ ] Step 5: Run the tests to confirm they pass:
  ```bash
  cd /Users/practica/nutritrack/nutrition_assistant
  python -m pytest tests/test_api.py::test_calculate_rda_male tests/test_api.py::test_put_micronutrient_goals -v
  ```
  Expected: `PASSED`.

#### Sub-task 2b: Frontend

- [ ] Step 6: Add to `nutrition_frontend/lib/api.ts`:

  ```typescript
  // ── Micronutrient Goals ───────────────────────────────────────────────────

  export interface MicronutrientGoals {
    fiber_g?: number | null
    sodium_mg?: number | null
    potassium_mg?: number | null
    vitamin_a_mcg?: number | null
    vitamin_c_mg?: number | null
    vitamin_d_mcg?: number | null
    vitamin_b12_mcg?: number | null
    calcium_mg?: number | null
    iron_mg?: number | null
    magnesium_mg?: number | null
    zinc_mg?: number | null
    protein_g?: number | null  // from RDA
  }

  export async function getMicronutrientGoals(): Promise<MicronutrientGoals> {
    return get<MicronutrientGoals>("/profile/micronutrient-goals")
  }

  export async function updateMicronutrientGoals(goals: MicronutrientGoals): Promise<void> {
    await put<{ ok: boolean }>("/profile/micronutrient-goals", goals)
  }
  ```

- [ ] Step 7: In `nutrition_frontend/app/settings/page.tsx`, add a collapsible "Objetivos de micronutrientes" section. Add imports:

  ```typescript
  import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
  import { ChevronDown } from "lucide-react"
  import { getMicronutrientGoals, updateMicronutrientGoals, type MicronutrientGoals } from "@/lib/api"
  ```

  Add state:
  ```typescript
  const [microGoals, setMicroGoals] = useState<MicronutrientGoals | null>(null)
  const [microOpen, setMicroOpen] = useState(false)
  const [savingMicro, setSavingMicro] = useState(false)
  ```

  In `useEffect`, add:
  ```typescript
  getMicronutrientGoals().then(setMicroGoals).catch(() => null)
  ```

  Add handler:
  ```typescript
  const handleSaveMicroGoals = async () => {
    if (!microGoals) return
    setSavingMicro(true)
    try {
      await updateMicronutrientGoals(microGoals)
    } finally {
      setSavingMicro(false)
    }
  }
  ```

  Add the collapsible section in the JSX (before the export card, or as a new tab). Define the fields display map:

  ```tsx
  {microGoals && (
    <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6">
      <Collapsible open={microOpen} onOpenChange={setMicroOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full">
          <h3 className="text-lg font-semibold text-white">Objetivos de micronutrientes</h3>
          <ChevronDown className={`h-5 w-5 text-white/50 transition-transform ${microOpen ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4">
          <p className="text-white/50 text-sm mb-4">
            Valores pre-rellenados con IDR recomendadas. Puedes personalizar cada uno.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {([
              { key: "fiber_g",         label: "Fibra (g/día)" },
              { key: "sodium_mg",       label: "Sodio (mg/día)" },
              { key: "potassium_mg",    label: "Potasio (mg/día)" },
              { key: "calcium_mg",      label: "Calcio (mg/día)" },
              { key: "iron_mg",         label: "Hierro (mg/día)" },
              { key: "magnesium_mg",    label: "Magnesio (mg/día)" },
              { key: "zinc_mg",         label: "Zinc (mg/día)" },
              { key: "vitamin_c_mg",    label: "Vitamina C (mg/día)" },
              { key: "vitamin_d_mcg",   label: "Vitamina D (mcg/día)" },
              { key: "vitamin_a_mcg",   label: "Vitamina A (mcg/día)" },
              { key: "vitamin_b12_mcg", label: "Vitamina B12 (mcg/día)" },
            ] as { key: keyof MicronutrientGoals; label: string }[]).map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <Label className="text-white/60 text-xs">{label}</Label>
                <Input
                  type="number"
                  min={0}
                  value={microGoals[key] ?? ""}
                  onChange={(e) => setMicroGoals(prev =>
                    prev ? { ...prev, [key]: e.target.value ? Number(e.target.value) : null } : prev
                  )}
                  className="bg-white/5 border-white/20 text-white text-sm h-8"
                />
              </div>
            ))}
          </div>
          <Button
            onClick={handleSaveMicroGoals}
            disabled={savingMicro}
            className="mt-4 bg-emerald-600 hover:bg-emerald-700"
          >
            {savingMicro ? "Guardando..." : "Guardar objetivos"}
          </Button>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )}
  ```

- [ ] Step 8: Manual verification:
  1. Open `/settings`. Expected: "Objetivos de micronutrientes" collapsible card at the bottom.
  2. Expand it — fields pre-filled with RDA defaults.
  3. Change "Calcio" to 1200, click "Guardar objetivos".
  4. Reload page — expand section again. Expected: 1200 still shown for Calcio.
  5. Verify `user_profile.json` contains `micronutrient_goals: { calcium_mg: 1200 }`.

- [ ] Step 9: Commit:
  ```bash
  cd /Users/practica/nutritrack
  git add nutrition_assistant/calculator.py nutrition_assistant/api.py nutrition_frontend/lib/api.ts nutrition_frontend/app/settings/page.tsx
  git commit -m "feat: add RDA-based micronutrient goals with customizable settings UI"
  ```

---

### Task 3: Daily Micronutrient Tracking

**Files:**
- Modify: `nutrition_assistant/api.py`
- Modify: `nutrition_frontend/lib/api.ts`
- Modify: `nutrition_frontend/app/diet/page.tsx`

**Note:** The daily micronutrient total is a best-effort sum. Today's adherence log stores which meals were followed, but food micronutrient data is only available from OpenFoodFacts searches (not from the plan generator). This endpoint sums micronutrients from `adherence_log.json` entries that contain `skipped_meals` food data (which does include custom food searches). For plan meals, values are `null` unless the user searched for foods. This is expected behavior — shown as "sin datos" in the UI.

#### Sub-task 3a: Backend

- [ ] Step 1: Write a failing pytest. Add to `nutrition_assistant/tests/test_api.py`:

  ```python
  def test_micronutrients_today_returns_structure():
      """GET /micronutrients/today returns the expected keys."""
      r = client.get("/micronutrients/today", headers={"X-User-Timezone": "Europe/Madrid"})
      assert r.status_code == 200
      body = r.json()
      assert "totals" in body
      assert "goals" in body
      assert isinstance(body["totals"], dict)
  ```

- [ ] Step 2: Run the test to confirm it fails:
  ```bash
  cd /Users/practica/nutritrack/nutrition_assistant
  python -m pytest tests/test_api.py::test_micronutrients_today_returns_structure -v
  ```
  Expected: `FAILED` — 404.

- [ ] Step 3: Add the endpoint to `nutrition_assistant/api.py` (after the adherence endpoints):

  ```python
  # ══════════════════════════════════════════════════════════════════════════════
  # MICRONUTRIENTES
  # ══════════════════════════════════════════════════════════════════════════════

  MICRO_KEYS = [
      "fiber_g", "sodium_mg", "potassium_mg",
      "vitamin_a_mcg", "vitamin_c_mg", "vitamin_d_mcg", "vitamin_b12_mcg",
      "calcium_mg", "iron_mg", "magnesium_mg", "zinc_mg",
  ]

  @app.get("/micronutrients/today", tags=["Micronutrientes"])
  def micronutrients_today(x_user_timezone: str | None = Header(None)):
      """
      Suma los micronutrientes de las comidas consumidas hoy.
      Los valores de comidas del plan son null (no tenemos datos por comida).
      Solo se suman los alimentos de 'skipped_meals' que provienen de búsquedas.
      """
      tz = x_user_timezone or "UTC"
      try:
          today_iso = datetime.now(zoneinfo.ZoneInfo(tz)).date().isoformat()
      except Exception:
          today_iso = date.today().isoformat()

      adh_log = {}
      if os.path.exists(ADHERENCE_FILE):
          with open(ADHERENCE_FILE) as f:
              adh_log = json.load(f)

      totals = {k: None for k in MICRO_KEYS}
      today_entry = adh_log.get(today_iso, {})
      skipped = today_entry.get("skipped_meals", {})

      for meal_id, meal_data in skipped.items():
          for food in meal_data.get("foods", []):
              for key in MICRO_KEYS:
                  val = food.get(key)
                  if val is not None:
                      totals[key] = (totals[key] or 0) + val

      profile = load_profile()
      goals = profile.get("micronutrient_goals") or calculate_rda(
          gender=profile.get("gender", "male"),
          age=profile.get("age", 30),
          weight_kg=profile.get("weight_kg", 70),
      )

      return {"totals": totals, "goals": goals}
  ```

- [ ] Step 4: Run the test to confirm it passes:
  ```bash
  cd /Users/practica/nutritrack/nutrition_assistant
  python -m pytest tests/test_api.py::test_micronutrients_today_returns_structure -v
  ```
  Expected: `PASSED`.

#### Sub-task 3b: Frontend

- [ ] Step 5: Add to `nutrition_frontend/lib/api.ts`:

  ```typescript
  // ── Micronutrient Tracking ────────────────────────────────────────────────

  export interface MicronutrientTotals {
    fiber_g: number | null
    sodium_mg: number | null
    potassium_mg: number | null
    vitamin_a_mcg: number | null
    vitamin_c_mg: number | null
    vitamin_d_mcg: number | null
    vitamin_b12_mcg: number | null
    calcium_mg: number | null
    iron_mg: number | null
    magnesium_mg: number | null
    zinc_mg: number | null
  }

  export interface MicronutrientsToday {
    totals: MicronutrientTotals
    goals: MicronutrientGoals
  }

  export async function getMicronutrientsToday(): Promise<MicronutrientsToday> {
    return get<MicronutrientsToday>("/micronutrients/today")
  }
  ```

- [ ] Step 6: In `nutrition_frontend/app/diet/page.tsx`, add a collapsible "Micronutrientes del día" section. Add imports:

  ```typescript
  import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
  import { ChevronDown } from "lucide-react"
  import { ..., getMicronutrientsToday, type MicronutrientsToday } from "@/lib/api"
  ```

  Add state:
  ```typescript
  const [micronutrients, setMicronutrients] = useState<MicronutrientsToday | null>(null)
  const [microOpen, setMicroOpen] = useState(false)
  ```

  Add to the `useEffect` (after loading the plan), or in a separate effect:
  ```typescript
  getMicronutrientsToday().then(setMicronutrients).catch(() => null)
  ```

  Also refresh after `handleAdherenceChange` completes:
  ```typescript
  getMicronutrientsToday().then(setMicronutrients).catch(() => null)
  ```

  Add the collapsible section in the JSX (after the existing macro/calorie section, inside the diet cards area):

  ```tsx
  {micronutrients && (
    <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-5">
      <Collapsible open={microOpen} onOpenChange={setMicroOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full">
          <h3 className="text-base font-semibold text-white">Micronutrientes del día</h3>
          <ChevronDown className={`h-4 w-4 text-white/50 transition-transform ${microOpen ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3">
          <div className="space-y-2">
            {([
              { key: "fiber_g",         label: "Fibra",       unit: "g" },
              { key: "calcium_mg",      label: "Calcio",      unit: "mg" },
              { key: "iron_mg",         label: "Hierro",      unit: "mg" },
              { key: "vitamin_c_mg",    label: "Vitamina C",  unit: "mg" },
              { key: "vitamin_d_mcg",   label: "Vitamina D",  unit: "mcg" },
              { key: "magnesium_mg",    label: "Magnesio",    unit: "mg" },
              { key: "zinc_mg",         label: "Zinc",        unit: "mg" },
              { key: "potassium_mg",    label: "Potasio",     unit: "mg" },
              { key: "sodium_mg",       label: "Sodio",       unit: "mg" },
              { key: "vitamin_a_mcg",   label: "Vitamina A",  unit: "mcg" },
              { key: "vitamin_b12_mcg", label: "Vitamina B12", unit: "mcg" },
            ] as { key: keyof MicronutrientTotals; label: string; unit: string }[]).map(({ key, label, unit }) => {
              const current = micronutrients.totals[key]
              const goal = (micronutrients.goals as any)[key]
              if (current === null) {
                return (
                  <div key={key} className="flex justify-between text-xs">
                    <span className="text-white/50">{label}</span>
                    <span className="text-white/30 italic">sin datos</span>
                  </div>
                )
              }
              const pct = goal > 0 ? Math.min(Math.round((current / goal) * 100), 100) : 0
              const barColor = pct >= 90 ? "bg-emerald-400" : pct >= 70 ? "bg-amber-400" : "bg-red-400"
              return (
                <div key={key} className="space-y-0.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/60">{label}</span>
                    <span className="text-white/70">{current}{unit} / {goal}{unit}</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1">
                    <div className={`${barColor} h-1 rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-white/30 text-xs mt-3">
            * Solo incluye alimentos de comidas saltadas registrados manualmente
          </p>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )}
  ```

- [ ] Step 7: Manual verification:
  1. Open `/diet`. Expected: "Micronutrientes del día" collapsible card visible.
  2. Expand it — all rows show "sin datos" (unless foods were logged via food search).
  3. Use the food search to add a food to a skipped meal. Expected: some nutrient bars update if the food had OpenFoodFacts data.
  4. Fields without data show italic "sin datos" text.

- [ ] Step 8: Commit:
  ```bash
  cd /Users/practica/nutritrack
  git add nutrition_assistant/api.py nutrition_frontend/lib/api.ts nutrition_frontend/app/diet/page.tsx
  git commit -m "feat: add daily micronutrient tracking section to diet page"
  ```

---

### Task 4: Historical Micronutrient Charts

**Files:**
- Modify: `nutrition_assistant/api.py`
- Modify: `nutrition_frontend/lib/api.ts`
- Modify: `nutrition_frontend/app/progress/page.tsx`

#### Sub-task 4a: Backend

- [ ] Step 1: Write a failing pytest. Add to `nutrition_assistant/tests/test_api.py`:

  ```python
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
  ```

- [ ] Step 2: Run the test to confirm it fails:
  ```bash
  cd /Users/practica/nutritrack/nutrition_assistant
  python -m pytest tests/test_api.py::test_micronutrients_history_returns_structure -v
  ```
  Expected: `FAILED` — 404.

- [ ] Step 3: Add the endpoint to `nutrition_assistant/api.py` (after `/micronutrients/today`):

  ```python
  @app.get("/micronutrients/history", tags=["Micronutrientes"])
  def micronutrients_history(days: int = Query(7, ge=7, le=30)):
      """
      Devuelve el historial de micronutrientes de los últimos `days` días.
      Cada entrada: { date, totals: { nutrient: value|null } }
      """
      adh_log = {}
      if os.path.exists(ADHERENCE_FILE):
          with open(ADHERENCE_FILE) as f:
              adh_log = json.load(f)

      today = date.today()
      history = []

      for i in range(days - 1, -1, -1):
          iso = (today - timedelta(days=i)).isoformat()
          entry = adh_log.get(iso, {})
          totals = {k: None for k in MICRO_KEYS}
          skipped = entry.get("skipped_meals", {})

          for meal_data in skipped.values():
              for food in meal_data.get("foods", []):
                  for key in MICRO_KEYS:
                      val = food.get(key)
                      if val is not None:
                          totals[key] = (totals[key] or 0) + val

          history.append({"date": iso, "totals": totals})

      return {"history": history}
  ```

- [ ] Step 4: Run the test to confirm it passes:
  ```bash
  cd /Users/practica/nutritrack/nutrition_assistant
  python -m pytest tests/test_api.py::test_micronutrients_history_returns_structure -v
  ```
  Expected: `PASSED`.

#### Sub-task 4b: Frontend

- [ ] Step 5: Add to `nutrition_frontend/lib/api.ts`:

  ```typescript
  export interface MicronutrientsHistoryEntry {
    date: string
    totals: MicronutrientTotals
  }

  export async function getMicronutrientsHistory(days: 7 | 30 = 7): Promise<MicronutrientsHistoryEntry[]> {
    const d = await get<{ history: MicronutrientsHistoryEntry[] }>(`/micronutrients/history?days=${days}`)
    return d.history
  }
  ```

- [ ] Step 6: In `nutrition_frontend/app/progress/page.tsx`, add a "Micronutrientes" tab. The progress page uses Recharts `LineChart` and `BarChart` already. Add imports:

  ```typescript
  import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
  import {
    fetchProgress, logWeight,
    getMicronutrientsHistory, getMicronutrientGoals,
    type MicronutrientsHistoryEntry, type MicronutrientGoals,
  } from "@/lib/api"
  ```

  Add state:
  ```typescript
  const [microHistory, setMicroHistory] = useState<MicronutrientsHistoryEntry[]>([])
  const [microGoals, setMicroGoals] = useState<MicronutrientGoals | null>(null)
  const [microDays, setMicroDays] = useState<7 | 30>(7)
  const [selectedNutrient, setSelectedNutrient] = useState("calcium_mg")
  ```

  Add to `useEffect` (or a separate effect for `microDays`):
  ```typescript
  getMicronutrientsHistory(microDays).then(setMicroHistory).catch(() => [])
  getMicronutrientGoals().then(setMicroGoals).catch(() => null)
  ```

  Wrap the existing page content in a `<Tabs>` component with two tabs: "Peso y Adherencia" and "Micronutrientes":

  ```tsx
  <Tabs defaultValue="weight">
    <TabsList className="bg-white/10 border border-white/20 mb-4">
      <TabsTrigger value="weight" className="text-white/70 data-[state=active]:text-white">
        Peso y Adherencia
      </TabsTrigger>
      <TabsTrigger value="micros" className="text-white/70 data-[state=active]:text-white">
        Micronutrientes
      </TabsTrigger>
    </TabsList>

    <TabsContent value="weight">
      {/* All existing progress page content goes here */}
    </TabsContent>

    <TabsContent value="micros">
      <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="text-lg font-semibold text-white">Micronutrientes</h3>
          <div className="flex gap-2 flex-wrap">
            <Select value={selectedNutrient} onValueChange={setSelectedNutrient}>
              <SelectTrigger className="bg-white/5 border-white/20 text-white w-44 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  { key: "calcium_mg",      label: "Calcio (mg)" },
                  { key: "iron_mg",         label: "Hierro (mg)" },
                  { key: "fiber_g",         label: "Fibra (g)" },
                  { key: "vitamin_c_mg",    label: "Vitamina C (mg)" },
                  { key: "vitamin_d_mcg",   label: "Vitamina D (mcg)" },
                  { key: "magnesium_mg",    label: "Magnesio (mg)" },
                  { key: "zinc_mg",         label: "Zinc (mg)" },
                  { key: "potassium_mg",    label: "Potasio (mg)" },
                  { key: "sodium_mg",       label: "Sodio (mg)" },
                ].map(({ key, label }) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {([7, 30] as const).map((d) => (
              <button
                key={d}
                onClick={() => setMicroDays(d)}
                className={`px-3 py-1 text-xs rounded-lg border transition-colors ${
                  microDays === d
                    ? "bg-emerald-500/20 border-emerald-400/30 text-emerald-300"
                    : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10"
                }`}
              >
                {d} días
              </button>
            ))}
          </div>
        </div>

        {microHistory.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={microHistory.map(e => ({
                date:  e.date.slice(5),  // "MM-DD"
                value: (e.totals as any)[selectedNutrient],
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} />
                <Tooltip
                  formatter={(val: number | null) => [val !== null ? val : "sin datos", selectedNutrient]}
                  contentStyle={{ background: "rgba(0,0,0,0.8)", border: "none", borderRadius: 8 }}
                />
                {microGoals && (
                  <Line
                    type="monotone"
                    dataKey={() => (microGoals as any)[selectedNutrient]}
                    stroke="rgba(255,255,255,0.3)"
                    strokeDasharray="4 4"
                    dot={false}
                    name="Objetivo"
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#34d399"
                  strokeWidth={2}
                  dot={{ fill: "#34d399", r: 3 }}
                  connectNulls={false}
                  name={selectedNutrient}
                />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-white/30 text-xs mt-2 text-center">
              Línea discontinua = objetivo diario · Solo comidas con datos OpenFoodFacts
            </p>
          </>
        ) : (
          <p className="text-white/40 text-sm text-center py-8">
            Sin datos de micronutrientes aún. Registra alimentos con búsqueda para empezar.
          </p>
        )}
      </Card>
    </TabsContent>
  </Tabs>
  ```

- [ ] Step 7: Manual verification:
  1. Open `/progress`. Expected: two tabs — "Peso y Adherencia" and "Micronutrientes".
  2. The "Peso y Adherencia" tab shows all existing content unchanged.
  3. Click "Micronutrientes". Expected: selector for nutrient and 7/30 day toggle.
  4. With no data: shows "Sin datos de micronutrientes aún" message.
  5. After adding food via diet page search: some entries appear in the chart.
  6. Toggle 7/30 days — chart refreshes.
  7. Change nutrient selector — chart updates to show new nutrient data.

- [ ] Step 8: Commit:
  ```bash
  cd /Users/practica/nutritrack
  git add nutrition_assistant/api.py nutrition_frontend/lib/api.ts nutrition_frontend/app/progress/page.tsx
  git commit -m "feat: add historical micronutrient charts tab to progress page"
  ```
