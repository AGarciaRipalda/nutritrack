# NutriTrack — Daily Diet & Weekly Plan Synchronization

**Date:** 2026-03-19
**Status:** Approved

## Problem

The daily diet page and weekly plan page are completely disconnected. Both generate meals independently from the same meal pool, resulting in:
- Today's meals never matching the weekly plan for the current weekday
- No date awareness (daily diet doesn't know what day of the week it is)
- Meal swaps in daily view not updating the weekly plan
- No "Regenerate weekly plan" button in the UI (endpoint exists but not connected)
- Calorie target mismatch: daily uses exercise-adaptive targets, weekly uses a fixed target
- Inconsistent data models (`description`+`tip` vs `text`+`note`)

## Goal

Make the weekly plan the single source of truth. Today's diet shows the current weekday's slot from the weekly plan, with daily exercise adjustments applied on top. Both sections reflect the same data.

## Architecture

### Two levels of adaptation

1. **Weekly** — the base weekly plan is recalculated each week using the previous week's history (adherence, cumulative exercise, weight delta). This reflects real nutritionist practice: weekly plan review based on actual progress.

2. **Daily** — on top of the base plan, exercise adjustments for a specific day modify portions (same dishes, scaled quantities). Both the daily view and weekly view consume: `base_meals + exercise_adj[date]`.

### Data flow

```
PREVIOUS WEEK HISTORY
  └── cumulative exercise kcal
  └── recorded intake / adherence
  └── weight evolution
          │
          ▼
    generate_week_plan()       ← recalculates each week with history
    (adjusts kcal/macro target
     based on actual progress)
          │
          ▼
      week_plan                ← single source of truth
          │
          ├── [2026-03-17 Mon] base_meals (kcal adjusted to new weekly target)
          ├── [2026-03-18 Tue] base_meals + exercise_adj
          ├── ...
          └── [2026-03-23 Sun] base_meals
                  │
        ┌─────────┴──────────┐
        ▼                    ▼
  /diet/today          /diet/weekly
  (current day slot    (full week with
   + exercise_adj)      daily adjustments
                        + today marker)
```

## Data Models

### Unified `Meal` model

```typescript
// BEFORE — two incompatible models
// Daily:  { id, type, name, kcal, description, tip, timingNote }
// Weekly: { text, kcal, note }

// AFTER — single model
interface Meal {
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

### `PlanDay` model

```typescript
interface PlanDay {
  date: string          // "2026-03-17" — real date, not just "Monday"
  dayName: string       // "Lunes"
  meals: Meal[]
  totalKcal: number     // base sum
  exerciseAdj?: {
    extraKcal: number
    source: string      // "Running 45min"
    adjustedTotal: number
  }
  isToday: boolean      // computed in frontend
}
```

**Key change:** Days keyed by real date (`"2026-03-17"`) instead of day name (`"Lunes"`). This trivially solves today's concordance and handles mid-week regeneration correctly.

### Session storage

```python
session = {
    "week_plan": {
        "days": [...],            # base meals (PlanDay[])
        "generated_at": date,     # week this belongs to
        "weekly_target_kcal": n,  # recalculated with history
        "weekly_summary": {       # previous week summary used
            "avg_adherence": 0.82,
            "total_exercise_kcal": 1540,
            "weight_delta": -0.4
        }
    },
    "exercise_adj": {             # NEW — per-day adjustments
        "2026-03-18": { "extra_kcal": 320, "source": "running 45min" },
        "2026-03-19": { "extra_kcal": 0 }
    },
    "weekly_history": [...]       # NEW — previous weeks history
}
```

## Backend Changes

| Function | Change |
|----------|--------|
| `generate_week_plan()` | Receives previous week history, recalculates kcal/macro target before assigning meals |
| `generate_adaptive_day()` | **Removed** — replaced by `get_day_from_plan(date)` |
| `get_day_from_plan(date)` | **New** — returns meals for the day + applies `exercise_adj[date]` if exists |
| `/diet/today` | Calls `get_day_from_plan(today)` instead of `generate_adaptive_day()` |
| `/diet/weekly/regenerate` | Now receives `apply_from` ("today" or "tomorrow"), regenerates with history |

### Regeneration rule

```
If apply_from == "today":
    week_plan[today...sunday] = new_plan[today...sunday]
    exercise_adj[today] is preserved

If apply_from == "tomorrow":
    week_plan[tomorrow...sunday] = new_plan[tomorrow...sunday]
    week_plan[today] unchanged
```

## Frontend Changes

### `diet/page.tsx` — Today's Diet

| Change | Detail |
|--------|--------|
| Remove independent `fetchTodaysDiet()` | Now reads from weekly plan via `get_day_from_plan` |
| Add exercise adjustment badge | If `exercise_adj > 0`: badge "⚡ +320 kcal · portions increased" in header |
| Show which plan day today is | Subtitle "Monday, week of Mar 17" so user knows where the menu comes from |
| Remove "Regenerate diet" button | Replaced by "View full plan →" link |
| Keep "Swap dish" | Still works, but now updates the current day's slot in `week_plan` |

### `weekly-plan/page.tsx` — Weekly Plan

| Change | Detail |
|--------|--------|
| Visually mark current day | Today has distinct style (border, color, "TODAY" badge) |
| Show exercise indicator per day | Days with `exercise_adj > 0` show "⚡ +Xkcal" next to day total |
| Add "Regenerate weekly plan" button | Connects to existing endpoint, opens confirmation modal |
| Regeneration confirmation modal | "Apply from today or tomorrow?" with summary of history used |
| Show adaptive summary | Small section: "Plan adjusted for: -0.4kg last week · 1,540 kcal exercise" |

### Regeneration modal

```
┌─────────────────────────────────────────┐
│  Regenerate weekly plan                 │
│                                         │
│  Based on your previous week:           │
│  · Adherence: 82%                       │
│  · Cumulative exercise: 1,540 kcal      │
│  · Weight: -0.4 kg                      │
│                                         │
│  Apply new plan from:                   │
│  ○ Today (replaces today's menu)        │
│  ○ Tomorrow (keeps today intact)        │
│                                         │
│         [Cancel]  [Regenerate]          │
└─────────────────────────────────────────┘
```

## Edge Cases

| Case | Behavior |
|------|---------|
| No weekly plan yet | `/diet/today` auto-generates the weekly plan first (first time) |
| Plan is from last week | Backend detects stale `generated_at`, prompts regeneration with accumulated history |
| User regenerates mid-week | Only days from chosen date onward are replaced — past days preserved as history |
| No previous week data (new user) | `generate_week_plan()` uses only user profile, no history bonus/penalty |
| Exercise logged but no plan | Plan is created first, then adjustment applied |
| "Swap dish" in today's diet | Updates current day's slot in `week_plan` + preserves `exercise_adj` |
| Network failure during regeneration | Modal shows error, previous plan remains intact |
