# F3 — Datos y Exportación Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add adherence metrics aggregation with visualizations, and a CSV/Excel data export endpoint accessible from the settings page.

**Architecture:** Task 1 adds an aggregation function to `nutrition_assistant/adherence.py` and a new FastAPI endpoint, then surfaces the data in the progress page using Recharts (already installed). Task 2 adds a new `/export` endpoint to `api.py` that reads from multiple JSON data files and returns a CSV or XLSX download; `openpyxl` is added to requirements; the settings page gets a date-range export form.

**Tech Stack:** FastAPI, Python `csv` (stdlib), `openpyxl`, JSON file storage, Next.js 15, Recharts 2.15, Tailwind CSS.

---

## Files Modified/Created

- `nutrition_assistant/adherence.py` — add `get_metrics()` aggregation function (Task 1)
- `nutrition_assistant/api.py` — add `GET /adherence/metrics`, `GET /export` endpoints (Tasks 1, 2)
- `nutrition_assistant/requirements.txt` — add `openpyxl` (Task 2)
- `nutrition_frontend/lib/api.ts` — add `getAdherenceMetrics()`, `exportData()` (Tasks 1, 2)
- `nutrition_frontend/app/progress/page.tsx` — add adherence metrics section with Recharts (Task 1)
- `nutrition_frontend/app/settings/page.tsx` — add "Exportar mis datos" section (Task 2)

---

### Task 1: Adherence Metrics Endpoint and Visualization

**Files:**
- Modify: `nutrition_assistant/adherence.py`
- Modify: `nutrition_assistant/api.py`
- Modify: `nutrition_frontend/lib/api.ts`
- Modify: `nutrition_frontend/app/progress/page.tsx`

#### Sub-task 1a: Backend

- [ ] Step 1: Write a failing pytest. Add to `nutrition_assistant/tests/test_api.py`:

  ```python
  def test_adherence_metrics_7days(tmp_path):
      """GET /adherence/metrics?days=7 returns expected keys."""
      from unittest.mock import patch
      import adherence as adh_module
      import json

      # Seed 7 days of data
      log = {}
      from datetime import date, timedelta
      today = date.today()
      for i in range(7):
          d = (today - timedelta(days=i)).isoformat()
          log[d] = {
              "meals": {
                  "desayuno": True, "almuerzo": True, "cena": i % 2 == 0,
              },
              "pct": 100 if i % 2 == 0 else 67,
          }

      with patch.object(adh_module, "_load", return_value=log):
          r = client.get("/adherence/metrics?days=7")
          assert r.status_code == 200
          body = r.json()
          assert "meal_compliance" in body
          assert "daily_trend" in body
          assert "most_skipped" in body
          assert "current_streak" in body
          assert isinstance(body["daily_trend"], list)
          assert len(body["daily_trend"]) == 7
  ```

- [ ] Step 2: Run the test to confirm it fails:
  ```bash
  cd /Users/practica/nutritrack/nutrition_assistant
  python -m pytest tests/test_api.py::test_adherence_metrics_7days -v
  ```
  Expected: `FAILED` — 404 or missing keys.

- [ ] Step 3: Add `get_metrics()` to `nutrition_assistant/adherence.py` (append after `print_adherence_summary`):

  ```python
  def get_metrics(days: int = 7) -> dict:
      """
      Agrega métricas de adherencia para los últimos `days` días.
      Devuelve:
        - meal_compliance: % cumplimiento por tipo de comida
        - daily_trend: lista de {date, pct} para sparkline
        - most_skipped: lista de comidas más saltadas [(meal_id, skip_count)]
        - current_streak: días consecutivos con adherencia >80%
      """
      log   = _load()
      today = date.today()
      dates = [(today - timedelta(days=i)).isoformat() for i in range(days - 1, -1, -1)]

      meal_totals:  dict[str, int] = {}
      meal_done:    dict[str, int] = {}
      daily_trend = []
      streak = 0
      streak_broken = False

      for iso in reversed(dates):  # newest first for streak
          entry = log.get(iso)
          if entry:
              pct = entry.get("pct", 0)
              if not streak_broken and pct >= 80:
                  streak += 1
              else:
                  streak_broken = True
              for meal_id, done in entry.get("meals", {}).items():
                  meal_totals[meal_id] = meal_totals.get(meal_id, 0) + 1
                  if done:
                      meal_done[meal_id] = meal_done.get(meal_id, 0) + 1

      for iso in dates:
          entry = log.get(iso)
          daily_trend.append({
              "date": iso,
              "pct":  entry["pct"] if entry else None,
          })

      meal_compliance = {
          meal_id: round(meal_done.get(meal_id, 0) / total * 100)
          for meal_id, total in meal_totals.items()
          if total > 0
      }

      meal_skip_counts = {
          meal_id: total - meal_done.get(meal_id, 0)
          for meal_id, total in meal_totals.items()
      }
      most_skipped = sorted(
          [{"meal": k, "skips": v} for k, v in meal_skip_counts.items() if v > 0],
          key=lambda x: x["skips"],
          reverse=True,
      )[:3]

      return {
          "meal_compliance": meal_compliance,
          "daily_trend":     daily_trend,
          "most_skipped":    most_skipped,
          "current_streak":  streak,
      }
  ```

- [ ] Step 4: In `nutrition_assistant/api.py`, add the import for the new function:

  At the top where `adherence` is imported (around line 49):
  ```python
  from adherence import ADHERENCE_FILE, weekly_adherence, get_metrics as get_adherence_metrics
  ```

  Then add the endpoint (place after the existing `/adherence` GET endpoint around line 1060):

  ```python
  @app.get("/adherence/metrics", tags=["Adherencia"])
  def adherence_metrics(days: int = Query(7, ge=7, le=30, description="7 or 30 days")):
      """Agrega métricas de adherencia: cumplimiento por comida, tendencia, racha, comidas problemáticas."""
      return get_adherence_metrics(days)
  ```

- [ ] Step 5: Run the test to confirm it passes:
  ```bash
  cd /Users/practica/nutritrack/nutrition_assistant
  python -m pytest tests/test_api.py::test_adherence_metrics_7days -v
  ```
  Expected: `PASSED`.

#### Sub-task 1b: Frontend

- [ ] Step 6: Add to `nutrition_frontend/lib/api.ts`:

  ```typescript
  // ── Adherence Metrics ─────────────────────────────────────────────────────

  export interface AdherenceMetrics {
    meal_compliance: Record<string, number>   // meal_id → % (0–100)
    daily_trend: { date: string; pct: number | null }[]
    most_skipped: { meal: string; skips: number }[]
    current_streak: number
  }

  export async function getAdherenceMetrics(days: 7 | 30 = 7): Promise<AdherenceMetrics> {
    return get<AdherenceMetrics>(`/adherence/metrics?days=${days}`)
  }
  ```

- [ ] Step 7: In `nutrition_frontend/app/progress/page.tsx`, add adherence metrics section. The file already imports Recharts (`LineChart`, `Line`, `BarChart`, `Bar`, etc.) and has `fetchProgress` from api.ts.

  Add to imports:
  ```typescript
  import { fetchProgress, logWeight, getAdherenceMetrics, type AdherenceMetrics } from "@/lib/api"
  ```

  Add state in `ProgressPage`:
  ```typescript
  const [metrics, setMetrics] = useState<AdherenceMetrics | null>(null)
  const [metricsDays, setMetricsDays] = useState<7 | 30>(7)
  ```

  Add to `useEffect`:
  ```typescript
  getAdherenceMetrics(metricsDays).then(setMetrics).catch(() => null)
  ```

  Add separate `useEffect` for when `metricsDays` changes:
  ```typescript
  useEffect(() => {
    getAdherenceMetrics(metricsDays).then(setMetrics).catch(() => null)
  }, [metricsDays])
  ```

  Add the metrics section JSX at the bottom of the page, after the adherence-by-week bar chart:

  ```tsx
  {metrics && (
    <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Métricas de adherencia</h3>
        <div className="flex gap-2">
          {([7, 30] as const).map((d) => (
            <button
              key={d}
              onClick={() => setMetricsDays(d)}
              className={`px-3 py-1 text-xs rounded-lg border transition-colors ${
                metricsDays === d
                  ? "bg-emerald-500/20 border-emerald-400/30 text-emerald-300"
                  : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10"
              }`}
            >
              {d} días
            </button>
          ))}
        </div>
      </div>

      {/* Streak */}
      <div className="mb-4 p-3 bg-white/5 rounded-xl border border-white/10">
        <p className="text-white/50 text-xs">Racha actual (&gt;80% adherencia)</p>
        <p className="text-2xl font-bold text-emerald-400">{metrics.current_streak} días</p>
      </div>

      {/* Daily trend sparkline */}
      <p className="text-white/50 text-xs mb-2">Tendencia diaria</p>
      <ResponsiveContainer width="100%" height={80}>
        <LineChart data={metrics.daily_trend.filter(d => d.pct !== null)}>
          <Line
            type="monotone"
            dataKey="pct"
            stroke="#34d399"
            strokeWidth={2}
            dot={false}
          />
          <Tooltip
            formatter={(val: number) => [`${val}%`, "Adherencia"]}
            labelFormatter={(label: string) => label}
            contentStyle={{ background: "rgba(0,0,0,0.8)", border: "none", borderRadius: 8 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Most skipped */}
      {metrics.most_skipped.length > 0 && (
        <div className="mt-4">
          <p className="text-white/50 text-xs mb-2">Comidas más saltadas</p>
          <div className="space-y-1">
            {metrics.most_skipped.map(({ meal, skips }) => (
              <div key={meal} className="flex justify-between text-sm">
                <span className="text-white/70 capitalize">{meal.replace("_", " ")}</span>
                <span className="text-red-400">{skips} veces</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )}
  ```

- [ ] Step 8: Manual verification:
  1. Open `/progress`. Expected: "Métricas de adherencia" card at the bottom.
  2. If no adherence data yet: streak shows 0, trend is empty, most_skipped is empty — all graceful.
  3. Log some meals via `/diet` and check a few as eaten. Reload `/progress`. Expect streak and trend to update.
  4. Toggle "7 días" / "30 días" buttons. Expect data to refresh.

- [ ] Step 9: Commit:
  ```bash
  cd /Users/practica/nutritrack
  git add nutrition_assistant/adherence.py nutrition_assistant/api.py nutrition_frontend/lib/api.ts nutrition_frontend/app/progress/page.tsx
  git commit -m "feat: add adherence metrics endpoint and visualization on progress page"
  ```

---

### Task 2: CSV/Excel Data Export

**Files:**
- Modify: `nutrition_assistant/requirements.txt`
- Modify: `nutrition_assistant/api.py`
- Modify: `nutrition_frontend/lib/api.ts`
- Modify: `nutrition_frontend/app/settings/page.tsx`

#### Sub-task 2a: Backend

- [ ] Step 1: Write a failing pytest. Add to `nutrition_assistant/tests/test_api.py`:

  ```python
  def test_export_csv(tmp_path):
      """GET /export?format=csv returns a CSV file download."""
      r = client.get("/export?format=csv&from=2026-01-01&to=2026-03-23")
      assert r.status_code == 200
      assert "text/csv" in r.headers.get("content-type", "")
      assert "attachment" in r.headers.get("content-disposition", "")

  def test_export_xlsx(tmp_path):
      """GET /export?format=xlsx returns an XLSX file download."""
      r = client.get("/export?format=xlsx&from=2026-01-01&to=2026-03-23")
      assert r.status_code == 200
      assert "spreadsheetml" in r.headers.get("content-type", "") or \
             "octet-stream" in r.headers.get("content-type", "")
  ```

- [ ] Step 2: Run the tests to confirm they fail:
  ```bash
  cd /Users/practica/nutritrack/nutrition_assistant
  python -m pytest tests/test_api.py::test_export_csv tests/test_api.py::test_export_xlsx -v
  ```
  Expected: `FAILED` — 404.

- [ ] Step 3: Add `openpyxl` to `nutrition_assistant/requirements.txt`:
  ```
  openpyxl>=3.1.0
  ```

- [ ] Step 4: Add the `/export` endpoint to `nutrition_assistant/api.py`. Place after the `/reports` endpoints (end of file or near food search). Add import at the top:

  ```python
  import csv
  import io
  from fastapi.responses import StreamingResponse
  ```

  Then add the endpoint:

  ```python
  # ══════════════════════════════════════════════════════════════════════════════
  # DATA EXPORT (CSV / XLSX)
  # ══════════════════════════════════════════════════════════════════════════════

  @app.get("/export", tags=["Exportación"])
  def export_data(
      format: str = Query("csv", regex="^(csv|xlsx)$"),
      from_date: str = Query(..., alias="from", description="YYYY-MM-DD"),
      to_date:   str = Query(..., alias="to",   description="YYYY-MM-DD"),
  ):
      """
      Exporta datos del usuario en CSV o XLSX.
      Incluye: historial de peso, adherencia diaria, ejercicio, encuestas.
      """
      try:
          d_from = date.fromisoformat(from_date)
          d_to   = date.fromisoformat(to_date)
      except ValueError:
          raise HTTPException(400, "Fechas inválidas. Usa formato YYYY-MM-DD.")

      if d_to < d_from:
          raise HTTPException(400, "La fecha 'to' debe ser posterior a 'from'.")

      # ── Gather data ──────────────────────────────────────────────────────────

      # Weight history
      weight_data = []
      if os.path.exists(W_HISTORY_FILE):
          with open(W_HISTORY_FILE) as f:
              wh = json.load(f)
          for entry in wh.get("history", []):
              d = date.fromisoformat(entry["date"])
              if d_from <= d <= d_to:
                  weight_data.append({"date": entry["date"], "weight_kg": entry["weight_kg"]})

      # Adherence
      adh_data = []
      if os.path.exists(ADHERENCE_FILE):
          with open(ADHERENCE_FILE) as f:
              adh_log = json.load(f)
          for iso, entry in adh_log.items():
              d = date.fromisoformat(iso)
              if d_from <= d <= d_to:
                  adh_data.append({
                      "date": iso,
                      "pct":  entry.get("pct", 0),
                      "meals_done": sum(1 for v in entry.get("meals", {}).values() if v),
                      "meals_total": len(entry.get("meals", {})),
                  })

      # Exercise
      ex_data = []
      if os.path.exists(EX_HISTORY_FILE):
          with open(EX_HISTORY_FILE) as f:
              ex_log = json.load(f)
          for iso, entry in ex_log.items():
              d = date.fromisoformat(iso)
              if d_from <= d <= d_to and entry.get("trained"):
                  ex_data.append({
                      "date":           iso,
                      "burned_kcal":    entry.get("burned_kcal", 0),
                      "session_type":   entry.get("session_type", ""),
                      "duration_min":   entry.get("health_data", {}).get("duration_min", ""),
                  })

      # Surveys
      survey_data = []
      survey_file = DATA_DIR / "survey_history.json"
      if os.path.exists(survey_file):
          with open(survey_file) as f:
              surveys = json.load(f)
          for entry in surveys:
              d = date.fromisoformat(entry.get("date", "2000-01-01"))
              if d_from <= d <= d_to:
                  survey_data.append({
                      "date":       entry.get("date", ""),
                      "energia":    entry.get("energia", ""),
                      "sueno":      entry.get("sueno", ""),
                      "adherencia": entry.get("adherencia", ""),
                      "hambre":     entry.get("hambre", ""),
                  })

      filename_base = f"nutritrack_{from_date}_{to_date}"

      if format == "csv":
          output = io.StringIO()
          writer = csv.writer(output)

          writer.writerow(["## Peso"])
          writer.writerow(["fecha", "peso_kg"])
          for row in sorted(weight_data, key=lambda x: x["date"]):
              writer.writerow([row["date"], row["weight_kg"]])

          writer.writerow([])
          writer.writerow(["## Adherencia"])
          writer.writerow(["fecha", "pct", "comidas_hechas", "comidas_total"])
          for row in sorted(adh_data, key=lambda x: x["date"]):
              writer.writerow([row["date"], row["pct"], row["meals_done"], row["meals_total"]])

          writer.writerow([])
          writer.writerow(["## Ejercicio"])
          writer.writerow(["fecha", "kcal_quemadas", "tipo", "duracion_min"])
          for row in sorted(ex_data, key=lambda x: x["date"]):
              writer.writerow([row["date"], row["burned_kcal"], row["session_type"], row["duration_min"]])

          writer.writerow([])
          writer.writerow(["## Encuestas"])
          writer.writerow(["fecha", "energia", "sueno", "adherencia", "hambre"])
          for row in sorted(survey_data, key=lambda x: x["date"]):
              writer.writerow([row["date"], row["energia"], row["sueno"], row["adherencia"], row["hambre"]])

          output.seek(0)
          return StreamingResponse(
              iter([output.getvalue()]),
              media_type="text/csv",
              headers={"Content-Disposition": f'attachment; filename="{filename_base}.csv"'},
          )

      else:  # xlsx
          import openpyxl
          wb = openpyxl.Workbook()

          sheets_data = [
              ("Peso",       ["fecha", "peso_kg"],
               [[r["date"], r["weight_kg"]] for r in sorted(weight_data, key=lambda x: x["date"])]),
              ("Adherencia", ["fecha", "pct", "comidas_hechas", "comidas_total"],
               [[r["date"], r["pct"], r["meals_done"], r["meals_total"]] for r in sorted(adh_data, key=lambda x: x["date"])]),
              ("Ejercicio",  ["fecha", "kcal_quemadas", "tipo", "duracion_min"],
               [[r["date"], r["burned_kcal"], r["session_type"], r["duration_min"]] for r in sorted(ex_data, key=lambda x: x["date"])]),
              ("Encuestas",  ["fecha", "energia", "sueno", "adherencia", "hambre"],
               [[r["date"], r["energia"], r["sueno"], r["adherencia"], r["hambre"]] for r in sorted(survey_data, key=lambda x: x["date"])]),
          ]

          for i, (title, headers, rows) in enumerate(sheets_data):
              ws = wb.active if i == 0 else wb.create_sheet(title=title)
              if i == 0:
                  ws.title = title
              ws.append(headers)
              for row in rows:
                  ws.append(row)

          buf = io.BytesIO()
          wb.save(buf)
          buf.seek(0)
          return StreamingResponse(
              iter([buf.read()]),
              media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              headers={"Content-Disposition": f'attachment; filename="{filename_base}.xlsx"'},
          )
  ```

  Note: `DATA_DIR` is already imported from `data_dir`. `W_HISTORY_FILE`, `EX_HISTORY_FILE`, and `ADHERENCE_FILE` are already imported or defined at the top of `api.py`.

- [ ] Step 5: Install `openpyxl` and run the tests:
  ```bash
  cd /Users/practica/nutritrack/nutrition_assistant
  pip install openpyxl
  python -m pytest tests/test_api.py::test_export_csv tests/test_api.py::test_export_xlsx -v
  ```
  Expected: `PASSED`.

#### Sub-task 2b: Frontend

- [ ] Step 6: Add to `nutrition_frontend/lib/api.ts`:

  ```typescript
  // ── Data Export ───────────────────────────────────────────────────────────

  export function getExportUrl(params: {
    format: "csv" | "xlsx"
    from: string
    to: string
  }): string {
    const q = new URLSearchParams({
      format: params.format,
      from:   params.from,
      to:     params.to,
    })
    return `${API_BASE}/export?${q}`
  }
  ```

  Note: Since this triggers a file download, we return a URL rather than fetching the data. The component will use an `<a href>` with the URL for direct download. No API key needed as it's a local backend.

- [ ] Step 7: In `nutrition_frontend/app/settings/page.tsx`, add an "Exportar mis datos" section. Add to imports at the top:

  ```typescript
  import { fetchSettings, updateProfile, updateFoodPreferences, saveEvent, deleteEvent, getExportUrl } from "@/lib/api"
  import { Download } from "lucide-react"
  ```

  Add state in `SettingsPage`:
  ```typescript
  const [exportFrom, setExportFrom] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d.toISOString().slice(0, 10)
  })
  const [exportTo, setExportTo] = useState(new Date().toISOString().slice(0, 10))
  const [exportFormat, setExportFormat] = useState<"csv" | "xlsx">("csv")
  ```

  Add the section JSX at the bottom of the settings page (after the last tab content, still inside `<AppLayout>`), as a new card below the `<Tabs>` component:

  ```tsx
  {/* Export section */}
  <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6">
    <div className="flex items-center gap-2 mb-4">
      <Download className="h-5 w-5 text-white/70" />
      <h3 className="text-lg font-semibold text-white">Exportar mis datos</h3>
    </div>
    <p className="text-white/50 text-sm mb-4">
      Descarga todos tus datos en CSV o Excel para análisis externo.
    </p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
      <div className="space-y-1">
        <Label className="text-white/70 text-xs">Desde</Label>
        <Input
          type="date"
          value={exportFrom}
          onChange={(e) => setExportFrom(e.target.value)}
          className="bg-white/5 border-white/20 text-white"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-white/70 text-xs">Hasta</Label>
        <Input
          type="date"
          value={exportTo}
          onChange={(e) => setExportTo(e.target.value)}
          className="bg-white/5 border-white/20 text-white"
        />
      </div>
    </div>
    <div className="flex items-center gap-3">
      <div className="flex gap-2">
        {(["csv", "xlsx"] as const).map((fmt) => (
          <button
            key={fmt}
            onClick={() => setExportFormat(fmt)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              exportFormat === fmt
                ? "bg-emerald-500/20 border-emerald-400/30 text-emerald-300"
                : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10"
            }`}
          >
            {fmt.toUpperCase()}
          </button>
        ))}
      </div>
      <a
        href={getExportUrl({ format: exportFormat, from: exportFrom, to: exportTo })}
        download
        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl transition-colors"
      >
        <Download className="h-4 w-4" />
        Descargar
      </a>
    </div>
  </Card>
  ```

- [ ] Step 8: Manual verification:
  1. Open `/settings`. Expected: "Exportar mis datos" card at the bottom.
  2. Set date range, select CSV, click "Descargar". Expected: CSV file downloads with sections for Peso, Adherencia, Ejercicio, Encuestas.
  3. Repeat with XLSX. Expected: Excel file downloads with 4 sheets.
  4. Try invalid date range (from > to). Expected: backend returns 400 and browser shows an error or no download.

- [ ] Step 9: Commit:
  ```bash
  cd /Users/practica/nutritrack
  git add nutrition_assistant/requirements.txt nutrition_assistant/api.py nutrition_frontend/lib/api.ts nutrition_frontend/app/settings/page.tsx
  git commit -m "feat: add CSV/XLSX data export endpoint and settings UI"
  ```
