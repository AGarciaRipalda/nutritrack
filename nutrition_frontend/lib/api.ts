const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : "http://localhost:8000")

// ── Helpers ───────────────────────────────────────────────────────────────────

// Bypass ngrok browser-warning interstitial (no-op for non-ngrok URLs)
const COMMON_HEADERS: Record<string, string> = {
  "ngrok-skip-browser-warning": "true",
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    headers: COMMON_HEADERS,
  })
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`)
  return res.json()
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: body
      ? { ...COMMON_HEADERS, "Content-Type": "application/json" }
      : COMMON_HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`)
  return res.json()
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: { ...COMMON_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`PUT ${path} failed: ${res.status}`)
  return res.json()
}

async function del(path: string): Promise<void> {
  await fetch(`${API_BASE}${path}`, { method: "DELETE", headers: COMMON_HEADERS })
}

// ── Tipos públicos (usados por los componentes de v0) ─────────────────────────

export interface DashboardData {
  dailyCalorieTarget: number
  caloriesConsumed: number
  macros: {
    protein: { current: number; target: number }
    carbs: { current: number; target: number }
    fat: { current: number; target: number }
  }
  exerciseYesterday: {
    type: string
    minutes: number
    caloriesBurned: number
  } | null
  alerts: {
    id: string
    type: "weigh-in" | "survey" | "event" | "weekly_report"
    message: string
    dueDate?: string
  }[]
}

export interface Meal {
  id: string
  type: string
  name: string
  kcal: number
  description: string
  tip: string
  timingNote?: string
}

export interface TodaysDiet {
  meals: Meal[]
  totalKcal: number
  targetKcal: number
  eventMsg?: string
  adherenceChecklist: { id: string; label: string; checked: boolean }[]
}

export interface WeeklyMeal {
  text: string
  kcal: number
  note: string
}

export interface WeeklyPlan {
  days: {
    day: string
    meals: {
      breakfast: WeeklyMeal
      midMorning: WeeklyMeal
      lunch: WeeklyMeal
      snack: WeeklyMeal
      dinner: WeeklyMeal
    }
  }[]
  shoppingList: { category: string; items: string[] }[]
}

export interface ExerciseLog {
  id: string
  date: string
  type: string
  minutes: number
  caloriesBurned: number
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

// ── API Functions ─────────────────────────────────────────────────────────────

export async function fetchDashboard(): Promise<DashboardData> {
  const d = await get<any>("/dashboard")
  const ex = d.exercise_data
  const macros = d.nutrition.macros

  return {
    dailyCalorieTarget: d.nutrition.daily_target,
    caloriesConsumed:   0,   // no se rastrea en tiempo real
    macros: {
      protein: { current: 0, target: macros.protein_g },
      carbs:   { current: 0, target: macros.carb_g },
      fat:     { current: 0, target: macros.fat_g },
    },
    exerciseYesterday: ex?.burned_kcal > 0
      ? {
          type:          ex.exercises?.[0]?.name ?? "Ejercicio",
          minutes:       ex.exercises?.[0]?.minutes ?? 0,
          caloriesBurned: ex.burned_kcal,
        }
      : null,
    alerts: d.alerts.map((a: any) => ({
      id:      a.type,
      type:    a.type.replace("_", "-") as any,
      message: a.message,
    })),
  }
}

export async function fetchTodaysDiet(): Promise<TodaysDiet> {
  const d = await get<any>("/diet/today")
  // Las comidas pueden estar en d.meals (nuevo formato) o en el top-level (legado)
  const mealsSource = d.meals ?? d
  const meals: Meal[] = MEAL_ORDER
    .filter(key => mealsSource[key])
    .map(key => {
      const m    = mealsSource[key]
      const meta = MEAL_MAP[key] ?? { type: key, label: key }
      return {
        id:          key,
        type:        meta.type,
        name:        meta.label,
        kcal:        m.kcal ?? 0,
        description: m.text ?? "",
        tip:         m.note ?? "",
        timingNote:  m.timing_note ?? "",
      }
    })

  const totalKcal = meals.reduce((s, m) => s + m.kcal, 0)

  return {
    meals,
    totalKcal,
    targetKcal:  d.daily_target ?? 0,
    eventMsg:    d.event_msg ?? "",
    adherenceChecklist: meals.map(m => ({
      id:      m.id,
      label:   m.name,
      checked: false,
    })),
  }
}

export async function swapMeal(mealId: string): Promise<TodaysDiet> {
  const d = await post<any>(`/diet/today/${mealId}/swap`)
  return transformDayToTodaysDiet(d)
}

export async function regenerateDay(): Promise<TodaysDiet> {
  const d = await post<any>("/diet/today/regenerate")
  return transformDayToTodaysDiet(d)
}

function transformDayToTodaysDiet(d: any): TodaysDiet {
  const mealsSource = d.meals ?? d
  const meals: Meal[] = MEAL_ORDER
    .filter(key => mealsSource[key])
    .map(key => {
      const m    = mealsSource[key]
      const meta = MEAL_MAP[key] ?? { type: key, label: key }
      return {
        id: key, type: meta.type, name: meta.label,
        kcal: m.kcal ?? 0, description: m.text ?? "",
        tip: m.note ?? "", timingNote: m.timing_note ?? "",
      }
    })
  return {
    meals,
    totalKcal:   meals.reduce((s, m) => s + m.kcal, 0),
    targetKcal:  d.daily_target ?? 0,
    eventMsg:    d.event_msg ?? "",
    adherenceChecklist: meals.map(m => ({ id: m.id, label: m.name, checked: false })),
  }
}

export async function updateAdherence(meals: Record<string, boolean>): Promise<void> {
  await post("/adherence", { meals })
}

export async function fetchWeeklyPlan(): Promise<WeeklyPlan> {
  const [planRaw, shoppingRaw] = await Promise.all([
    get<any>("/diet/weekly"),
    get<any>("/diet/shopping-list"),
  ])

  const toWeeklyMeal = (v: any): WeeklyMeal => {
    if (!v) return { text: "—", kcal: 0, note: "" }
    if (typeof v === "string") return { text: v, kcal: 0, note: "" }
    return { text: v.text ?? "—", kcal: v.kcal ?? 0, note: v.note ?? "" }
  }

  const days = Object.entries(planRaw).map(([key, val]: [string, any]) => ({
    day: DAYS_ES[key] ?? key,
    meals: {
      breakfast:  toWeeklyMeal(val.desayuno),
      midMorning: toWeeklyMeal(val.media_manana),
      lunch:      toWeeklyMeal(val.almuerzo),
      snack:      toWeeklyMeal(val.merienda),
      dinner:     toWeeklyMeal(val.cena),
    },
  }))

  const shoppingList = Object.entries(shoppingRaw).map(([cat, items]: [string, any]) => ({
    category: CATEGORY_LABELS[cat] ?? cat,
    items:    items as string[],
  }))

  return { days, shoppingList }
}

export async function regenerateWeeklyPlan(): Promise<WeeklyPlan> {
  await post("/diet/weekly/regenerate")
  return fetchWeeklyPlan()
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
      id:            e.date,
      date:          e.date,
      type:          e.exercises?.[0]?.name ?? "Ejercicio",
      minutes:       e.exercises?.[0]?.minutes ?? 0,
      caloriesBurned: e.burned_kcal,
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
    name:           profile.name,
    gender:         profile.gender,
    age:            profile.age,
    height_cm:      profile.height,
    weight_kg:      profile.weight,
    activity_level: profile.activityLevel,
    goal:           profile.goal,
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
