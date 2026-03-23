# Guía Inteligente Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add weekly weight averaging, a smart coach tips card on the dashboard, and a home/gym training mode selector.

**Architecture:** Task 1 is backend + frontend (new endpoint + new chart line). Task 2 is pure frontend (derive tip from existing dashboard data). Task 3 is backend + frontend (extend profile model + apply calorie adjustment + settings toggle).

**Tech Stack:** FastAPI, Python, Next.js 15 App Router, React, Tailwind CSS, Recharts, lucide-react.

---

## Task 1 — Weekly Weight Average (Anti-Anxiety)

**Files:**
- `nutrition_assistant/api.py` — new `GET /weight/stats` endpoint
- `nutrition_assistant/tests/test_weight_stats.py` — new test file
- `nutrition_frontend/lib/api.ts` — add `WeightStats` interface and `fetchWeightStats()`
- `nutrition_frontend/app/progress/page.tsx` — add `weeklyAvg` to chart data and third `<Line>`

### Backend

- [ ] Create `nutrition_assistant/tests/test_weight_stats.py` with failing tests:

```python
import json
import os
import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient
from unittest.mock import patch

# Ensure we import from the right location
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import weight_tracker
from api import app

client = TestClient(app)


def _write_weight_history(tmp_path, entries):
    """Write a temporary weight_history.json and return its path."""
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
        for i in range(10)  # 10 entries: 7 in range, 3 outside
    ]
    hist_file = _write_weight_history(tmp_path, entries)
    with patch.object(weight_tracker, "HISTORY_FILE", hist_file):
        r = client.get("/weight/stats")
        assert r.status_code == 200
        data = r.json()
        # Last 7 days: weights 80.0, 79.0, 78.0, 77.0, 76.0, 75.0, 74.0 → avg = 77.0
        assert data["entries_count"] == 7
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
```

- [ ] Run tests (they must fail before implementation):

```bash
cd /Users/practica/nutritrack/.worktrees/guia-inteligente && python3 -m pytest nutrition_assistant/tests/test_weight_stats.py -v 2>&1 | tail -20
```

- [ ] Open `nutrition_assistant/api.py`. After the last weight endpoint (around line 1018), add the new endpoint. Note: `load_weight_history` is already available in `api.py` via `from weight_tracker import _load as load_weight_history`. Add the following after the block that ends the weight endpoints:

```python
class WeightStatsResponse(BaseModel):
    weekly_avg: Optional[float]
    entries_count: int


@app.get("/weight/stats", response_model=WeightStatsResponse)
def get_weight_stats():
    """Return the rolling 7-day average weight and count of entries."""
    all_entries = load_weight_history()

    today = date.today()
    cutoff = today - timedelta(days=6)  # today − 6 = 7-day window inclusive

    last_7 = [
        e for e in all_entries
        if cutoff <= date.fromisoformat(e["date"]) <= today
    ]

    if not last_7:
        return WeightStatsResponse(weekly_avg=None, entries_count=0)

    avg = sum(e["weight_kg"] for e in last_7) / len(last_7)
    return WeightStatsResponse(weekly_avg=round(avg, 2), entries_count=len(last_7))
```

Note: `load_weight_history` calls `weight_tracker._load()` which reads from `weight_tracker.HISTORY_FILE`. Patching `weight_tracker.HISTORY_FILE` in tests (via `patch.object`) is what makes the tests isolate correctly.

- [ ] Run tests again — all three must pass:

```bash
cd /Users/practica/nutritrack/.worktrees/guia-inteligente && python3 -m pytest nutrition_assistant/tests/test_weight_stats.py -v 2>&1 | tail -20
```

### Frontend — nutrition_frontend/lib/api.ts

- [ ] Open `nutrition_frontend/lib/api.ts`. Add the `WeightStats` interface and `fetchWeightStats()` function:

```typescript
export interface WeightStats {
  weekly_avg: number | null
  entries_count: number
}

export async function fetchWeightStats(): Promise<WeightStats> {
  return get<WeightStats>("/weight/stats")
}
```

### Frontend — nutrition_frontend/app/progress/page.tsx

- [ ] Open `nutrition_frontend/app/progress/page.tsx`. In the `fetchData` function (or equivalent data-loading block), import and use `fetchWeightStats()` instead of raw `fetch()`. Locate the section that builds `weightChartData` — each element is `{date, weight, trend}`. Replace/extend it so that after fetching `/weight/stats` the weekly average is attached to every data point as a constant reference line:

```typescript
import { fetchProgress, fetchWeightStats } from "@/lib/api"

// Fetch weekly average alongside existing weight history
const [progressData, stats] = await Promise.all([
  fetchProgress(),
  fetchWeightStats().catch(() => ({ weekly_avg: null, entries_count: 0 })),
])
const weeklyAvg = stats.weekly_avg

const weightChartData = progressData.weightHistory.map((entry: { date: string; weight_kg: number; trend?: number }) => ({
  date: entry.date,
  weight: entry.weight_kg,
  trend: entry.trend ?? null,
  weeklyAvg,           // same value on every point → flat reference line
}));
```

- [ ] In the same file, find the `<LineChart>` (or `<ResponsiveContainer>`) that renders the weight chart. Add a third `<Line>` for the weekly average after the existing two lines:

```tsx
<Line
  type="stepAfter"
  dataKey="weeklyAvg"
  name="Media 7 días"
  stroke="#f59e0b"
  strokeWidth={2}
  strokeDasharray="6 3"
  dot={false}
  connectNulls
/>
```

- [ ] Below the chart (or inside the chart card), add the explanatory paragraph:

```tsx
<p className="mt-3 text-center text-sm text-white/60">
  Tu progreso real es tu media, no el dato de hoy
</p>
```

- [ ] Update the chart legend or tooltip as needed so "Media 7 días" label is visible. If a `<Legend>` component is already present, it will auto-pick it up. If not, add:

```tsx
<Legend
  formatter={(value) => (
    <span className="text-white/70 text-xs">{value}</span>
  )}
/>
```

- [ ] Verify the page compiles and renders the three lines in the browser (or via `next build`):

```bash
cd /Users/practica/nutritrack/.worktrees/guia-inteligente && npm run build 2>&1 | tail -30
```

### Commit

- [ ] Stage and commit:

```bash
cd /Users/practica/nutritrack/.worktrees/guia-inteligente && git add nutrition_assistant/api.py nutrition_assistant/tests/test_weight_stats.py nutrition_frontend/lib/api.ts nutrition_frontend/app/progress/page.tsx && git commit -m "feat: weekly weight average endpoint + anti-anxiety chart line"
```

---

## Task 2 — Smart Coach Tips Card

**Files:**
- `nutrition_frontend/app/page.tsx` — add "Consejo de tu Coach IA" card

This task is pure frontend. No backend changes are needed; `steps` and `macros.protein` are already present in `DashboardData`.

### Frontend

- [ ] Open `nutrition_frontend/app/page.tsx`. Confirm that `dashboard.steps`, `dashboard.macros.protein.current`, and `dashboard.macros.protein.target` are already destructured or accessible from the `dashboard` state variable.

- [ ] Add the tip-derivation logic immediately before the JSX return (or inside the component body, after `dashboard` is resolved). This must be pure, side-effect-free code that runs on every render:

```typescript
// --- Smart Coach Tip derivation ---
type TipVariant = "steps" | "protein" | "good";

interface CoachTip {
  variant: TipVariant;
  message: string;
}

function deriveCoachTip(
  steps: number | null,
  proteinCurrent: number,
  proteinTarget: number
): CoachTip {
  if (steps !== null && steps < 5000) {
    return {
      variant: "steps",
      message: "Hoy toca moverse un poco más para mantener el déficit",
    };
  }
  if (proteinTarget > 0 && proteinCurrent / proteinTarget < 0.5) {
    return {
      variant: "protein",
      message:
        "Añade una fuente de proteína en tu próxima comida para proteger tu masa muscular",
    };
  }
  return {
    variant: "good",
    message: "Ritmo perfecto. La clave de estas 8 semanas es la consistencia",
  };
}

const coachTip = dashboard
  ? deriveCoachTip(
      dashboard.steps,
      dashboard.macros.protein.current,
      dashboard.macros.protein.target
    )
  : null;
```

- [ ] Add the icon map using lucide-react. Place this outside the component (module-level constant) to avoid re-creating on each render:

```typescript
import { Lightbulb, Footprints, Beef, TrendingUp } from "lucide-react";

const TIP_ICONS: Record<"steps" | "protein" | "good", React.ElementType> = {
  steps: Footprints,
  protein: Beef,
  good: TrendingUp,
};
```

- [ ] In the JSX, add the Coach Tips card below the last existing dashboard card. Use the established card class pattern:

```tsx
{coachTip && (
  <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6">
    {/* Header */}
    <div className="flex items-center gap-2 mb-3">
      <Lightbulb className="w-5 h-5 text-yellow-400" />
      <h3 className="text-white font-semibold text-sm tracking-wide uppercase">
        Consejo de tu Coach IA
      </h3>
    </div>

    {/* Body */}
    <div className="flex items-start gap-3">
      {(() => {
        const Icon = TIP_ICONS[coachTip.variant];
        return <Icon className="w-6 h-6 text-white/60 mt-0.5 shrink-0" />;
      })()}
      <p className="text-white/80 text-sm leading-relaxed">{coachTip.message}</p>
    </div>
  </div>
)}
```

- [ ] Verify the imports at the top of `nutrition_frontend/app/page.tsx` include all four lucide icons. If some are missing, add them to the existing lucide-react import line.

- [ ] Build to confirm no TypeScript or compilation errors:

```bash
cd /Users/practica/nutritrack/.worktrees/guia-inteligente && npm run build 2>&1 | tail -30
```

### Commit

- [ ] Stage and commit:

```bash
cd /Users/practica/nutritrack/.worktrees/guia-inteligente && git add nutrition_frontend/app/page.tsx && git commit -m "feat: smart coach tips card on dashboard derived from steps and protein"
```

---

## Task 3 — Training Mode Selector (home vs. gym)

**Files:**
- `nutrition_assistant/api.py` — add `training_mode` to `ProfileModel`; apply 0.85 multiplier in dashboard logic
- `nutrition_assistant/tests/test_training_mode.py` — new test file
- `nutrition_frontend/lib/api.ts` — extend `UserProfile` interface; update `fetchSettings` and `updateProfile` mappers
- `nutrition_frontend/app/settings/page.tsx` — add visual toggle

### Backend

- [ ] Create `nutrition_assistant/tests/test_training_mode.py` with failing tests:

```python
import json, os, sys
from unittest.mock import patch
import pytest
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
```

Note: The 4th test (dashboard bonus reduction) is hard to unit-test without a full session mock — it requires a training session to exist on the current day. This is left as manual verification.

- [ ] Run tests (expect failures):

```bash
cd /Users/practica/nutritrack/.worktrees/guia-inteligente && python3 -m pytest nutrition_assistant/tests/test_training_mode.py -v 2>&1 | tail -25
```

- [ ] Open `nutrition_assistant/api.py`. Find `ProfileModel` (around line 139). Add `training_mode` field with default:

```python
class ProfileModel(BaseModel):
    name: str
    gender: str
    age: int
    height_cm: float
    weight_kg: float
    activity_level: str
    goal: str
    week_start_day: str = "monday"
    training_mode: str = "gym"          # <-- add this line
```

- [ ] In the same file, find the dashboard endpoint's `bonus_kcal` computation (around line 1217-1225). The current code reads:

```python
today_tr = session.get("today_training") or {}
ex_adj = ex_data.get("adjustment_kcal", 0) + today_tr.get("bonus_kcal", 0)
```

Replace that block (keep the first line, adjust the second) so that when `training_mode` is `"home"` the bonus is reduced by 15%:

```python
today_tr = session.get("today_training") or {}
_raw_bonus = today_tr.get("bonus_kcal", 0)
_training_mode = profile.get("training_mode", "gym")
_bonus_kcal = round(_raw_bonus * 0.85) if _training_mode == "home" else _raw_bonus
ex_adj = ex_data.get("adjustment_kcal", 0) + _bonus_kcal
```

- [ ] Run tests again — all three must pass:

```bash
cd /Users/practica/nutritrack/.worktrees/guia-inteligente && python3 -m pytest nutrition_assistant/tests/test_training_mode.py -v 2>&1 | tail -25
```

### Frontend — nutrition_frontend/lib/api.ts

- [ ] Open `nutrition_frontend/lib/api.ts`. Find the `UserProfile` interface and add the new field:

```typescript
export interface UserProfile {
  name: string;
  gender: string;
  age: number;
  height: number;
  weight: number;
  activityLevel: string;
  goal: string;
  weekStartDay: string;
  trainingMode: "home" | "gym";   // <-- add this line
}
```

- [ ] In `nutrition_frontend/lib/api.ts`, in `fetchSettings()`, find where `profileRaw` fields are mapped to the `UserProfile` shape. Add the mapping for `trainingMode`:

```typescript
trainingMode: (profileRaw.training_mode as "home" | "gym") ?? "gym",
```

- [ ] In `nutrition_frontend/lib/api.ts`, in `updateProfile()`, find where the `UserProfile` object is serialized back to the API payload. Add:

```typescript
training_mode: profile.trainingMode,
```

### Frontend — nutrition_frontend/app/settings/page.tsx

- [ ] Open `nutrition_frontend/app/settings/page.tsx`. Find the section where the existing profile fields are rendered (name, gender, age, etc.). After the last existing field (or after `weekStartDay` if it exists), add the training mode toggle:

```tsx
{/* Training Mode */}
<div>
  <label className="block text-white/70 text-sm mb-2">Modo de entrenamiento</label>
  <div className="flex gap-3">
    <button
      type="button"
      onClick={() => {
        const next = { ...profile, trainingMode: "home" as const }
        setProfile(next)
        updateProfile(next).then(() => showStatus(true)).catch(() => showStatus(false))
      }}
      className={`flex-1 py-3 rounded-2xl text-sm font-medium transition-all ${
        profile.trainingMode === "home"
          ? "bg-white text-black"
          : "bg-white/10 text-white/70 hover:bg-white/20"
      }`}
    >
      🏠 Casa
    </button>
    <button
      type="button"
      onClick={() => {
        const next = { ...profile, trainingMode: "gym" as const }
        setProfile(next)
        updateProfile(next).then(() => showStatus(true)).catch(() => showStatus(false))
      }}
      className={`flex-1 py-3 rounded-2xl text-sm font-medium transition-all ${
        profile.trainingMode === "gym"
          ? "bg-white text-black"
          : "bg-white/10 text-white/70 hover:bg-white/20"
      }`}
    >
      🏋️ Gimnasio
    </button>
  </div>
</div>
```

- [ ] Verify `profile.trainingMode` is initialised from `fetchSettings()` when the settings page loads, so the correct button appears highlighted on first render. If the settings page initialises `profile` state from a `fetchSettings()` call, this is automatic once the interface and mapper are updated.

- [ ] Build to confirm no TypeScript errors:

```bash
cd /Users/practica/nutritrack/.worktrees/guia-inteligente && npm run build 2>&1 | tail -30
```

### Commit

- [ ] Stage and commit:

```bash
cd /Users/practica/nutritrack/.worktrees/guia-inteligente && git add nutrition_assistant/api.py nutrition_assistant/tests/test_training_mode.py nutrition_frontend/lib/api.ts nutrition_frontend/app/settings/page.tsx && git commit -m "feat: home/gym training mode selector with 0.85 bonus_kcal multiplier"
```

---

## Summary

| # | Task | Backend files | Frontend files | Tests |
|---|------|--------------|----------------|-------|
| 1 | Weekly weight average | `api.py` (+endpoint) | `nutrition_frontend/lib/api.ts`, `nutrition_frontend/app/progress/page.tsx` | `test_weight_stats.py` (3 cases) |
| 2 | Smart coach tips card | — | `nutrition_frontend/app/page.tsx` | — (pure derivation logic) |
| 3 | Training mode selector | `api.py` (+field, +multiplier) | `nutrition_frontend/lib/api.ts`, `nutrition_frontend/app/settings/page.tsx` | `test_training_mode.py` (3 cases) |

Each task ends with a standalone commit. Tasks 1 and 3 follow strict TDD order (failing test → implementation → green test → commit). Task 2 has no backend and no unit test surface beyond the build check.
