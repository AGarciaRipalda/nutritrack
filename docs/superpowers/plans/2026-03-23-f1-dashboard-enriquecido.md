# F1 — Dashboard Enriquecido Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich the diet page and dashboard with bonus exercise kcal display, per-macro compliance progress bars, and quick-action navigation buttons on each alert.

**Architecture:** All three tasks are purely frontend. `bonus_kcal` is already returned by `GET /exercise/today-training` (used via `fetchTraining()`) and also present in the dashboard session as `today_training.bonus_kcal`; a targeted extra fetch from the diet page is the cleanest approach. Macro progress bars derive from existing `state.derived` in `DietDayContext`. Alert navigation maps backend alert types to routes using a static dictionary.

**Tech Stack:** Next.js 15 App Router, React, Tailwind CSS, lucide-react, `next/navigation` (`useRouter`).

---

## Files Modified/Created

- `nutrition_frontend/app/diet/page.tsx` — capture and show `bonus_kcal` chip, add macro progress bars (Tasks 1, 2)
- `nutrition_frontend/app/page.tsx` — show bonus badge on dashboard, add macro compliance summary, add quick-action buttons to alerts (Tasks 1, 2, 3)

---

### Task 1: Bonus kcal Visible

**Files:**
- Modify: `nutrition_frontend/app/diet/page.tsx`
- Modify: `nutrition_frontend/app/page.tsx`

**Pre-task audit:** The `fetchTraining()` function already fetches `/exercise/today-training` which returns `{ bonus_kcal, training_type }`. The diet page currently does NOT call `fetchTraining()`. The backend `GET /dashboard` response includes `today_training.bonus_kcal` in the raw payload but it is NOT mapped in `fetchDashboard()`. The quickest approach: add a separate `GET /exercise/today-training` call in the diet page, and expose `bonus_kcal` via `fetchDashboard` mapper.

- [ ] Step 1: In `nutrition_frontend/app/diet/page.tsx`, add a `bonusKcal` state and fetch it:

  1. Add import: `import { fetchTodaysPlan, swapMeal, updateAdherence, fetchFavoriteCarbs, searchFood, get } from "@/lib/api"` — actually use the existing `get` helper by importing it, or more cleanly: add a new dedicated function. The simplest approach is to add `fetchTodayBonusKcal` inline. In `lib/api.ts`, add:

  ```typescript
  export async function fetchTodayBonusKcal(): Promise<number> {
    const d = await get<{ bonus_kcal: number; training_type: string | null }>("/exercise/today-training")
    return d.bonus_kcal ?? 0
  }
  ```

  2. In `nutrition_frontend/app/diet/page.tsx`, add state: `const [bonusKcal, setBonusKcal] = useState(0)`

  3. In the existing `useEffect` that calls `Promise.all([fetchTodaysPlan(), fetchFavoriteCarbs()])`, add `fetchTodayBonusKcal()` to the parallel array:

  ```typescript
  Promise.all([fetchTodaysPlan(), fetchFavoriteCarbs(), fetchTodayBonusKcal()])
    .then(([d, carbs, bonus]) => {
      setBonusKcal(bonus)
      // ... rest of existing logic unchanged
    })
  ```

  4. In the JSX, add a chip below the existing `{day.exerciseAdj && ...}` block inside the header card (around line 232), right after the ⚡ exercise adjustment line:

  ```tsx
  {bonusKcal > 0 && (
    <p className="text-emerald-300 text-sm mt-1">
      ＋{bonusKcal} kcal por entrenamiento de hoy
    </p>
  )}
  ```

- [ ] Step 2: In `nutrition_frontend/lib/api.ts`, update `DashboardData` interface and `fetchDashboard()` to expose `bonusKcal`:

  Add field to `DashboardData`:
  ```typescript
  bonusKcal: number   // today's training bonus (0 if none)
  ```

  In `fetchDashboard()`, after the existing `today_training` handling:
  ```typescript
  bonusKcal: d.today_training?.bonus_kcal ?? 0,
  ```

- [ ] Step 3: In `nutrition_frontend/app/page.tsx`, inside the "Calorías del día" card (around line 306), add a chip below the calorie counts:

  ```tsx
  {dashboard.bonusKcal > 0 && (
    <div className="flex items-center gap-1.5 mt-2">
      <Zap className="h-3.5 w-3.5 text-emerald-400" />
      <span className="text-emerald-300 text-xs font-medium">
        +{dashboard.bonusKcal} kcal por entrenamiento
      </span>
    </div>
  )}
  ```

  Add `Zap` to the lucide-react import at the top.

- [ ] Step 4: Manual verification:
  1. Start both servers.
  2. Log today's training via `/training` page.
  3. Navigate to `/diet` — check for "+ N kcal por entrenamiento de hoy" below the header.
  4. Navigate to `/` (dashboard) — check for chip in the "Calorías del día" card.
  5. If no training logged today: both chips should be invisible.

- [ ] Step 5: Commit:
  ```bash
  cd /Users/practica/nutritrack
  git add nutrition_frontend/lib/api.ts nutrition_frontend/app/diet/page.tsx nutrition_frontend/app/page.tsx
  git commit -m "feat: show today's exercise bonus kcal on diet page and dashboard"
  ```

---

### Task 2: Macro Compliance Progress Bars

**Files:**
- Modify: `nutrition_frontend/app/diet/page.tsx`
- Modify: `nutrition_frontend/app/page.tsx`

**Pre-task audit:** In `diet/page.tsx`, macro targets come from `state.derived` (the `DietDayContext`). The context exposes `derived.macroTargets` (protein_g, carb_g, fat_g) and the consumed totals are tracked in `state.consumed` or via `adherence.consumedKcal`. For simplicity, compute % from the existing `state.derived` which already aggregates today's plan.

- [ ] Step 1: In `nutrition_frontend/app/diet/page.tsx`, locate the macro summary section. Add a `MacroBar` helper component at the top of the file (before `DietPage`):

  ```tsx
  function MacroBar({ label, current, target, color }: {
    label: string
    current: number
    target: number
    color: string
  }) {
    const pct = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0
    const barColor =
      pct >= 90 ? "from-emerald-400 to-emerald-600" :
      pct >= 70 ? "from-amber-400 to-amber-600" :
                  "from-red-400 to-red-600"
    const textColor =
      pct >= 90 ? "text-emerald-400" :
      pct >= 70 ? "text-amber-400" :
                  "text-red-400"
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/60">{label}</span>
          <span className={`font-semibold ${textColor}`}>{pct}%</span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-1.5">
          <div
            className={`bg-gradient-to-r ${barColor} h-1.5 rounded-full transition-all duration-500`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-white/40 text-xs text-right">{current}g / {target}g</p>
      </div>
    )
  }
  ```

- [ ] Step 2: In `diet/page.tsx`, locate where the macro donut or macro summary is rendered (the section with `state.derived.macroTargets`). Add macro bars below it using consumed values from the diet context. The context `state.derived` has `macroTargets.protein_g`, `macroTargets.carb_g`, `macroTargets.fat_g`. For consumed, use `state.consumed.protein ?? 0` etc. (check actual field names in `DietDayContext`).

  Add after the macro donut section:
  ```tsx
  {state.derived.macroTargets && (
    <div className="mt-4 space-y-3">
      <p className="text-white/50 text-xs font-medium uppercase tracking-wide">Cumplimiento de macros</p>
      <MacroBar
        label="Proteína"
        current={Math.round(state.consumed?.protein ?? 0)}
        target={state.derived.macroTargets.protein_g}
        color="red"
      />
      <MacroBar
        label="Carbohidratos"
        current={Math.round(state.consumed?.carbs ?? 0)}
        target={state.derived.macroTargets.carb_g}
        color="amber"
      />
      <MacroBar
        label="Grasas"
        current={Math.round(state.consumed?.fat ?? 0)}
        target={state.derived.macroTargets.fat_g}
        color="blue"
      />
    </div>
  )}
  ```

  **Note:** First read `DietDayContext.tsx` to confirm the exact field names for consumed macros in `state.consumed` or `state.derived`. Adjust the field access accordingly.

- [ ] Step 3: In `nutrition_frontend/app/page.tsx`, locate the macros card (around line 331, the "Distribución de macros" card). Below the existing `<div className="space-y-3">` with protein/carbs/fat text lines, add three compact progress bars using the same `MacroBar` component (copy it or import it):

  ```tsx
  <div className="mt-4 space-y-2 border-t border-white/10 pt-3">
    {[
      { label: "Proteína", current: dashboard.macros.protein.current, target: dashboard.macros.protein.target },
      { label: "Carbos",   current: dashboard.macros.carbs.current,   target: dashboard.macros.carbs.target },
      { label: "Grasas",   current: dashboard.macros.fat.current,     target: dashboard.macros.fat.target },
    ].map(({ label, current, target }) => {
      const pct = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0
      const barColor = pct >= 90 ? "bg-emerald-400" : pct >= 70 ? "bg-amber-400" : "bg-red-400"
      return (
        <div key={label} className="space-y-0.5">
          <div className="flex justify-between text-xs">
            <span className="text-white/50">{label}</span>
            <span className={pct >= 90 ? "text-emerald-400" : pct >= 70 ? "text-amber-400" : "text-red-400"}>
              {pct}%
            </span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-1">
            <div className={`${barColor} h-1 rounded-full`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )
    })}
  </div>
  ```

- [ ] Step 4: Manual verification:
  1. Open `/diet` — the macro bars section should appear below the existing macro donut or summary. With no meals checked: all bars red at 0%. Check some meals and verify bars update.
  2. Open `/` — macro bars appear below the protein/carbs/fat lines in the macros card.
  3. Color logic: mark enough meals to reach 90%+ on protein → bar should turn green.

- [ ] Step 5: Commit:
  ```bash
  cd /Users/practica/nutritrack
  git add nutrition_frontend/app/diet/page.tsx nutrition_frontend/app/page.tsx
  git commit -m "feat: add per-macro compliance progress bars to diet page and dashboard"
  ```

---

### Task 3: Quick Action Buttons on Alerts

**Files:**
- Modify: `nutrition_frontend/app/page.tsx`

**Pre-task audit:** The dashboard's alerts array uses type strings from the backend: `weigh_in`, `survey`, `weekly_report`, `event`. The frontend transforms them with `.replace("_", "-")` producing `weigh-in`, `survey`, `weekly-report`, `event`. The alert rendering loop is at lines 450–471 in `page.tsx`. There is no separate `AlertCard` component — alerts are rendered inline.

- [ ] Step 1: Add `useRouter` import and define the alert-to-route map. In `nutrition_frontend/app/page.tsx`:

  Add to imports:
  ```typescript
  import { useRouter } from "next/navigation"
  ```

  Inside `DashboardPage`, after `const { record, ... } = useCheatDay()`:
  ```typescript
  const router = useRouter()

  const alertRoutes: Record<string, string> = {
    "weigh-in":     "/progress",
    "survey":       "/report",
    "weekly-report": "/report",
    "weekly_report": "/report",
    "event":        "/weekly-plan",
  }
  ```

- [ ] Step 2: In the alert rendering loop (around line 452), add a "Ir ahora" button to each alert that has a route defined:

  Replace the alert `div` contents:
  ```tsx
  {dashboard.alerts.map((alert) => {
    const AlertIcon = getAlertIcon(alert.type)
    const route = alertRoutes[alert.type]
    return (
      <div
        key={alert.id}
        className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-all duration-300"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${getAlertColor(alert.type)}`}>
            <AlertIcon className="h-5 w-5" />
          </div>
          <span className="text-white">{alert.message}</span>
        </div>
        <div className="flex items-center gap-2">
          {alert.dueDate && (
            <Badge className="bg-white/10 text-white/80 border-white/20">
              {new Date(alert.dueDate).toLocaleDateString()}
            </Badge>
          )}
          {route && (
            <button
              onClick={() => router.push(route)}
              className="px-3 py-1.5 text-xs font-medium bg-white/10 hover:bg-white/20 text-white/80 hover:text-white rounded-lg border border-white/10 transition-colors"
            >
              Ir ahora →
            </button>
          )}
        </div>
      </div>
    )
  })}
  ```

- [ ] Step 3: Manual verification:
  1. Ensure the backend returns at least one alert (e.g., log no weight this week to trigger `weigh_in`).
  2. Open dashboard. Each alert should show an "Ir ahora →" button on the right side.
  3. Click "Ir ahora →" on the weight alert — should navigate to `/progress`.
  4. Click on the survey alert — should navigate to `/report`.
  5. Alerts without a mapped route (e.g., `event` with future date only) should still render; verify the `event` type routes to `/weekly-plan` or add a sensible fallback.

- [ ] Step 4: Commit:
  ```bash
  cd /Users/practica/nutritrack
  git add nutrition_frontend/app/page.tsx
  git commit -m "feat: add quick-action navigation buttons to dashboard alerts"
  ```
