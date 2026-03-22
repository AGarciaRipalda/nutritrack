const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : "http://localhost:8000")

// ── Helpers ───────────────────────────────────────────────────────────────────

// Bypass ngrok browser-warning interstitial (no-op for non-ngrok URLs)
// Also injects X-User-Timezone so the backend can resolve "today" correctly.
function getHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    "ngrok-skip-browser-warning": "true",
    "X-User-Timezone": Intl.DateTimeFormat().resolvedOptions().timeZone,
    ...extra,
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    headers: getHeaders(),
  })
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`)
  return res.json()
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: body
      ? getHeaders({ "Content-Type": "application/json" })
      : getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`)
  return res.json()
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: getHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`PUT ${path} failed: ${res.status}`)
  return res.json()
}

async function del(path: string): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, { method: "DELETE", headers: getHeaders() })
  if (!res.ok) throw new Error(`DELETE ${path} failed: ${res.status}`)
}

// ── Tipos públicos (usados por los componentes de v0) ─────────────────────────

export interface GoalBalance {
  goal: "lose" | "maintain" | "gain"
  targetAdjustment: number   // -300, 0, +300
  consumedKcal: number
  activeKcal: number
  netBalance: number         // consumed - active
  targetNet: number          // daily_target - active
}

export interface DashboardData {
  dailyCalorieTarget: number
  caloriesConsumed: number
  steps: number | null
  heartRateAvg: number | null
  activeCalories: number | null
  goalBalance: GoalBalance
  macros: {
    protein: { current: number; target: number }
    carbs: { current: number; target: number }
    fat: { current: number; target: number }
  }
  exerciseYesterday: {
    type: string
    minutes: number
    caloriesBurned: number
    steps: number | null
    heartRateAvg: number | null
  } | null
  alerts: {
    id: string
    type: "weigh-in" | "survey" | "event" | "weekly_report"
    message: string
    dueDate?: string
  }[]
}

export interface FavoriteCarb {
  key: string    // "arroz_cocido"
  name: string   // "Arroz cocido"
  kcal: number   // kcal per 100g
}

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
  fixedKcal?: number    // protein+fat+veg fixed component (for carb swap calc)
  targetKcal?: number   // calorie target for this meal slot
  carbG?: number        // original carb grams
}

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

export interface WeeklyHistorySummary {
  week_start: string            // "2026-03-10"
  avg_adherence: number         // 0.0–1.0
  total_exercise_kcal: number
  weight_start: number | null
  weight_end: number | null
  weight_delta: number | null
  days_logged: number
}

export interface WeeklyPlanResponse {
  days: PlanDay[]
  summary: WeeklyHistorySummary | null
  stale: boolean
}

export interface ExerciseLog {
  id: string
  date: string
  type: string
  minutes: number
  caloriesBurned: number
  sources?: string[]          // ["apple_health", "google_sheets", ...]
  healthData?: {
    active_calories: number
    workout_type: string | null
    duration_min: number | null
    steps: number | null
    heart_rate_avg: number | null
    heart_rate_max: number | null
  } | null
}

export interface ExerciseRoutine {
  day: string
  label: string
  exercises: { name: string; sets: string; muscles: string }[]
}

export interface TrainingData {
  exerciseTypes: string[]
  history: ExerciseLog[]
  streak: number
  totalKcal: number
  trainedDays: number
  yesterdayExercise: { burned_kcal: number; adjustment_kcal: number; exercises: unknown[] } | null
  todayTraining: { bonus_kcal: number; training_type: string | null } | null
}

export interface WeightEntry {
  date: string
  weight: number
}

export interface ProgressData {
  weightHistory: WeightEntry[]
  trendLine: WeightEntry[]
  currentWeight: number | null
  needsWeighIn: boolean
  expectedWeekly: number
  analysis: {
    totalChange: number
    realWeekly: number
    expectedWeekly: number
    status: string
    message: string
  } | null
  adherenceByWeek: { week: string; adherence: number }[]
}

export interface WeeklyReportData {
  daysTrained: number
  totalKcalBurned: number
  adherencePercent: number
  weightChange: number | null
  currentWeight: number | null
  sensationsSurvey: {
    energy: number
    sleep: number
    mood: number
    hunger: number
  } | null
  recommendations: string[]
  needsSurvey: boolean
}

export interface UserProfile {
  name: string
  gender: "male" | "female"
  age: number
  height: number
  weight: number
  activityLevel: number
  goal: "lose" | "maintain" | "gain"
  weekStartDay: number  // 0=Monday … 6=Sunday
}

export interface FoodPreferences {
  excluded: string[]
  favorites: string[]
  disliked: string[]
}

export interface UpcomingEvent {
  id: string
  name: string
  date: string
  daysToEvent: number | null
  message?: string
}

export interface SettingsData {
  profile: UserProfile
  foodPreferences: FoodPreferences
  events: UpcomingEvent[]   // array para compatibilidad con el componente v0
}

// ── Deprecated aliases (kept so existing imports in other pages don't break) ──

/** @deprecated Use PlanDay instead */
export type TodaysDiet = PlanDay & { adherenceChecklist: { id: string; label: string; checked: boolean }[] }
/** @deprecated Use WeeklyPlanResponse instead */
export type WeeklyPlan = WeeklyPlanResponse & { shoppingList: { category: string; items: string[] }[] }

// ── Transformadores (backend → frontend) ──────────────────────────────────────

const MEAL_MAP: Record<string, { type: string; label: string }> = {
  desayuno:    { type: "breakfast",   label: "Desayuno" },
  media_manana:{ type: "mid-morning", label: "Media mañana" },
  almuerzo:    { type: "lunch",       label: "Almuerzo" },
  merienda:    { type: "snack",       label: "Merienda" },
  cena:        { type: "dinner",      label: "Cena" },
  postre:      { type: "dessert",     label: "Postre" },
}

const MEAL_ORDER = ["desayuno", "media_manana", "almuerzo", "merienda", "cena", "postre"]

const DAYS_ES: Record<string, string> = {
  LUNES: "Lunes", MARTES: "Martes", "MIÉRCOLES": "Miércoles",
  JUEVES: "Jueves", VIERNES: "Viernes", "SÁBADO": "Sábado", DOMINGO: "Domingo",
}

const CATEGORY_LABELS: Record<string, string> = {
  proteinas: "Proteínas", lacteos: "Lácteos", cereales: "Cereales",
  frutas: "Frutas", verduras: "Verduras", grasas: "Grasas y frutos secos",
  legumbres: "Legumbres", otros: "Otros",
}

function trendLine(points: WeightEntry[]): WeightEntry[] {
  if (points.length < 2) return points
  const n    = points.length
  const xMid = (n - 1) / 2
  const yAvg = points.reduce((s, p) => s + p.weight, 0) / n
  const num  = points.reduce((s, p, i) => s + (i - xMid) * (p.weight - yAvg), 0)
  const den  = points.reduce((s, _, i) => s + (i - xMid) ** 2, 0)
  const slope = den ? num / den : 0
  return points.map((p, i) => ({
    date:   p.date,
    weight: Math.round((yAvg + slope * (i - xMid)) * 10) / 10,
  }))
}

// NOTE: The new backend returns `type` and `name` directly on each meal object
// (per the unified spec model). MEAL_MAP lookup is therefore NOT used here —
// using it would silently overwrite correct backend values with stale frontend data.
// MEAL_MAP can be removed entirely once the backend migration is complete.
// `d` is typed as `any` intentionally: the backend response shape is being
// migrated from the old format. Once Task 5 (backend endpoints) is complete,
// this can be narrowed to a proper BackendPlanDay interface.
function transformPlanDay(d: any): PlanDay & { stale: boolean } {
  const meals: Meal[] = (d.meals ?? []).map((m: any) => {
    return {
      id:           m.id,
      type:         m.type,      // backend returns this directly
      name:         m.name ?? m.text ?? m.id,
      kcal:         m.kcal ?? 0,
      description:  m.text ?? m.description ?? "",
      note:         m.note ?? undefined,
      timingNote:   m.timing_note ?? undefined,
      adjustedKcal: m.adjusted_kcal ?? undefined,
      portionScale: m.portion_scale ?? undefined,
      fixedKcal:   m.fixedKcal ?? undefined,
      targetKcal:  m.targetKcal ?? undefined,
      carbG:       m.carb_g ?? undefined,
    }
  })
  return {
    date:        d.date,
    dayName:     d.dayName,
    meals,
    totalKcal:   d.totalKcal ?? meals.reduce((s, m) => s + m.kcal, 0),
    exerciseAdj: d.exerciseAdj
      ? {
          extraKcal:     d.exerciseAdj.extraKcal,
          source:        d.exerciseAdj.source,
          adjustedTotal: d.exerciseAdj.adjustedTotal,
        }
      : undefined,
    stale: d.stale ?? false,
  }
}

// ── API Functions ─────────────────────────────────────────────────────────────

export async function fetchDashboard(): Promise<DashboardData> {
  const d = await get<any>("/dashboard")
  const ex = d.exercise_data
  const macros = d.nutrition.macros
  const exHealth = ex?.health_data          // yesterday's health (from exercise history)
  const todayHealth = d.today_health        // today's health (steps, HR from Apple Health)

  // Exercise adjustment: if there's exercise data, daily_target already
  // includes it from the backend (TDEE + exercise adjustment).
  const dailyCalorieTarget = d.nutrition.daily_target

  return {
    dailyCalorieTarget,
    caloriesConsumed:   d.nutrition.consumed_kcal ?? 0,
    // Today's health data from Apple Health sync
    steps:              todayHealth?.steps ?? exHealth?.steps ?? null,
    heartRateAvg:       todayHealth?.heart_rate_avg ?? exHealth?.heart_rate_avg ?? null,
    activeCalories:     todayHealth?.active_calories ?? exHealth?.active_calories ?? null,
    macros: {
      protein: { current: 0, target: macros.protein_g },
      carbs:   { current: 0, target: macros.carb_g },
      fat:     { current: 0, target: macros.fat_g },
    },
    exerciseYesterday: ex?.burned_kcal > 0
      ? {
          type:           ex.session_type ?? exHealth?.workout_type ?? ex.exercises?.[0]?.name ?? "Ejercicio",
          minutes:        ex.duration_min ?? exHealth?.duration_min ?? ex.exercises?.[0]?.minutes ?? 0,
          caloriesBurned: ex.burned_kcal,
          steps:          exHealth?.steps ?? null,
          heartRateAvg:   exHealth?.heart_rate_avg ?? null,
        }
      : null,
    goalBalance: {
      goal:             d.goal_balance?.goal ?? d.profile?.goal ?? "maintain",
      targetAdjustment: d.goal_balance?.target_adjustment ?? 0,
      consumedKcal:     d.goal_balance?.consumed_kcal ?? 0,
      activeKcal:       d.goal_balance?.active_kcal ?? 0,
      netBalance:       d.goal_balance?.net_balance ?? 0,
      targetNet:        d.goal_balance?.target_net ?? dailyCalorieTarget,
    },
    alerts: d.alerts.map((a: any) => ({
      id:      a.type,
      type:    a.type.replace("_", "-") as any,
      message: a.message,
    })),
  }
}

export interface TodayAdherence {
  meals: Record<string, boolean>
  skippedMeals: Record<string, { foods: { name: string; kcal: number }[] }>
  consumedKcal: number
}

export async function fetchTodaysPlan(): Promise<PlanDay & { stale: boolean; adherence: TodayAdherence }> {
  const d = await get<any>("/diet/today")
  const adh = d.adherence ?? {}
  return {
    ...transformPlanDay(d),
    adherence: {
      meals:         adh.meals ?? {},
      skippedMeals:  adh.skipped_meals ?? {},
      consumedKcal:  adh.consumed_kcal ?? 0,
    },
  }
}

export async function swapMeal(mealId: string): Promise<PlanDay> {
  const d = await post<any>(`/diet/today/swap`, { meal_id: mealId })
  return transformPlanDay(d)
}

export async function swapWeeklyMeal(date: string, mealId: string): Promise<PlanDay> {
  const d = await post<any>(`/diet/weekly/swap`, { date, meal_id: mealId })
  return transformPlanDay(d)
}

export async function regenerateDay(): Promise<PlanDay & { stale: boolean }> {
  const d = await post<any>("/diet/today/regenerate")
  return transformPlanDay(d)
}

export async function updateAdherence(
  meals: Record<string, boolean>,
  kcalMap: Record<string, number> = {},
  skippedMeals: Record<string, { foods: { name: string; kcal: number }[] }> = {},
): Promise<{ consumed_kcal: number }> {
  return post<{ consumed_kcal: number }>("/adherence", {
    meals,
    kcal_map: kcalMap,
    skipped_meals: skippedMeals,
  })
}

export async function fetchWeeklyPlan(): Promise<WeeklyPlanResponse> {
  const d = await get<any>("/diet/weekly")
  const days: PlanDay[] = (d.days ?? []).map(transformPlanDay)
  return {
    days,
    summary: d.summary ?? null,
    stale:   d.stale ?? false,
  }
}

export async function fetchShoppingList(): Promise<{ category: string; items: string[] }[]> {
  const shoppingRaw = await get<any>("/diet/shopping-list")
  return Object.entries(shoppingRaw).map(([cat, items]: [string, any]) => ({
    category: CATEGORY_LABELS[cat] ?? cat,
    items:    items as string[],
  }))
}

export async function regenerateWeeklyPlan(
  applyFrom: "today" | "tomorrow" = "tomorrow"
): Promise<WeeklyPlanResponse> {
  const d = await post<any>("/diet/weekly/regenerate", { apply_from: applyFrom })
  const days: PlanDay[] = (d.days ?? []).map(transformPlanDay)
  return { days, summary: null, stale: false }
}

export async function fetchTraining(): Promise<TrainingData> {
  const [typesRaw, historyRaw, yesterdayRaw, todayRaw] = await Promise.all([
    get<any>("/exercise/types"),
    get<any>("/exercise/history?days=7"),
    get<any>("/exercise/yesterday"),
    get<any>("/exercise/today-training"),
  ])

  // El componente de v0 espera strings simples
  const exerciseTypes: string[] = Object.entries(typesRaw).map(
    ([key, val]: [string, any]) => `${key}|${val.name}`
  )

  const history: ExerciseLog[] = historyRaw.history
    .filter((e: any) => e.trained)
    .map((e: any) => ({
      id:             e.date,
      date:           e.date,
      type:           e.session_type
                        ?? e.health_data?.workout_type
                        ?? e.exercises?.[0]?.name
                        ?? "Ejercicio",
      minutes:        e.health_data?.duration_min ?? e.exercises?.[0]?.minutes ?? 0,
      caloriesBurned: e.burned_kcal,
      sources:        e.sources ?? (e.source ? [e.source] : []),
      healthData:     e.health_data ?? null,
    }))

  return {
    exerciseTypes,
    history,
    streak:           historyRaw.streak,
    totalKcal:        historyRaw.total_kcal,
    trainedDays:      historyRaw.trained_days,
    yesterdayExercise: yesterdayRaw,
    todayTraining:    todayRaw,
  }
}

export interface ExerciseImpact {
  type: "today" | "yesterday" | "this_week" | "past_week" | "scheduled"
  message: string
  in_current_week: boolean
  is_today: boolean
  is_yesterday: boolean
  is_future: boolean
}

export interface ExerciseLogByDateResult {
  ok: boolean
  date: string
  exercise_data: { burned_kcal: number; adjustment_kcal: number; exercises: unknown[] }
  impact: ExerciseImpact
}

export async function logExerciseForDate(data: {
  date: string
  type: string
  minutes: number
}): Promise<ExerciseLogByDateResult> {
  const key = data.type.includes("|") ? data.type.split("|")[0] : "4"
  return post<ExerciseLogByDateResult>("/exercise/log", {
    date:    data.date,
    rested:  false,
    entries: [{ exercise_key: key, minutes: data.minutes }],
  })
}

export interface GymExercise {
  name: string
  volume: number
  kg_s1: number
  reps_s1: number
  kg_s2: number
  reps_s2: number
  compound: boolean
}

export interface GymSession {
  date: string
  type: string
  kcal: number
  exercises: GymExercise[]
}

export interface GymHistoryData {
  source: "sheets" | "excel" | "none"
  sessions: GymSession[]
  credentials_configured: boolean
}

export async function fetchGymHistory(days = 7): Promise<GymHistoryData> {
  return get<GymHistoryData>(`/exercise/gym-history?days=${days}`)
}

export async function deleteExerciseByDate(date: string): Promise<void> {
  await del(`/exercise/log/${date}`)
}

export interface HealthData {
  active_calories: number
  workout_type: string | null
  duration_min: number | null
  steps: number | null
  heart_rate_avg: number | null
  heart_rate_max: number | null
}

export interface HealthSyncResult {
  ok: boolean
  date: string
  burned_kcal: number
  adjustment_kcal: number
  sources: string[]
  had_gym_detail: boolean
}

export async function syncHealthData(data: {
  date: string
  active_calories: number
  workout_type?: string
  duration_min?: number
  steps?: number
  heart_rate_avg?: number
  heart_rate_max?: number
}): Promise<HealthSyncResult> {
  return post<HealthSyncResult>("/health/sync", data)
}

// Alias que usa el componente de v0 directamente
export async function logExercise(data: { type: string; minutes: number }): Promise<ExerciseLog> {
  // type viene en formato "key|nombre" o como nombre libre
  const key = data.type.includes("|") ? data.type.split("|")[0] : "4"
  await post("/exercise/yesterday", {
    rested: false,
    entries: [{ exercise_key: key, minutes: data.minutes }],
  })
  return {
    id:            Date.now().toString(),
    date:          new Date().toISOString().slice(0, 10),
    type:          data.type.includes("|") ? data.type.split("|")[1] : data.type,
    minutes:       data.minutes,
    caloriesBurned: 0,
  }
}

export async function generateRoutine(params: {
  type: "gym" | "calisthenics"
  daysPerWeek: number
}): Promise<ExerciseRoutine[]> {
  return fetchRoutine({
    type: params.type === "calisthenics" ? "calistenia" : "gym",
    days: params.daysPerWeek,
  })
}

export async function logYesterdayExercise(data: {
  rested: boolean
  entries: { exercise_key: string; minutes: number }[]
}): Promise<void> {
  await post("/exercise/yesterday", data)
}

export async function logTodayTraining(data: {
  trains: boolean
  exercise_key?: string
}): Promise<void> {
  await post("/exercise/today-training", data)
}

export async function fetchRoutine(params: {
  type: "gym" | "calistenia"
  days: number
  level?: string
  has_barra?: boolean
  has_paralelas?: boolean
}): Promise<ExerciseRoutine[]> {
  if (params.type === "gym") {
    const d = await get<any>(`/training/routine?days=${params.days}&type=gym`)
    return d.day_plan.map((day: any) => ({
      day:       String(day.day),
      label:     day.label,
      exercises: day.exercises.map((e: any) => ({
        name: e.name, sets: e.sets, muscles: e.muscles,
      })),
    }))
  } else {
    const q = new URLSearchParams({
      days:          String(params.days),
      level:         params.level ?? "intermedio",
      has_barra:     String(params.has_barra ?? true),
      has_paralelas: String(params.has_paralelas ?? true),
    })
    const d = await get<any>(`/training/calistenia?${q}`)
    return d.day_plan.map((day: any) => ({
      day:   String(day.day),
      label: day.label,
      exercises: day.blocks.flatMap((b: any) =>
        b.exercises.map((e: any) => ({
          name: `[${b.block}] ${e.name}`, sets: e.sets, muscles: e.muscles,
        }))
      ),
    }))
  }
}

export async function fetchProgress(): Promise<ProgressData> {
  const [weightRaw, adherenceRaw] = await Promise.all([
    get<any>("/weight/history"),
    get<any>("/adherence?days=28").catch(() => ({ history: [], weekly_average: 0 })),
  ])

  const weightHistory: WeightEntry[] = (weightRaw.history ?? []).map((e: any) => ({
    date:   e.date,
    weight: e.weight_kg,
  }))

  const byWeekMap: Record<string, number[]> = {}
  for (const e of adherenceRaw.history) {
    if (!e.has_data) continue
    const week = e.date.slice(0, 7)   // "2026-03"
    byWeekMap[week] = byWeekMap[week] ?? []
    byWeekMap[week].push(e.pct)
  }
  const adherenceByWeek = Object.entries(byWeekMap).map(([week, vals]) => ({
    week,
    adherence: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
  }))

  return {
    weightHistory,
    trendLine:      trendLine(weightHistory),
    currentWeight:  weightRaw.current_weight,
    needsWeighIn:   weightRaw.needs_weigh_in,
    expectedWeekly: weightRaw.expected_weekly,
    analysis: weightRaw.analysis
      ? {
          totalChange:   weightRaw.analysis.total_change,
          realWeekly:    weightRaw.analysis.real_weekly,
          expectedWeekly: weightRaw.analysis.expected_weekly,
          status:        weightRaw.analysis.status,
          message:       weightRaw.analysis.message,
        }
      : null,
    adherenceByWeek,
  }
}

export async function logWeight(weight: number): Promise<void> {
  await post("/weight", { weight_kg: weight })
}

export async function fetchWeeklyReport(): Promise<WeeklyReportData> {
  const [reportRaw, surveyRaw] = await Promise.all([
    get<any>("/report/weekly"),
    get<any>("/survey"),
  ])

  const last = surveyRaw.last_scores
  const survey = last?.energia
    ? {
        energy:  last.energia,
        sleep:   last.sueno,
        mood:    last.adherencia,
        hunger:  last.hambre,
      }
    : null

  return {
    daysTrained:      reportRaw.exercise.days_trained,
    totalKcalBurned:  reportRaw.exercise.kcal_burned,
    adherencePercent: reportRaw.adherence,
    weightChange:     reportRaw.weight.change,
    currentWeight:    reportRaw.weight.current,
    sensationsSurvey: survey,
    recommendations:  reportRaw.recommendations,
    needsSurvey:      surveyRaw.needs_survey,
  }
}

export async function submitSensationsSurvey(data: {
  energy: number
  sleep: number
  mood: number
  hunger: number
}): Promise<void> {
  await post("/survey", {
    energia:    data.energy,
    sueno:      data.sleep,
    adherencia: data.mood,
    hambre:     data.hunger,
  })
}

export async function fetchSettings(): Promise<SettingsData> {
  // Profile is fetched alone — if it fails the whole function throws (correct).
  // Preferences and event failures are tolerated so they don't mask the profile.
  const profileRaw = await get<any>("/profile")

  const [prefsRaw, eventRaw] = await Promise.all([
    get<any>("/preferences").catch(() => ({ excluded: [], favorites: [], disliked: [] })),
    get<any>("/event").catch(() => ({ has_event: false })),
  ])

  return {
    profile: {
      name:          profileRaw.name,
      gender:        profileRaw.gender,
      age:           profileRaw.age,
      height:        profileRaw.height_cm,
      weight:        profileRaw.weight_kg,
      activityLevel: profileRaw.activity_level,
      goal:          profileRaw.goal,
      weekStartDay:  profileRaw.week_start_day ?? 0,
    },
    foodPreferences: {
      excluded:  prefsRaw.excluded  ?? [],
      favorites: prefsRaw.favorites ?? [],
      disliked:  prefsRaw.disliked  ?? [],
    },
    events: eventRaw.has_event
      ? [{
          id:          eventRaw.date,
          name:        eventRaw.name,
          date:        eventRaw.date,
          daysToEvent: eventRaw.days_to_event,
          message:     eventRaw.message,
        }]
      : [],
  }
}

export async function updateProfile(profile: UserProfile): Promise<UserProfile> {
  const res = await put<any>("/profile", {
    name:            profile.name,
    gender:          profile.gender,
    age:             profile.age,
    height_cm:       profile.height,
    weight_kg:       profile.weight,
    activity_level:  profile.activityLevel,
    goal:            profile.goal,
    week_start_day:  profile.weekStartDay,
  })
  // Backend returns { ok, profile } — map back to frontend shape
  const p = res.profile
  return {
    name:          p.name,
    gender:        p.gender,
    age:           p.age,
    height:        p.height_cm,
    weight:        p.weight_kg,
    activityLevel: p.activity_level,
    goal:          p.goal,
    weekStartDay:  p.week_start_day ?? 0,
  }
}

export async function updateFoodPreferences(preferences: FoodPreferences): Promise<FoodPreferences> {
  const res = await put<any>("/preferences", preferences)
  return res.preferences as FoodPreferences
}

export async function saveEvent(event: { name: string; date: string }): Promise<void> {
  await post("/event", event)
}

export async function deleteEvent(): Promise<void> {
  await del("/event")
}

export async function fetchFavoriteCarbs(): Promise<FavoriteCarb[]> {
  const d = await get<any>("/diet/carbs")
  return d.carbs ?? []
}

// ── Gamificación ──────────────────────────────────────────────────────────────

export interface GamificationStatus {
  level: number
  name: string
  xp: number
  xp_in_level: number
  xp_to_next: number
  xp_next_level: number
  progress_pct: number
  is_max_level: boolean
  next_level_name: string | null
  breakdown: {
    training: number
    diet: number
    combo: number
    weight: number
    surveys: number
    streak: number
  }
}

export async function fetchGamification(): Promise<GamificationStatus> {
  return get<GamificationStatus>("/gamification/status")
}

// ── PDF Export ─────────────────────────────────────────────────────────────────

export function getReportPdfUrl(): string {
  return `${API_BASE}/report/download`
}

// ── Food Search (OpenFoodFacts) ──────────────────────────────────────────────

export interface FoodSearchResult {
  name: string
  kcal_100g: number
  image: string | null
}

export async function searchFood(query: string): Promise<FoodSearchResult[]> {
  if (query.length < 2) return []
  const d = await get<{ results: FoodSearchResult[] }>(`/food/search?q=${encodeURIComponent(query)}`)
  return d.results
}
