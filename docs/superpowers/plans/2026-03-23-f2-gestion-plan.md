# F2 — Gestión del Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve plan management with a stale-plan banner in the diet page, a regenerate button with confirmation on the weekly plan page, and a PDF report archive system.

**Architecture:** Tasks 1 and 2 are pure frontend — both pages already fetch the `stale` flag and have `regenerateWeeklyPlan()` available. Task 3 adds backend logic to save PDFs to a `reports/` directory on generation, adds two new GET endpoints, and adds a frontend report history section. The `report/download` endpoint currently writes to a temp file; it must instead write to a persistent directory and return the file from there.

**Tech Stack:** Next.js 15 App Router, React, Tailwind CSS, FastAPI, Python `pathlib`, `os`, `datetime`.

---

## Files Modified/Created

- `nutrition_frontend/app/diet/page.tsx` — upgrade stale banner with regenerate button (Task 1)
- `nutrition_frontend/app/weekly-plan/page.tsx` — no changes needed (regenerate already implemented; Task 2 is doc-only verification)
- `nutrition_assistant/api.py` — modify `GET /report/download` to archive, add `GET /reports`, `GET /reports/{filename}` (Task 3)
- `nutrition_frontend/lib/api.ts` — add `getReportsList()` (Task 3)
- `nutrition_frontend/app/report/page.tsx` — add "Reportes anteriores" section (Task 3)

---

### Task 1: Stale Plan Banner in Diet Page

**Files:**
- Modify: `nutrition_frontend/app/diet/page.tsx`

**Pre-task audit:** The diet page already reads the `stale` flag (line 50: `const [stale, setStale] = useState(false)`) and already shows a basic banner at line 210:
```tsx
{stale && (
  <div className="bg-amber-500/20 border border-amber-400/30 rounded-2xl p-4 flex items-center justify-between">
    <span className="text-amber-300 text-sm">Tu plan es de la semana pasada. ¿Regenerar ahora?</span>
    <a href="/weekly-plan" className="text-amber-400 text-sm font-semibold hover:underline ml-4">Ver plan →</a>
  </div>
)}
```

The banner exists but only links to `/weekly-plan`. The task is to upgrade it to trigger regeneration directly.

- [ ] Step 1: Add `regenerateDay` import to the diet page imports:
  ```typescript
  import { fetchTodaysPlan, swapMeal, updateAdherence, fetchFavoriteCarbs, searchFood, regenerateDay } from "@/lib/api"
  ```

  Add state for regeneration:
  ```typescript
  const [regenerating, setRegenerating] = useState(false)
  ```

- [ ] Step 2: Add a `handleRegenerateFromStale` function inside `DietPage`:
  ```typescript
  const handleRegenerateFromStale = async () => {
    setRegenerating(true)
    try {
      const updated = await regenerateDay()
      setPlanDay(updated)
      setStale(updated.stale ?? false)
      const carbs = state.favoriteCarbs
      const target = updated.exerciseAdj?.adjustedTotal ?? updated.totalKcal
      init(updated.date, target, updated.meals, carbs)
    } catch {
      // silent — plan stays as-is
    } finally {
      setRegenerating(false)
    }
  }
  ```

- [ ] Step 3: Replace the existing stale banner (lines 210–215) with an upgraded version:
  ```tsx
  {stale && (
    <div className="bg-amber-500/20 border border-amber-400/30 rounded-2xl p-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
        <span className="text-amber-300 text-sm">Tu plan está desactualizado</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleRegenerateFromStale}
          disabled={regenerating}
          className="px-3 py-1.5 text-xs font-semibold bg-amber-500/30 hover:bg-amber-500/50 text-amber-300 rounded-lg border border-amber-400/30 transition-colors disabled:opacity-50"
        >
          {regenerating ? "Regenerando..." : "Regenerar"}
        </button>
        <a href="/weekly-plan" className="text-amber-400/70 text-xs hover:underline">
          Ver plan →
        </a>
      </div>
    </div>
  )}
  ```

  Add `AlertTriangle` to lucide-react imports (it is already imported in `weekly-plan/page.tsx` so the pattern is established).

- [ ] Step 4: Manual verification:
  1. To trigger `stale = true`: manually set the session's week plan to a previous week, or check backend logic (the `_is_stale` function at api.py line 127 compares plan date to today's week). A quick test: temporarily change the system date or edit `session.json` to have a plan from last week.
  2. Open `/diet`. Expected: amber banner with "Tu plan está desactualizado" and "Regenerar" button.
  3. Click "Regenerar". Expected: spinner during operation, banner disappears on success, plan updates.
  4. When `stale = false`: banner not visible.

- [ ] Step 5: Commit:
  ```bash
  cd /Users/practica/nutritrack
  git add nutrition_frontend/app/diet/page.tsx
  git commit -m "feat: upgrade stale plan banner in diet page with inline regenerate button"
  ```

---

### Task 2: Regenerate Plan Button Verification (Weekly Plan Page)

**Files:**
- Read-only: `nutrition_frontend/app/weekly-plan/page.tsx`

**Pre-task audit:** After reviewing `weekly-plan/page.tsx`, the regenerate functionality is **already fully implemented**:
- `handleRegenerate()` at line 501 calls `regenerateWeeklyPlan(regenApplyFrom)`
- A modal with confirmation dialog is at line 787 (`showRegenModal`)
- Spinner shown via `{regenerating ? "Regenerando..." : "Regenerar"}` at line 848
- Stale banner at line 544 triggers `setShowRegenModal(true)`
- The "Regenerar semana completa" button at line 776 is present

**This task is already done.** Verify it works end-to-end:

- [ ] Step 1: Start both servers and open `/weekly-plan`.
- [ ] Step 2: Click "Regenerar semana completa" button. Expected: confirmation modal appears.
- [ ] Step 3: In the modal, select "Desde mañana" or "Desde hoy", click "Regenerar". Expected: spinner, then plan refreshes and modal closes.
- [ ] Step 4: Verify error case: stop the backend. Click regenerate. Expected: error message "Error al regenerar el plan. Inténtalo de nuevo." in the modal (`regenError` state).
- [ ] Step 5: No code changes needed. If a bug is found during verification, fix and commit:
  ```bash
  cd /Users/practica/nutritrack
  git add nutrition_frontend/app/weekly-plan/page.tsx
  git commit -m "fix: [describe actual bug found in regenerate flow]"
  ```

---

### Task 3: PDF Report Archive

**Files:**
- Modify: `nutrition_assistant/api.py`
- Modify: `nutrition_frontend/lib/api.ts`
- Modify: `nutrition_frontend/app/report/page.tsx`

#### Sub-task 3a: Backend — archive on generate + new endpoints

- [ ] Step 1: Write a failing pytest. Add to `nutrition_assistant/tests/test_api.py`:

  ```python
  def test_get_reports_empty(tmp_path):
      """GET /reports returns empty list when no reports saved."""
      import api as _api
      with patch.object(_api, "REPORTS_DIR", tmp_path / "reports"):
          r = client.get("/reports")
          assert r.status_code == 200
          assert r.json()["reports"] == []

  def test_get_reports_after_download(tmp_path):
      """After calling /report/download, GET /reports returns one entry."""
      import api as _api
      reports_dir = tmp_path / "reports"
      reports_dir.mkdir()

      with patch.object(_api, "REPORTS_DIR", reports_dir):
          # Generate a PDF
          r = client.get("/report/download")
          assert r.status_code == 200

          # List reports
          r2 = client.get("/reports")
          assert r2.status_code == 200
          reports = r2.json()["reports"]
          assert len(reports) == 1
          assert reports[0]["filename"].startswith("report_")
          assert reports[0]["filename"].endswith(".pdf")
          assert "url" in reports[0]
  ```

- [ ] Step 2: Run the tests to confirm they fail:
  ```bash
  cd /Users/practica/nutritrack/nutrition_assistant
  python -m pytest tests/test_api.py::test_get_reports_empty tests/test_api.py::test_get_reports_after_download -v
  ```
  Expected: `FAILED` — `REPORTS_DIR` not defined in `api`.

- [ ] Step 3: In `nutrition_assistant/api.py`, add after the existing imports (alongside the `CHEATDAY_FILE` addition from F0, or near the top):

  ```python
  REPORTS_DIR = DATA_DIR / "reports"
  ```

  Modify the `download_report_pdf` endpoint to archive the PDF. Replace the `return FileResponse(...)` block at the end of the function (around line 1553) with:

  ```python
  # Archive the PDF with a week-based filename
  from datetime import date
  import shutil
  week_str = date.today().strftime("%Y-W%W")
  REPORTS_DIR.mkdir(parents=True, exist_ok=True)
  archive_path = REPORTS_DIR / f"report_{week_str}.pdf"
  shutil.copy2(tmp.name, str(archive_path))

  return FileResponse(
      tmp.name,
      media_type="application/pdf",
      filename=f"informe_semanal_{date.today().isoformat()}.pdf",
  )
  ```

  Then add the two new endpoints after `download_report_pdf`:

  ```python
  @app.get("/reports", tags=["Informe"])
  def list_reports(request: Request):
      """Lista todos los reportes PDF archivados, ordenados por fecha descendente."""
      if not os.path.exists(REPORTS_DIR):
          return {"reports": []}
      files = sorted(
          [f for f in os.listdir(REPORTS_DIR) if f.endswith(".pdf")],
          reverse=True,
      )
      base_url = str(request.base_url).rstrip("/")
      return {
          "reports": [
              {
                  "filename": f,
                  "week":     f.replace("report_", "").replace(".pdf", ""),
                  "url":      f"{base_url}/reports/{f}",
              }
              for f in files
          ]
      }

  @app.get("/reports/{filename}", tags=["Informe"])
  def download_archived_report(filename: str):
      """Sirve un reporte PDF archivado por nombre de archivo."""
      # Security: only allow filenames matching expected pattern
      import re
      if not re.match(r'^report_\d{4}-W\d{2}\.pdf$', filename):
          raise HTTPException(400, "Nombre de archivo no válido")
      path = REPORTS_DIR / filename
      if not os.path.exists(path):
          raise HTTPException(404, "Reporte no encontrado")
      return FileResponse(str(path), media_type="application/pdf", filename=filename)
  ```

- [ ] Step 4: Run the tests to confirm they pass:
  ```bash
  cd /Users/practica/nutritrack/nutrition_assistant
  python -m pytest tests/test_api.py::test_get_reports_empty tests/test_api.py::test_get_reports_after_download -v
  ```
  Expected: `PASSED`.

#### Sub-task 3b: Frontend

- [ ] Step 5: Add to `nutrition_frontend/lib/api.ts`:

  ```typescript
  // ── Report Archive ─────────────────────────────────────────────────────────

  export interface ArchivedReport {
    filename: string
    week: string
    url: string
  }

  export async function getReportsList(): Promise<ArchivedReport[]> {
    const d = await get<{ reports: ArchivedReport[] }>("/reports")
    return d.reports
  }
  ```

- [ ] Step 6: In `nutrition_frontend/app/report/page.tsx`, add a "Reportes anteriores" section. Add state at the top of `ReportPage`:

  ```typescript
  import { fetchWeeklyReport, submitSensationsSurvey, getReportPdfUrl, getReportsList, type ArchivedReport } from "@/lib/api"

  // inside ReportPage:
  const [archivedReports, setArchivedReports] = useState<ArchivedReport[]>([])
  ```

  Add to the existing `useEffect`:
  ```typescript
  getReportsList().then(setArchivedReports).catch(() => [])
  ```

  Add the "Reportes anteriores" section at the bottom of the page JSX, after the existing PDF download button section:

  ```tsx
  {archivedReports.length > 0 && (
    <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Reportes anteriores</h3>
      <div className="space-y-2">
        {archivedReports.map((report) => (
          <div
            key={report.filename}
            className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10"
          >
            <div className="flex items-center gap-3">
              <FileBarChart className="h-4 w-4 text-white/50" />
              <span className="text-white/80 text-sm">Semana {report.week}</span>
            </div>
            <a
              href={report.url}
              download={report.filename}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/10 hover:bg-white/20 text-white/70 hover:text-white rounded-lg border border-white/10 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Descargar
            </a>
          </div>
        ))}
      </div>
    </Card>
  )}
  ```

- [ ] Step 7: Manual verification:
  1. Start both servers.
  2. Open `/report`, click "Descargar informe PDF". Verify the PDF downloads.
  3. Check `nutrition_assistant/reports/` directory — a file `report_YYYY-WNN.pdf` should exist.
  4. Reload `/report`. Expected: "Reportes anteriores" section appears with one entry.
  5. Click "Descargar" on the archived report. Expected: PDF downloads.
  6. Generate again (same week). Expected: only one entry in the list (overwrite same week).

- [ ] Step 8: Commit:
  ```bash
  cd /Users/practica/nutritrack
  git add nutrition_assistant/api.py nutrition_frontend/lib/api.ts nutrition_frontend/app/report/page.tsx
  git commit -m "feat: archive PDF reports and show download history on report page"
  ```
