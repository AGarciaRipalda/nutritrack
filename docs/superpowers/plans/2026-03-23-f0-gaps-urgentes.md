# F0 — Gaps Urgentes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the two critical gaps — show active compensation periods on the dashboard and persist cheat day state to the backend.

**Architecture:** Task 1 reads the already-computed `compensation` array from `CheatDayContext` and renders a banner in the dashboard page; no new data fetching is required. Task 2 adds two FastAPI endpoints backed by `cheatday_history.json`, adds matching API functions to `lib/api.ts`, and upgrades `CheatDayContext` to a backend-first sync model with localStorage as offline cache and a one-time migration path.

**Tech Stack:** Next.js 15 App Router, React Context, Tailwind CSS, FastAPI, Pydantic, JSON file storage.

---

## Files Modified/Created

- `nutrition_frontend/app/page.tsx` — add compensation banner (Task 1)
- `nutrition_assistant/api.py` — add `POST /cheatday` and `GET /cheatday` endpoints (Task 2)
- `nutrition_frontend/lib/api.ts` — add `saveCheatDay()` and `getCheatDays()` (Task 2)
- `nutrition_frontend/context/CheatDayContext.tsx` — sync with backend on mount and on every change (Task 2)

---

### Task 1: Compensation Banner on Dashboard

**Files:**
- Modify: `nutrition_frontend/app/page.tsx`

- [ ] Step 1: Understand the existing `record` shape from `CheatDayContext`. The context already exposes `record: CheatDayRecord | null` where `record.compensating: boolean` and `record.compensation: CompensationEntry[]` (each entry has `{ date: string; reduction: number }`). No new data fetching needed.

- [ ] Step 2: In `nutrition_frontend/app/page.tsx`, after the existing "comodín activo" display block (around line 96), add a compensation banner that renders when `record?.compensating && record.compensation.length > 0`. The banner should compute:
  - `today` = `new Date().toISOString().slice(0, 10)`
  - `activeEntries` = `record.compensation.filter(c => c.date >= today)`
  - `daysRemaining` = `activeEntries.length`
  - `extraDeficitPerDay` = `activeEntries[0]?.reduction ?? 0`
  - `endDate` = `activeEntries.at(-1)?.date`

  Add the following JSX immediately after the "Comodín activo hoy" block (after line 100, inside the same `flex items-center gap-3 flex-wrap` container, or as a separate Card below the header card):

  ```tsx
  {record?.compensating && (() => {
    const today = new Date().toISOString().slice(0, 10)
    const activeEntries = record.compensation.filter(c => c.date >= today)
    if (activeEntries.length === 0) return null
    const daysRemaining = activeEntries.length
    const extraDeficit = activeEntries[0]?.reduction ?? 0
    const endDate = activeEntries.at(-1)?.date ?? ""
    return (
      <Card className="backdrop-blur-xl bg-orange-500/10 border border-orange-400/30 rounded-3xl p-5">
        <div className="flex items-start gap-3">
          <ArrowDown className="h-5 w-5 text-orange-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-orange-300 font-semibold text-sm">Compensación activa</p>
            <p className="text-white/70 text-sm mt-1">
              {daysRemaining} {daysRemaining === 1 ? "día restante" : "días restantes"} ·{" "}
              -{extraDeficit} kcal/día · hasta el {endDate}
            </p>
          </div>
        </div>
      </Card>
    )
  })()}
  ```

  Place this new Card in the `space-y-6` container, immediately after the header Card (after the `</Card>` that closes the comodín confirmation modal section, around line 133).

- [ ] Step 3: Verify manually by opening the dashboard:
  - In browser console, run: `localStorage.setItem('nutritrack_cheatday_' + (() => { const d = new Date(); const day = d.getDay(); d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day)); return d.toISOString().slice(0,10); })(), JSON.stringify({ date: new Date().toISOString().slice(0,10), weekStart: (() => { const d = new Date(); const day = d.getDay(); d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day)); return d.toISOString().slice(0,10); })(), active: true, excess: 600, compensating: true, compensation: [{ date: (() => { const d = new Date(); d.setDate(d.getDate()+1); return d.toISOString().slice(0,10); })(), reduction: 200 }, { date: (() => { const d = new Date(); d.setDate(d.getDate()+2); return d.toISOString().slice(0,10); })(), reduction: 200 }, { date: (() => { const d = new Date(); d.setDate(d.getDate()+3); return d.toISOString().slice(0,10); })(), reduction: 200 }]}))`
  - Reload. Expected: orange "Compensación activa" banner visible with "3 días restantes · -200 kcal/día".
  - Set `compensating: false` in localStorage, reload. Expected: banner not visible.

- [ ] Step 4: Commit:
  ```bash
  cd /Users/practica/nutritrack
  git add nutrition_frontend/app/page.tsx
  git commit -m "feat: show active compensation banner on dashboard"
  ```

---

### Task 2: CheatDay Backend Sync

**Files:**
- Modify: `nutrition_assistant/api.py`
- Modify: `nutrition_frontend/lib/api.ts`
- Modify: `nutrition_frontend/context/CheatDayContext.tsx`

#### Sub-task 2a: Backend endpoints

- [ ] Step 1: Write a failing pytest for the new endpoints. Create/append to `nutrition_assistant/tests/test_api.py`:

  ```python
  def test_post_and_get_cheatday(tmp_path):
      import adherence  # ensure imports don't break
      from unittest.mock import patch
      import json, os

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
  ```

- [ ] Step 2: Run the test, confirm it fails:
  ```bash
  cd /Users/practica/nutritrack/nutrition_assistant
  python -m pytest tests/test_api.py::test_post_and_get_cheatday -v
  ```
  Expected output: `FAILED` with `404` or `AttributeError: module 'api' has no attribute 'CHEATDAY_FILE'`.

- [ ] Step 3: Add to `nutrition_assistant/api.py` after the existing imports and before the app definition (around line 73):

  ```python
  from data_dir import DATA_DIR

  CHEATDAY_FILE = DATA_DIR / "cheatday_history.json"

  def _load_cheatdays() -> list:
      if not os.path.exists(CHEATDAY_FILE):
          return []
      with open(CHEATDAY_FILE, "r", encoding="utf-8") as f:
          return json.load(f)

  def _save_cheatdays(records: list) -> None:
      with open(CHEATDAY_FILE, "w", encoding="utf-8") as f:
          json.dump(records, f, indent=2, ensure_ascii=False)
  ```

  Then add the Pydantic model and endpoints (place before or after the `/food/search` endpoint, around line 1560):

  ```python
  # ══════════════════════════════════════════════════════════════════════════════
  # CHEAT DAY SYNC
  # ══════════════════════════════════════════════════════════════════════════════

  class CompensationEntryModel(BaseModel):
      date: str
      extra_deficit: int

  class CheatDayRecordModel(BaseModel):
      id: str
      date: str
      weekStart: str
      active: bool
      excess: int
      compensating: bool
      compensation: list[CompensationEntryModel]

  @app.post("/cheatday", tags=["Comodín"])
  def save_cheat_day(record: CheatDayRecordModel):
      """Persiste o actualiza un registro de comodín."""
      records = _load_cheatdays()
      # Upsert: replace existing record with same id
      records = [r for r in records if r.get("id") != record.id]
      records.append(record.model_dump())
      _save_cheatdays(records)
      return {"ok": True}

  @app.get("/cheatday", tags=["Comodín"])
  def get_cheat_days():
      """Devuelve el historial de comodines."""
      return {"records": _load_cheatdays()}
  ```

- [ ] Step 4: Run the test, confirm it passes:
  ```bash
  cd /Users/practica/nutritrack/nutrition_assistant
  python -m pytest tests/test_api.py::test_post_and_get_cheatday -v
  ```
  Expected output: `PASSED`.

#### Sub-task 2b: Frontend API functions

- [ ] Step 5: Add the following to `nutrition_frontend/lib/api.ts` after the `searchFood` function (end of file):

  ```typescript
  // ── CheatDay Sync ─────────────────────────────────────────────────────────

  export interface CheatDayRecordAPI {
    id: string
    date: string
    weekStart: string
    active: boolean
    excess: number
    compensating: boolean
    compensation: { date: string; extra_deficit: number }[]
  }

  export async function saveCheatDay(record: CheatDayRecordAPI): Promise<void> {
    await post<{ ok: boolean }>("/cheatday", record)
  }

  export async function getCheatDays(): Promise<CheatDayRecordAPI[]> {
    const d = await get<{ records: CheatDayRecordAPI[] }>("/cheatday")
    return d.records
  }
  ```

#### Sub-task 2c: Upgrade CheatDayContext

- [ ] Step 6: Update `nutrition_frontend/context/CheatDayContext.tsx` to use backend sync. Replace the entire file with the following (key changes: add `useEffect` for mount sync, update `persist` to also call `saveCheatDay`, add migration logic):

  ```typescript
  "use client"

  import {
    createContext, useContext, useState, useEffect,
    useCallback, type ReactNode,
  } from "react"
  import { saveCheatDay, getCheatDays, type CheatDayRecordAPI } from "@/lib/api"

  // ── Helpers ────────────────────────────────────────────────────────────────

  function getMonday(dateStr: string): string {
    const d   = new Date(dateStr + "T00:00:00")
    const day = d.getDay()
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
    return d.toISOString().slice(0, 10)
  }

  const lsKey = (weekStart: string) => `nutritrack_cheatday_${weekStart}`

  // ── Types ──────────────────────────────────────────────────────────────────

  export interface CompensationEntry { date: string; reduction: number }

  export interface CheatDayRecord {
    date:         string
    weekStart:    string
    active:       boolean
    excess:       number
    compensating: boolean
    compensation: CompensationEntry[]
  }

  interface CheatDayContextValue {
    record:                  CheatDayRecord | null
    isCheatDay:              (date: string) => boolean
    isWeeklyLimitReached:    (date: string) => boolean
    activateCheatDay:        (date: string) => void
    finalizeExcess:          (excess: number) => void
    setupCompensation:       (fromDate: string) => void
    declineCompensation:     () => void
    getCompensationReduction:(date: string) => number
  }

  // ── Provider ───────────────────────────────────────────────────────────────

  const Ctx = createContext<CheatDayContextValue | null>(null)

  function toAPIRecord(rec: CheatDayRecord): CheatDayRecordAPI {
    return {
      id:           rec.date,
      date:         rec.date,
      weekStart:    rec.weekStart,
      active:       rec.active,
      excess:       rec.excess,
      compensating: rec.compensating,
      compensation: rec.compensation.map(c => ({
        date:         c.date,
        extra_deficit: c.reduction,
      })),
    }
  }

  function fromAPIRecord(r: CheatDayRecordAPI): CheatDayRecord {
    return {
      date:         r.date,
      weekStart:    r.weekStart,
      active:       r.active,
      excess:       r.excess,
      compensating: r.compensating,
      compensation: r.compensation.map(c => ({
        date:      c.date,
        reduction: c.extra_deficit,
      })),
    }
  }

  function loadFromLocalStorage(): CheatDayRecord | null {
    if (typeof window === "undefined") return null
    const today     = new Date().toISOString().slice(0, 10)
    const weekStart = getMonday(today)
    try {
      const raw = localStorage.getItem(lsKey(weekStart))
      return raw ? (JSON.parse(raw) as CheatDayRecord) : null
    } catch { return null }
  }

  export function CheatDayProvider({ children }: { children: ReactNode }) {
    const [record, setRecord] = useState<CheatDayRecord | null>(loadFromLocalStorage)

    // Sync with backend on mount
    useEffect(() => {
      getCheatDays()
        .then((backendRecords) => {
          if (backendRecords.length > 0) {
            // Backend wins — find record for current week
            const today     = new Date().toISOString().slice(0, 10)
            const weekStart = getMonday(today)
            const thisWeek  = backendRecords.find(r => r.weekStart === weekStart)
            if (thisWeek) {
              const rec = fromAPIRecord(thisWeek)
              setRecord(rec)
              try { localStorage.setItem(lsKey(rec.weekStart), JSON.stringify(rec)) } catch {}
            }
          } else {
            // Backend empty — migrate localStorage data if present
            const lsRecord = loadFromLocalStorage()
            if (lsRecord) {
              saveCheatDay(toAPIRecord(lsRecord)).catch(console.error)
            }
          }
        })
        .catch(console.error)
    }, [])

    const persist = useCallback((rec: CheatDayRecord) => {
      setRecord(rec)
      try { localStorage.setItem(lsKey(rec.weekStart), JSON.stringify(rec)) } catch {}
      saveCheatDay(toAPIRecord(rec)).catch(console.error)
    }, [])

    const isWeeklyLimitReached = useCallback((date: string) => {
      if (typeof window === "undefined") return false
      try { return !!localStorage.getItem(lsKey(getMonday(date))) } catch { return false }
    }, [])

    const isCheatDay = useCallback(
      (date: string) => record?.date === date && record.active,
      [record],
    )

    const activateCheatDay = useCallback((date: string) => {
      persist({ date, weekStart: getMonday(date), active: true, excess: 0, compensating: false, compensation: [] })
    }, [persist])

    const finalizeExcess = useCallback((excess: number) => {
      if (!record) return
      persist({ ...record, excess })
    }, [record, persist])

    const setupCompensation = useCallback((fromDate: string) => {
      if (!record) return
      const perDay = Math.round(record.excess / 3)
      const entries: CompensationEntry[] = []
      const d = new Date(fromDate + "T00:00:00")
      for (let i = 0; i < 3; i++) {
        d.setDate(d.getDate() + 1)
        entries.push({ date: d.toISOString().slice(0, 10), reduction: perDay })
      }
      persist({ ...record, compensating: true, compensation: entries })
    }, [record, persist])

    const declineCompensation = useCallback(() => {
      if (!record) return
      persist({ ...record, compensating: false, compensation: [] })
    }, [record, persist])

    const getCompensationReduction = useCallback((date: string) => {
      if (!record?.compensating) return 0
      return record.compensation.find((c) => c.date === date)?.reduction ?? 0
    }, [record])

    return (
      <Ctx.Provider value={{
        record, isCheatDay, isWeeklyLimitReached,
        activateCheatDay, finalizeExcess, setupCompensation,
        declineCompensation, getCompensationReduction,
      }}>
        {children}
      </Ctx.Provider>
    )
  }

  export function useCheatDay() {
    const ctx = useContext(Ctx)
    if (!ctx) throw new Error("useCheatDay must be used within CheatDayProvider")
    return ctx
  }
  ```

- [ ] Step 7: Manual verification:
  1. Start backend: `cd /Users/practica/nutritrack/nutrition_assistant && uvicorn api:app --reload`
  2. Start frontend: `cd /Users/practica/nutritrack/nutrition_frontend && npm run dev`
  3. Open dashboard, activate comodín. Check backend: `curl http://localhost:8000/cheatday` — should return the record.
  4. Reload the page. State should be restored from backend without re-activating.
  5. Verify `cheatday_history.json` was created in `nutrition_assistant/`.

- [ ] Step 8: Commit:
  ```bash
  cd /Users/practica/nutritrack
  git add nutrition_assistant/api.py nutrition_frontend/lib/api.ts nutrition_frontend/context/CheatDayContext.tsx
  git commit -m "feat: persist cheat day state to backend with localStorage fallback"
  ```
