# Local Mode Foundation — Spec

**Date:** 2026-03-25
**Sub-project:** 1 of 2
**Status:** Draft

---

## Goal

This sub-project delivers the complete offline-capable foundation for the Metabolic iOS/Android app: a SQLite storage layer (via `@capacitor-community/sqlite`) and a set of pure TypeScript calculation modules that replicate all Python backend logic. When this sub-project is complete, a native Capacitor build can read and write all user data locally and compute every nutrition, exercise, gamification, and training result without any network call. Sub-project 2 will wire these modules into the existing Next.js pages through a `platform-api.ts` routing layer.

---

## Scope

### In Scope

- Install and configure `@capacitor-community/sqlite` v6
- `lib/db/schema.ts` — SQLite schema initialization (8 tables, `CREATE TABLE IF NOT EXISTS`)
- `lib/db/profile.ts` — CRUD for profile, preferences, events
- `lib/db/logs.ts` — CRUD for exercise logs, weight history, adherence log, weekly surveys
- `lib/db/meals.ts` — CRUD for cached meal plans
- `lib/engine/calculator.ts` — BMR / TDEE / daily target / macros (pure functions)
- `lib/engine/exercise.ts` — MET calorie burn, exercise adjustment (pure functions)
- `lib/engine/gamification.ts` — XP accumulation and level info (pure functions)
- `lib/engine/report.ts` — Weekly report generation (pure functions)
- `lib/engine/diet.ts` — Day and week meal plan generation, including all meal template data
- `lib/engine/training.ts` — Weights and calisthenics routine generation, including all exercise data
- `lib/types/local.ts` — New TypeScript types not already in `lib/api.ts`
- Unit-test scaffolding for calculation modules (test files with at least one test each)

### Out of Scope

- Wiring Next.js pages to use local data (Sub-project 2)
- `platform-api.ts` routing layer / web vs. native branching (Sub-project 2)
- iCloud / Google Drive backup
- PDF export
- Apple Health integration
- Push notifications
- Any UI changes

---

## Tech Stack

| Layer | Technology |
|---|---|
| Local database | `@capacitor-community/sqlite` v6 |
| Calculation modules | Pure TypeScript functions, zero side effects, no imports from DB layer |
| App framework | Next.js 15 + Capacitor 8 (already in `package.json`) |
| Language | TypeScript 5 (already configured) |
| Testing | Vitest or Jest (implementer's choice; no existing test runner configured) |

Install command:

```
npm install @capacitor-community/sqlite
npx cap sync
```

On iOS, also add `CapacitorSQLite.swift` to the Xcode project following the plugin's README. On Android, no extra steps beyond `cap sync`.

---

## Database Schema

All tables are created in `lib/db/schema.ts` via `initializeDatabase()`. Use `CREATE TABLE IF NOT EXISTS` for all.

### Table: `profile`

Stores the single user profile. There is always exactly one row (upsert by `id = 1`).

| Column | Type | Notes |
|---|---|---|
| `id` | `INTEGER PRIMARY KEY` | Always 1 |
| `name` | `TEXT NOT NULL` | Display name |
| `gender` | `TEXT NOT NULL` | `'male'` or `'female'` |
| `age` | `INTEGER NOT NULL` | |
| `height_cm` | `REAL NOT NULL` | |
| `weight_kg` | `REAL NOT NULL` | Current body weight |
| `activity_level` | `INTEGER NOT NULL` | 1–4 (see ACTIVITY_LEVELS constant) |
| `goal` | `TEXT NOT NULL` | `'lose'`, `'maintain'`, or `'gain'` |
| `week_start_day` | `INTEGER NOT NULL DEFAULT 0` | 0 = Monday |
| `updated_at` | `TEXT` | ISO datetime string |

### Table: `preferences`

Stores exclusion/favorites preferences for the diet generator. One row per preference type.

| Column | Type | Notes |
|---|---|---|
| `id` | `INTEGER PRIMARY KEY AUTOINCREMENT` | |
| `key` | `TEXT NOT NULL UNIQUE` | `'excluded'`, `'favorites'`, `'disliked'` |
| `value_json` | `TEXT NOT NULL` | JSON array of strings |
| `updated_at` | `TEXT` | ISO datetime string |

### Table: `events`

Upcoming competition or target events shown as alerts on the dashboard.

| Column | Type | Notes |
|---|---|---|
| `id` | `INTEGER PRIMARY KEY AUTOINCREMENT` | |
| `name` | `TEXT NOT NULL` | Event name |
| `date` | `TEXT NOT NULL` | ISO date string `'YYYY-MM-DD'` |

### Table: `exercise_logs`

One row per exercise session logged. Multiple sessions on the same day are allowed.

| Column | Type | Notes |
|---|---|---|
| `id` | `INTEGER PRIMARY KEY AUTOINCREMENT` | |
| `date` | `TEXT NOT NULL` | ISO date `'YYYY-MM-DD'` |
| `exercise_key` | `TEXT NOT NULL` | Key from EXERCISES constant (e.g. `'4'`) |
| `type` | `TEXT NOT NULL` | Human-readable name (e.g. `'Pesas gym — intensidad moderada'`) |
| `minutes` | `INTEGER NOT NULL` | |
| `calories_burned` | `REAL NOT NULL` | MET-calculated kcal |
| `source` | `TEXT DEFAULT 'manual'` | `'manual'` or `'apple_health'` |
| `created_at` | `TEXT` | ISO datetime string |

### Table: `weight_history`

One row per weigh-in event.

| Column | Type | Notes |
|---|---|---|
| `id` | `INTEGER PRIMARY KEY AUTOINCREMENT` | |
| `date` | `TEXT NOT NULL UNIQUE` | ISO date `'YYYY-MM-DD'` |
| `weight_kg` | `REAL NOT NULL` | |

### Table: `adherence_log`

Tracks whether each scheduled meal was eaten (compliant) or skipped/violated. One row per meal per day.

| Column | Type | Notes |
|---|---|---|
| `id` | `INTEGER PRIMARY KEY AUTOINCREMENT` | |
| `date` | `TEXT NOT NULL` | ISO date `'YYYY-MM-DD'` |
| `meal_id` | `TEXT NOT NULL` | `'desayuno'`, `'media_manana'`, `'almuerzo'`, `'merienda'`, `'cena'` |
| `status` | `TEXT NOT NULL` | `'compliant'` or `'non_compliant'` |
| UNIQUE | `(date, meal_id)` | One status per meal per day |

### Table: `survey_history`

Weekly wellbeing surveys (1–5 scores). One row per survey submission.

| Column | Type | Notes |
|---|---|---|
| `id` | `INTEGER PRIMARY KEY AUTOINCREMENT` | |
| `date` | `TEXT NOT NULL` | ISO date of submission |
| `energy` | `INTEGER NOT NULL` | 1–5 (`energia`) |
| `sleep` | `INTEGER NOT NULL` | 1–5 (`sueno`) |
| `mood` | `INTEGER NOT NULL` | 1–5 (`adherencia` perceived) |
| `hunger` | `INTEGER NOT NULL` | 1–5 (`hambre`) |

### Table: `meal_plans`

Full cached weekly plan stored as JSON. One row per week.

| Column | Type | Notes |
|---|---|---|
| `id` | `INTEGER PRIMARY KEY AUTOINCREMENT` | |
| `week_start` | `TEXT NOT NULL UNIQUE` | ISO date of Monday of that week |
| `plan_json` | `TEXT NOT NULL` | JSON-serialized `WeekPlan` object |
| `generated_at` | `TEXT` | ISO datetime string |

---

## Calculation Engine (`lib/engine/`)

All modules are pure functions with no side effects and no imports from `lib/db/`. They can be tested in Node.js without Capacitor.

---

### `lib/engine/calculator.ts`

Ported from `nutrition_assistant/calculator.py`.

#### Constants

```typescript
export const ACTIVITY_LEVELS: Record<number, { name: string; description: string; factor: number }> = {
  1: { name: "Sedentario",           description: "Poco o ningún ejercicio",               factor: 1.2   },
  2: { name: "Ligeramente activo",   description: "Ejercicio ligero 1-3 días/semana",      factor: 1.375 },
  3: { name: "Moderadamente activo", description: "Ejercicio moderado 3-5 días/semana",    factor: 1.55  },
  4: { name: "Muy activo",           description: "Ejercicio intenso 6-7 días/semana",     factor: 1.725 },
}

// NEAT = Non-Exercise Activity Thermogenesis
// Reflects daily life activity WITHOUT planned exercise
export const NEAT_FACTORS: Record<number, number> = {
  1: 1.20,  // Sedentary
  2: 1.30,  // Lightly active (walking, partial standing work)
  3: 1.40,  // Moderately active (light physical work, lots of movement)
  4: 1.50,  // Very active (intense physical work)
}

export const GOAL_ADJUSTMENTS: Record<string, number> = {
  lose:     -300,
  maintain:    0,
  gain:     +300,
}

// Protein per goal (g/kg body weight)
export const PROTEIN_FACTORS: Record<string, number> = {
  lose:     2.4,  // Higher in deficit to protect muscle (Helms et al., 2014)
  maintain: 2.0,
  gain:     2.0,
}

// Fat per goal (g/kg body weight)
export const FAT_FACTORS: Record<string, number> = {
  lose:     0.8,
  maintain: 1.0,
  gain:     1.0,
}
```

#### Exported Functions

**`calculateBMR(gender: string, age: number, heightCm: number, weightKg: number): number`**

Mifflin-St. Jeor formula:
- Male: `10 * weightKg + 6.25 * heightCm - 5 * age + 5`
- Female: `10 * weightKg + 6.25 * heightCm - 5 * age - 161`

Returns a floating-point number (raw BMR, not rounded).

**`calculateTDEE(bmr: number, activityLevel: number): number`**

Reference TDEE for display purposes only (not used for daily target):
`bmr * ACTIVITY_LEVELS[activityLevel].factor`

**`calculateDailyTarget(bmr: number, goal: string, exerciseAdjustment: number, activityLevel: number): number`**

Adaptive daily calorie target:
1. `neat = NEAT_FACTORS[activityLevel] ?? 1.20`
2. `base = bmr * neat`
3. `target = base + (GOAL_ADJUSTMENTS[goal] ?? 0) + exerciseAdjustment`
4. Return `Math.round(target)`

The `exerciseAdjustment` is the calorie recovery from yesterday's logged exercise (output of `calculateExerciseAdjustment` in `exercise.ts`).

**`calculateMacros(weightKg: number, targetKcal: number, goal: string): MacroResult`**

```
protein_g    = weightKg * PROTEIN_FACTORS[goal]
fat_g        = weightKg * FAT_FACTORS[goal]
protein_kcal = protein_g * 4
fat_kcal     = fat_g * 9
carb_kcal    = targetKcal - protein_kcal - fat_kcal
carb_g       = Math.max(carb_kcal / 4, 0)
```

Returns:
```typescript
{
  targetKcal: number   // the input targetKcal
  proteinG:   number   // Math.round(protein_g)
  fatG:       number   // Math.round(fat_g)
  carbG:      number   // Math.round(carb_g)
}
```

---

### `lib/engine/exercise.ts`

Ported from `nutrition_assistant/exercise_log.py`.

#### Constants

```typescript
// MET = Metabolic Equivalent of Task
// Source: Compendium of Physical Activities (Ainsworth et al.)
export const EXERCISES: Record<string, { name: string; met: number }> = {
  "1": { name: "Caminar  —  10 min/km (6.0 km/h)",          met: 5.0 },
  "2": { name: "Caminar  —   9 min/km (6.7 km/h)",          met: 6.0 },
  "3": { name: "Pesas gym  —  intensidad ligera",            met: 3.5 },
  "4": { name: "Pesas gym  —  intensidad moderada",          met: 5.0 },
  "5": { name: "Pesas gym  —  intensidad alta",              met: 6.0 },
  "6": { name: "Calistenia parque  —  intensidad moderada",  met: 5.5 },
  "7": { name: "Calistenia parque  —  intensidad alta",      met: 8.0 },
}

// Recovery factor: how much of burned kcal is added back to today's target
export const RECOVERY_FACTOR: Record<string, number> = {
  lose:     0.85,  // Recover 85% — 15% gap + GOAL_ADJUSTMENT maintains deficit without catabolism
  maintain: 1.00,
  gain:     1.10,
}

// Pre-fuel bonus kcal for training today (by exercise key)
export const TODAY_BONUS_KCAL: Record<string, number> = {
  "1": 150,  // walking light
  "2": 200,  // walking fast
  "3": 200,  // weights light
  "4": 300,  // weights moderate
  "5": 400,  // weights high
  "6": 300,  // calisthenics moderate
  "7": 450,  // calisthenics high
}

// Maps exercise key to training timing label
export const TODAY_TIMING: Record<string, string> = {
  "1": "cardio", "2": "cardio",
  "3": "fuerza", "4": "fuerza", "5": "fuerza",
  "6": "fuerza", "7": "fuerza",
}
```

#### Exported Functions

**`calculateCaloriesBurned(exerciseKey: string, minutes: number, weightKg: number): number`**

MET formula: `EXERCISES[exerciseKey].met * weightKg * (minutes / 60)`

Returns raw float (not rounded — caller rounds if needed).

**`calculateExerciseAdjustment(burnedKcal: number, goal: string): number`**

`Math.round(burnedKcal * (RECOVERY_FACTOR[goal] ?? 1.0))`

Returns the kcal to add to today's daily target.

**`getTodayBonus(exerciseKey: string): { bonusKcal: number; trainingType: string }`**

Returns `{ bonusKcal: TODAY_BONUS_KCAL[exerciseKey] ?? 250, trainingType: TODAY_TIMING[exerciseKey] ?? 'fuerza' }`.

---

### `lib/engine/gamification.ts`

Ported from `nutrition_assistant/gamification.py`.

#### Constants

```typescript
export const LEVELS = [
  { level: 1, name: "Principiante", xpRequired: 0     },
  { level: 2, name: "Constante",    xpRequired: 200   },
  { level: 3, name: "Atleta",       xpRequired: 500   },
  { level: 4, name: "Dedicado",     xpRequired: 1_000 },
  { level: 5, name: "Élite",        xpRequired: 2_000 },
  { level: 6, name: "Leyenda",      xpRequired: 4_000 },
]

export const XP = {
  TRAINING:         20,  // day with any exercise logged
  TRAINING_HEALTH:   5,  // bonus if source is 'apple_health'
  DIET_DAY:         15,  // day with adherence >= 80%
  COMBO:            10,  // same day: diet + exercise
  WEIGHT_CHECKIN:   10,  // weight entry logged
  SURVEY:           30,  // weekly survey completed
  STREAK_WEEK:      50,  // per completed block of 7 consecutive training days
}
```

#### Exported Functions

**`calculateGamification(params: GamificationInput): GamificationResult`**

Input type:
```typescript
interface GamificationInput {
  exerciseLogs:  ExerciseLogRow[]   // all exercise logs from DB
  adherenceLogs: AdherenceRow[]     // all adherence entries from DB
  weightHistory: WeightEntryRow[]   // all weight entries from DB
  surveys:       SurveyRow[]        // all survey entries from DB
}
```

Algorithm (pure — receives data from caller, does not read DB):

1. **Training XP**: For each unique date in `exerciseLogs` where `calories_burned > 0`:
   - Add `XP.TRAINING`
   - If any entry on that date has `source === 'apple_health'`, add `XP.TRAINING_HEALTH`
   - Track this date in `trainedDates: Set<string>`

2. **Diet XP**: For each date in `adherenceLogs`, compute the percentage of meals marked `'compliant'` that day. If `pct >= 80`, add `XP.DIET_DAY`. Track in `dietDays: Set<string>`.

   Adherence pct per day: `(compliant_meals / total_meals_that_day) * 100`

3. **Combo XP**: For each date in the intersection of `trainedDates` and `dietDays`, add `XP.COMBO`.

4. **Weight XP**: For each entry in `weightHistory`, add `XP.WEIGHT_CHECKIN`.

5. **Survey XP**: For each entry in `surveys`, add `XP.SURVEY`.

6. **Streak bonus**: Sort `trainedDates` ascending. Walk through consecutive pairs:
   - If two adjacent dates are exactly 1 day apart, increment `streak`.
   - If `streak % 7 === 0`, increment `completedWeeks`.
   - If gap > 1 day, reset `streak = 1`.
   - Final streak XP = `completedWeeks * XP.STREAK_WEEK`.

Returns `GamificationResult`.

**`getLevelInfo(xp: number): LevelInfo`**

Walk `LEVELS` ascending. The current level is the highest one where `xp >= xpRequired`. Compute:
- `xpInLevel = xp - currentLevel.xpRequired`
- `xpToNext = nextLevel ? nextLevel.xpRequired - xp : 0`
- `progressPct = nextLevel ? Math.round(xpInLevel / (nextLevel.xpRequired - currentLevel.xpRequired) * 100) : 100`
- `isMaxLevel = nextLevel === undefined`

---

### `lib/engine/report.ts`

Ported from `nutrition_assistant/weekly_report.py`.

#### Exported Functions

**`generateWeeklyReport(params: WeeklyReportInput): WeeklyReport`**

Input type:
```typescript
interface WeeklyReportInput {
  goal:          string
  exerciseLogs:  ExerciseLogRow[]   // last 7 days
  weightHistory: WeightEntryRow[]   // all weight entries
  adherenceLogs: AdherenceRow[]     // last 7 days
  survey:        SurveyRow | null   // most recent survey
}
```

Algorithm:

1. **Exercise stats** (from `exerciseLogs` for the trailing 7 days):
   - `exDays` = count of unique dates with `calories_burned > 0`
   - `exKcal` = sum of `calories_burned` across all entries

2. **Weight change**: From `weightHistory`, find the most recent entry (`currW`) and the most recent entry at least 5 days earlier (`prevW`). `weightChange = currW - prevW` (rounded to 1 decimal). If either is missing, `weightChange = null`.

3. **Adherence pct** (from `adherenceLogs`): Count compliant vs. total entries. `adherencePct = Math.round((compliant / total) * 100)`.

4. **Recommendations** (string array, same logic as Python):
   - If `adherencePct < 60`: "Tu adherencia fue baja esta semana. ¿El plan es demasiado estricto? Prueba a añadir más favoritos o ajustar las porciones."
   - If `adherencePct >= 85`: "Excelente adherencia al plan. ¡Sigue así!"
   - If `exDays === 0`: "No registraste ejercicio esta semana. Incluso caminar 30 min/día puede marcar la diferencia."
   - If `exDays >= 5`: `"Entrenaste ${exDays} días. Asegúrate de descansar al menos 2 días/semana."`
   - Weight change checks (by goal):
     - `lose` and `weightChange > 0.1`: suggest reduce 100–150 kcal at dinner
     - `lose` and `weightChange < -1.0`: suggest increase carbs slightly
     - `gain` and `weightChange < 0.1`: suggest extra carb serving post-workout
     - `maintain` and `Math.abs(weightChange) > 0.8`: suggest reviewing portions
     - Otherwise: `"Cambio de peso: ${weightChange >= 0 ? '+' : ''}${weightChange?.toFixed(1)} kg — dentro del rango esperado."`
   - If `survey.energy <= 2`: suggest breakfast quality
   - If `survey.sleep <= 2`: suggest carb timing at dinner
   - If no recommendations generated: "Semana equilibrada. Mantén el rumbo y sigue el plan."

Returns `WeeklyReport`.

---

### `lib/engine/diet.ts`

Ported from `nutrition_assistant/diet.py`. This module contains all meal template data.

#### Constants

```typescript
export const CARB_SOURCES: Record<string, { name: string; kcal: number }> = {
  pan_centeno:   { name: "pan de centeno",                          kcal: 259 },
  pan_integral:  { name: "pan integral",                            kcal: 247 },
  pan_thins:     { name: "pan thins",                               kcal: 295 },
  pan_semillas:  { name: "pan de semillas",                         kcal: 270 },
  avena:         { name: "harina de avena",                         kcal: 367 },
  cereales:      { name: "cereales (crunchy/corn flakes/espelta)",  kcal: 375 },
  espaguetis:    { name: "espaguetis",                              kcal: 357 },
  pasta:         { name: "pasta",                                   kcal: 357 },
  arroz:         { name: "arroz basmati",                           kcal: 346 },
  noquis:        { name: "ñoquis (cocidos)",                        kcal: 130 },
  patata:        { name: "patata",                                  kcal: 77  },
  boniato:       { name: "boniato",                                 kcal: 86  },
  lentejas:      { name: "lentejas cocidas",                        kcal: 116 },
  garbanzos:     { name: "garbanzos cocidos",                       kcal: 164 },
  crackers:      { name: "crackers",                                kcal: 430 },
  tortita_arroz: { name: "tortitas de arroz",                       kcal: 380 },
  quinoa:        { name: "quinoa cocida",                           kcal: 120 },
}

export const FAVORITE_CARBS = [
  { key: "arroz_cocido",  name: "Arroz cocido",  kcal: 130 },
  { key: "pasta_cocida",  name: "Pasta cocida",  kcal: 150 },
  { key: "patata_cocida", name: "Patata cocida", kcal: 77  },
  { key: "pan_integral",  name: "Pan integral",  kcal: 250 },
  { key: "quinoa",        name: "Quinoa",        kcal: 120 },
]

export const SNACK_TARGET_KCAL = 175

export const MAIN_MEAL_SPLIT: Record<string, number> = {
  desayuno: 0.28,
  almuerzo: 0.45,
  cena:     0.27,
}

export const DAY_NAMES_ES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

export const MEAL_ID_ORDER = ["desayuno", "media_manana", "almuerzo", "merienda", "cena"]

export const MEAL_NAMES_ES: Record<string, string> = {
  desayuno:     "Desayuno",
  media_manana: "Media mañana",
  almuerzo:     "Almuerzo",
  merienda:     "Merienda",
  cena:         "Cena",
}

export const MEAL_TYPES_EN: Record<string, string> = {
  desayuno:     "breakfast",
  media_manana: "mid-morning",
  almuerzo:     "lunch",
  merienda:     "snack",
  cena:         "dinner",
}

export const MIN_CARB_G: Record<string, number> = {
  desayuno:     30,
  almuerzo:     50,
  cena:         20,
  media_manana: 5,
  merienda:     5,
}
```

#### Meal Template Type

Each entry in the meal arrays has this shape:

```typescript
interface MealTemplate {
  template:         string   // text with {carb_g} and {carb_name} placeholders
  carb_source:      string   // key into CARB_SOURCES
  fixed_kcal:       number   // kcal of protein + fat + veg (non-carb component)
  note:             string   // preparation tip
  display_override?: string  // override carb display name (e.g. "frutos secos")
}
```

#### DESAYUNOS (10 templates)

```typescript
export const DESAYUNOS: MealTemplate[] = [
  {
    template:   "{carb_g}g de {carb_name} con 40g de jamón serrano y tomate + café",
    carb_source: "pan_thins", fixed_kcal: 150,
    note: "4 rebanadas de pan thins (2 panes). Tomate natural en rodajas.",
  },
  {
    template:   "{carb_g}g de {carb_name} con 50g de pechuga de pavo y tomate + café",
    carb_source: "pan_thins", fixed_kcal: 115,
    note: "Opción ligera y proteica para días de más entrenamiento.",
  },
  {
    template:   "{carb_g}g de {carb_name} con 1 lata de atún, 4 rodajas de tomate + café",
    carb_source: "pan_thins", fixed_kcal: 130,
    note: "Aliña el atún con un chorrito de limón.",
  },
  {
    template:   "{carb_g}g de {carb_name} con 3-4 lonchas (30g) de jamón serrano o caña de lomo + café",
    carb_source: "pan_centeno", fixed_kcal: 155,
    note: "Extiende bien el aceite de oliva (1 cda sopera). Pan recomendado: Thins, Rustik, centeno, espelta Mercadona.",
  },
  {
    template:   "{carb_g}g de {carb_name} con queso fresco (50g) y tomate en rodajas + café",
    carb_source: "pan_centeno", fixed_kcal: 120,
    note: "Añade orégano o albahaca fresca. Opción baja en calorías.",
  },
  {
    template:   "{carb_g}g de {carb_name} con ¼ aguacate (40g) y tomate + café",
    carb_source: "pan_integral", fixed_kcal: 160,
    note: "Con moderación — el aguacate es grasa saludable pero calórico.",
  },
  {
    template:   "{carb_g}g de {carb_name} con 3-4 lonchas de jamón serrano y tomate + café",
    carb_source: "pan_semillas", fixed_kcal: 155,
    note: "Pan de semillas Mercadona. Opciones de topping: jamón, lomo, queso fresco, aguacate.",
  },
  {
    template:   "{carb_g}g de {carb_name} con leche semidesnatada (200ml) + café",
    carb_source: "cereales", fixed_kcal: 100,
    note: "Opciones: Corn flakes, espelta, crunchy Mercadona, cereales de aritos. Sin azúcar añadida.",
  },
  {
    template:   "Tortita de avena: {carb_g}g de {carb_name} + 2 huevos + chorrito de leche + 1 cdta crema de cacahuete + 1 onza de chocolate negro",
    carb_source: "avena", fixed_kcal: 300,
    note: "Mezcla todo y cocina en sartén antiadherente sin aceite. Desayuno del domingo.",
  },
  {
    template:   "Tortita de avena: {carb_g}g de {carb_name} + 2 huevos + leche + 1 cda cacahuete en polvo",
    carb_source: "avena", fixed_kcal: 250,
    note: "Versión más proteica con cacahuete en polvo. Sin onza de chocolate.",
  },
]
```

#### MEDIA_MANANA (11 templates)

```typescript
export const MEDIA_MANANA: MealTemplate[] = [
  {
    template: "1 fruta de temporada (150g) + {carb_g}g de frutos secos (nueces/almendras)",
    carb_source: "crackers", fixed_kcal: 75, display_override: "frutos secos",
    note: "Pesa los frutos secos — son muy calóricos. Elige fruta de temporada.",
  },
  {
    template: "1 fruta de temporada (150g) + 3-4 nueces",
    carb_source: "crackers", fixed_kcal: 75, display_override: "nueces",
    note: "Opción sencilla. Fruta = manzana, pera, naranja, mandarina o melocotón.",
  },
  {
    template: "1 fruta de temporada + 5 pistachos",
    carb_source: "crackers", fixed_kcal: 75, display_override: "pistachos",
    note: "Los pistachos son ricos en proteína vegetal.",
  },
  {
    template: "Batido de proteínas (1 scoop) con agua o leche vegetal",
    carb_source: "crackers", fixed_kcal: 120, display_override: "proteínas",
    note: "Opcional: añadir hielo y mezclar. Aporta ~25g de proteína.",
  },
  {
    template: "Yogurt proteínas (200g) o batido de proteínas + {carb_g}g de frutos secos",
    carb_source: "crackers", fixed_kcal: 120, display_override: "frutos secos",
    note: "Yogurt proteínas sin azúcar añadida. Frutos secos de la bolsa de Aldi.",
  },
  {
    template: "50g de caña de lomo de pavo + {carb_g}g de frutos secos",
    carb_source: "crackers", fixed_kcal: 110, display_override: "frutos secos",
    note: "Opción fácil de llevar al trabajo.",
  },
  {
    template: "70g de pechuga de pavo/pollo + {carb_g}g de frutos secos",
    carb_source: "crackers", fixed_kcal: 77, display_override: "frutos secos",
    note: "Proteína alta. Frutos secos de la bolsa Aldi son los mejores en ratio precio/calidad.",
  },
  {
    template: "{carb_g}g de {carb_name} con 50g de caña de lomo de pavo",
    carb_source: "tortita_arroz", fixed_kcal: 110,
    note: "Puedes untar 1 cdta de crema de cacahuete en 1 tortita.",
  },
  {
    template: "Bocadillo: {carb_g}g de {carb_name} con 50g de jamón serrano",
    carb_source: "pan_integral", fixed_kcal: 107,
    note: "Para llevar al trabajo. Compacto y saciante.",
  },
  {
    template: "Medio kefir (125ml) con sandía + {carb_g}g de frutos secos",
    carb_source: "crackers", fixed_kcal: 90, display_override: "frutos secos",
    note: "El kefir mejora la microbiota intestinal. Puedes cambiar kefir por yogurt proteínas.",
  },
  {
    template: "Piña en rodajas (200g) + {carb_g}g de pechuga de pavo",
    carb_source: "crackers", fixed_kcal: 80, display_override: "pechuga de pavo",
    note: "La piña ayuda a la digestión. 1 lata de piña al natural (sin almíbar).",
  },
]
```

#### ALMUERZOS (30 templates)

Due to length, the full array is defined in the file. The complete set extracted from `diet.py` is reproduced here verbatim for the implementer:

```typescript
export const ALMUERZOS: MealTemplate[] = [
  // Pasta / Espaguetis
  { template: "{carb_g}g de {carb_name} con 120g de carne picada de ternera, tomate frito sin azúcar y orégano",
    carb_source: "espaguetis", fixed_kcal: 270,
    note: "Sofríe la carne con ajo y añade tomate al final. Receta clásica de la dieta." },
  { template: "{carb_g}g de {carb_name} a la boloñesa con 120g de pollo/pavo picado, zanahoria, puerro y tomate frito",
    carb_source: "espaguetis", fixed_kcal: 230,
    note: "Añade un poco de salsa de soja para potenciar el sabor." },
  { template: "Ensalada de {carb_g}g de {carb_name} con 1 huevo cocido, 2 latas de atún, tomate, cebolla y 10 aceitunas",
    carb_source: "pasta", fixed_kcal: 310,
    note: "Ideal para preparar la noche anterior. Aliña con aceite de oliva y vinagre." },
  { template: "Ensalada de {carb_g}g de {carb_name} con 1 huevo, 1 lata de atún, cebolla y tomate",
    carb_source: "pasta", fixed_kcal: 245,
    note: "Versión ligera de la ensalada de pasta. Aliñar al gusto con aceite y limón." },
  { template: "{carb_g}g de {carb_name} con 90g de pollo troceado, tomate frito sin azúcar y orégano",
    carb_source: "pasta", fixed_kcal: 215,
    note: "Sofríe el pollo antes de añadir la pasta ya cocida." },
  // Arroz
  { template: "{carb_g}g de {carb_name} con 140g de pechuga de pollo a la plancha y brócoli al vapor",
    carb_source: "arroz", fixed_kcal: 200,
    note: "Aliña el brócoli con limón y un toque de ajo. Clásico de la dieta." },
  { template: "Guiso de arroz: {carb_g}g de {carb_name} amarillo con 140g de ternera, sofrito de cebolla, pimiento y caldo de verduras",
    carb_source: "arroz", fixed_kcal: 270,
    note: "Sofrito de cebolla y pimiento verde. Un poco de colorante y pimentón dulce." },
  { template: "{carb_g}g de {carb_name} con 165g de solomillo de pavo en salsa de champiñones (leche evaporada, cebollino, pimienta)",
    carb_source: "arroz", fixed_kcal: 235,
    note: "Salsa: leche evaporada + champiñones + cebollino + pimienta negra." },
  { template: "Guiso de arroz caldoso: {carb_g}g de {carb_name} con 140g de pollo troceado, muchas verduras y caldo de pollo",
    carb_source: "arroz", fixed_kcal: 215,
    note: "Sofrito de cebolla, pimiento, tomate. Cúrcuma para el color. Añade pimentón dulce y laurel." },
  { template: "{carb_g}g de {carb_name} con 2 hamburguesas de pollo (180g) y 1 cda de guacamole",
    carb_source: "arroz", fixed_kcal: 250,
    note: "Opción muy saciante. Hamburguesas de pollo del supermercado." },
  { template: "Sushi casero: {carb_g}g de {carb_name} con 100g de salmón o atún, medio aguacate y salsa de soja",
    carb_source: "arroz", fixed_kcal: 270,
    note: "Puedes hacerlo en bowl. Añade pepino y alga nori troceada." },
  // Ñoquis
  { template: "{carb_g}g de {carb_name} con 130g de pollo troceado, cebolla, pimiento, zanahoria y loncha de queso havarti light",
    carb_source: "noquis", fixed_kcal: 220,
    note: "Saltea los ñoquis en sartén hasta que doren. Receta de Instagram de la nutricionista." },
  { template: "{carb_g}g de {carb_name} con 180g de gambas, cebollino, pimiento y toque de salsa de soja",
    carb_source: "noquis", fixed_kcal: 200,
    note: "Salta los ñoquis en sartén hasta que doren por fuera." },
  { template: "{carb_g}g de {carb_name} con 2 hamburguesas de ternera (180g) y 3 rodajas de queso de cabra",
    carb_source: "noquis", fixed_kcal: 405,
    note: "Plancha los ñoquis en seco para que crujean. Queso de cabra Mercadona." },
  { template: "{carb_g}g de {carb_name} con 160g de salmón, champiñones y salsa fit (leche + soja + cacahuete polvo)",
    carb_source: "noquis", fixed_kcal: 390,
    note: "Salsa fit: leche semidesnatada + salsa de soja + 2 cdas de cacahuete en polvo." },
  { template: "{carb_g}g de {carb_name} con filete de ternera (170g) a la plancha y verduras",
    carb_source: "noquis", fixed_kcal: 285,
    note: "Ternera al punto con un poco de sal y pimienta negra." },
  // Patata / Legumbres
  { template: "Papas aliñás: {carb_g}g de {carb_name} cocida con 2 latas de atún, 1 huevo, cebolla, maíz, perejil, aceite y vinagre",
    carb_source: "patata", fixed_kcal: 295,
    note: "Sirve templado. La patata aliñada gana sabor al reposar. Receta clásica." },
  { template: "Guiso de {carb_g}g de {carb_name} con 140g de chocos/sepia, sofrito de cebolla, pimiento y tomate",
    carb_source: "patata", fixed_kcal: 160,
    note: "Sofrito de cebolla, pimiento verde y tomate. Añade pimentón dulce y laurel." },
  { template: "Tortilla de patata: {carb_g}g de {carb_name} con 2 huevos (horno o sartén con poco aceite)",
    carb_source: "patata", fixed_kcal: 190,
    note: "Puedes añadir cebolla pochada. Al horno queda jugosa sin exceso de aceite." },
  { template: "Lentejas: {carb_g}g de {carb_name} con verduras y 120g de pollo troceado (o ternera)",
    carb_source: "lentejas", fixed_kcal: 200,
    note: "Sofrito base: cebolla, pimiento, zanahoria y ajo. Pimentón ahumado." },
  { template: "Potaje de lentejas: {carb_g}g de {carb_name} con verduras, 30g de arroz y 140g de pechuga de pollo troceada",
    carb_source: "lentejas", fixed_kcal: 205,
    note: "El arroz hace el potaje más espeso y saciante." },
  { template: "Olla de garbanzos: {carb_g}g de {carb_name} con verduras y 150g de lomo de cerdo",
    carb_source: "garbanzos", fixed_kcal: 315,
    note: "Añade pimentón ahumado, comino y una hoja de laurel." },
  { template: "Garbanzos: {carb_g}g de {carb_name} con calabaza, judías verdes y 120g de pollo troceado",
    carb_source: "garbanzos", fixed_kcal: 190,
    note: "Receta muy completa en micronutrientes." },
  // Pescado
  { template: "180g de salmón a la plancha con {carb_g}g de {carb_name} y calabacín/berenjena",
    carb_source: "noquis", fixed_kcal: 380,
    note: "El salmón ya tiene grasa — no añadir aceite. Aliña con limón y eneldo." },
  { template: "160g de salmón a la plancha con {carb_g}g de {carb_name} y brócoli",
    carb_source: "arroz", fixed_kcal: 330,
    note: "Salmón al punto. Salsa fit: leche + soja + cacahuete polvo." },
  { template: "170-180g de filete de merluza/dorada/lubina a la plancha con {carb_g}g de {carb_name}",
    carb_source: "patata", fixed_kcal: 175,
    note: "Merluza, dorada, lubina o bacalao fresco. Limón y perejil al servir." },
  { template: "160g de filete de pescado blanco a la plancha con ensalada de lechuga y zanahoria",
    carb_source: "patata", fixed_kcal: 185,
    note: "Aliña con aceite de oliva, limón y sal." },
  { template: "170g de filete de atún a la plancha con salsa fit (leche+soja+cacahuete) + {carb_g}g de {carb_name}",
    carb_source: "noquis", fixed_kcal: 250,
    note: "Salsa fit: leche evaporada + soja + 2 cdas cacahuete polvo. Receta de Instagram." },
  // Carne
  { template: "160g de pinchitos de pollo con {carb_g}g de {carb_name} al gusto (horno o sartén)",
    carb_source: "patata", fixed_kcal: 210,
    note: "Marinado con especias: comino, pimentón, ajo, limón." },
  { template: "170g de ternera a la plancha con {carb_g}g de {carb_name} y verduras y salsa de soja",
    carb_source: "patata", fixed_kcal: 290,
    note: "Aliña con salsa de soja y ajo. Acompaña con ensalada." },
  { template: "150g de ternera a la plancha con {carb_g}g de {carb_name} y salsa de soja",
    carb_source: "arroz", fixed_kcal: 255,
    note: "Añade un toque de salsa de soja al servir." },
  { template: "2 hamburguesas de ternera (unos 180g) con {carb_g}g de {carb_name} a la plancha y ensalada",
    carb_source: "noquis", fixed_kcal: 285,
    note: "Hamburguesas de ternera sin pan. Con ñoquis a la plancha." },
  { template: "2 hamburguesas de pollo (180g) con {carb_g}g de {carb_name} y ensalada de lechuga",
    carb_source: "noquis", fixed_kcal: 215,
    note: "Hamburguesas de pollo Mercadona. Con ñoquis a la plancha." },
  { template: "1 muslo de pollo en salsa con {carb_g}g de {carb_name} y verduras al gusto",
    carb_source: "arroz", fixed_kcal: 250,
    note: "Receta de Instagram de la nutricionista. Pedir si no se encuentra." },
  { template: "Pollo rebozado estilo KFC: 180g de pechuga con {carb_g}g de cereales de maíz machacados + salsa BBQ zero",
    carb_source: "noquis", fixed_kcal: 260,
    note: "Pasa el pollo por huevo y cereales de maíz machacados. Al horno 20 min." },
  { template: "Pechuga de pollo (160g) en salsa de curry con {carb_g}g de {carb_name}",
    carb_source: "arroz", fixed_kcal: 220,
    note: "Salsa curry: sofrito de cebolla y ajo, caldo de verduras, yogurt griego, curry, limón." },
  // Ensaladas principales
  { template: "Ensalada completa: lechuga, 1 aguacate, 5 nueces, 6 cubitos queso feta + 120g de pollo/pavo a la plancha",
    carb_source: "crackers", fixed_kcal: 450, display_override: "frutos secos",
    note: "Aliñar con aceite de oliva y vinagre balsámico al gusto." },
  { template: "Ensalada de {carb_g}g de {carb_name} con 2 latas de salmón, 1 queso fresco, pimienta negra y aliño al gusto",
    carb_source: "quinoa", fixed_kcal: 250,
    note: "Quinoa en frío con salmón. Muy completo en proteína y omega-3." },
  { template: "Pisto de verduras con tomate frito sin azúcar + 2 huevos a la plancha con orégano",
    carb_source: "pan_integral", fixed_kcal: 260,
    note: "Pisto: calabacín, pimiento, cebolla, tomate. Huevos encima al servir." },
]
```

#### MERIENDAS (13 templates)

```typescript
export const MERIENDAS: MealTemplate[] = [
  { template: "2 tajas de sandía (200g) + {carb_g}g de frutos secos",
    carb_source: "crackers", fixed_kcal: 40, display_override: "frutos secos",
    note: "Los frutos secos son el snack más saciante." },
  { template: "{carb_g}g de {carb_name} con 50g de pechuga de pavo y guacamole (o tomate)",
    carb_source: "tortita_arroz", fixed_kcal: 145,
    note: "Opción de la nutricionista: 2 tortitas de arroz con pavo y guacamole." },
  { template: "1 sandwich de {carb_g}g de {carb_name} con 4 lonchas de pavo y 1 manzana",
    carb_source: "pan_thins", fixed_kcal: 130,
    note: "Pan thins o pan multicereales. Opción para llevar." },
  { template: "Yogurt proteínas (200g) con 1 cda de crema de cacahuete en polvo + {carb_g}g de fresas",
    carb_source: "crackers", fixed_kcal: 155, display_override: "fresas",
    note: "Endulza con eritritol o stevia si lo necesitas." },
  { template: "Medio kefir (125ml) con sandía + {carb_g}g de frutos secos",
    carb_source: "crackers", fixed_kcal: 90, display_override: "frutos secos",
    note: "Puedes cambiar kefir por yogurt proteínas." },
  { template: "{carb_g}g de {carb_name}: 1 con crema de cacahuete + el resto con 50g de caña de lomo",
    carb_source: "tortita_arroz", fixed_kcal: 145,
    note: "Crema de cacahuete 100% sin azúcar añadida." },
  { template: "1 lata de piña al natural + {carb_g}g de frutos secos (4 nueces o 10 pistachos)",
    carb_source: "crackers", fixed_kcal: 65, display_override: "frutos secos",
    note: "Piña sin almíbar. Digestiva y baja en calorías." },
  { template: "{carb_g}g de cereales (crunchy/aritos) con leche semi + 25g de caña de lomo de pavo",
    carb_source: "cereales", fixed_kcal: 125,
    note: "Merienda equilibrada con carbos y proteína." },
  { template: "Bowl de avena: {carb_g}g de {carb_name} + 1 huevo + chorrito de leche + oncita de chocolate (45s micro)",
    carb_source: "avena", fixed_kcal: 140,
    note: "45 segundos al microondas. Queda textura blandita tipo bizcocho." },
  { template: "250g de yogurt proteínas natural con 1 cda mantequilla de cacahuete + 2 cdas de avena",
    carb_source: "avena", fixed_kcal: 160,
    note: "Coge el bote de 500g para tener para 2 días." },
  { template: "Bizcocho en taza: {carb_g}g de {carb_name} + levadura + 1 huevo + 2 onzas chocolate (4 min micro)",
    carb_source: "avena", fixed_kcal: 175,
    note: "4 minutos al microondas. Receta clásica de la dieta." },
  { template: "6 fresas con 2 onzas de chocolate negro derretido + {carb_g}g de caña de lomo",
    carb_source: "crackers", fixed_kcal: 135, display_override: "caña de lomo",
    note: "Chocolate negro ≥70%. Capricho controlado." },
  { template: "Helado casero de yogurt proteínas con 2 cdas de crema de cacahuete + 1 onza de chocolate negro",
    carb_source: "crackers", fixed_kcal: 200, display_override: "yogurt proteínas",
    note: "Congela el yogurt 2-3 horas. Añade la crema de cacahuete y el chocolate al servir." },
]
```

#### CENAS (20 templates)

```typescript
export const CENAS: MealTemplate[] = [
  // Ensaladas
  { template: "Ensalada de canónigos/rúcula con 2 latas de atún, 1 queso fresco 0%, tomate y cebolla",
    carb_source: "crackers", fixed_kcal: 260, display_override: "ensalada",
    note: "Aliñar con aceite de oliva, vinagre y una pizca de sal." },
  { template: "Ensalada de canónigos con 3 rodajas de queso de cabra, 1 lata de atún, 4 fresas/granada y frutos secos (10g)",
    carb_source: "crackers", fixed_kcal: 295, display_override: "ensalada",
    note: "Queso de cabra Mercadona. Aliñar al gusto con aceite de oliva." },
  { template: "Super ensalada de brotes verdes: cebolla, maíz, 6 cubitos queso feta, aguacate, 5 nueces",
    carb_source: "crackers", fixed_kcal: 340, display_override: "ensalada",
    note: "La ensalada más completa de la dieta. Aliñar al gusto." },
  { template: "Ensalada de brotes verdes con 5 espárragos blancos, 1 lata de melva/caballa, tomates cherry y cebolla",
    carb_source: "crackers", fixed_kcal: 200, display_override: "ensalada",
    note: "Melva o caballa en aceite de oliva. Muy saciante y ligera." },
  { template: "Ensalada de canónigos con 2 latas de atún/salmón, 1 aguacate y tomate",
    carb_source: "crackers", fixed_kcal: 315, display_override: "ensalada",
    note: "Versión de la ensalada con aguacate. Omega-3 y grasas saludables." },
  // Huevos / Tortillas
  { template: "Tortilla francesa de 3 huevos con 1 lata de salmón/atún y puerro salteado",
    carb_source: "noquis", fixed_kcal: 375,
    note: "Dora los ñoquis aparte en sartén seca." },
  { template: "2 huevos a la plancha con medio calabacín, tomate frito sin azúcar y orégano",
    carb_source: "pan_integral", fixed_kcal: 240,
    note: "Espolvorea orégano sobre los huevos." },
  { template: "Tortilla francesa de 3 huevos con 1 lata de atún y alcachofas (de bote)",
    carb_source: "crackers", fixed_kcal: 345, display_override: "tortilla",
    note: "Alcachofas de bote al natural. Muy baja en calorías." },
  // Pescado
  { template: "170-180g de merluza/dorada/lubina al horno o a la plancha con verduras al gusto",
    carb_source: "crackers", fixed_kcal: 200, display_override: "pescado",
    note: "Con limón, perejil y un hilo de aceite de oliva. Muy ligero." },
  { template: "150g de filete de atún a la plancha con ensalada de canónigos y frutos secos (10g)",
    carb_source: "crackers", fixed_kcal: 270, display_override: "atún",
    note: "Atún fresco o congelado. Aliñar con limón y salsa de soja." },
  { template: "140g de salmón a la plancha con espárragos verdes o ensalada al gusto",
    carb_source: "crackers", fixed_kcal: 295, display_override: "salmón",
    note: "El salmón no necesita aceite — ya tiene grasa suficiente." },
  { template: "220g de pescado blanco con un poco de salsa verde y verduras al gusto",
    carb_source: "crackers", fixed_kcal: 210, display_override: "pescado blanco",
    note: "Salsa verde: ajo, perejil, aceite de oliva, caldo de pescado." },
  { template: "2 latas de caballa o melva con pimientos del piquillo y 2 tostadas de crackers",
    carb_source: "crackers", fixed_kcal: 195,
    note: "Fácil y rápido. Pimientos del piquillo de bote." },
  { template: "Papas aliñás de noche: patata mediana cocida (150g) + 1 huevo cocido + 1 lata de salmón + perejil",
    carb_source: "patata", fixed_kcal: 175,
    note: "Versión ligera de las papas aliñás para la cena." },
  // Carne
  { template: "2 hamburguesas de ternera (170-180g) con calabacín a la plancha",
    carb_source: "crackers", fixed_kcal: 290, display_override: "hamburguesas ternera",
    note: "Sin pan. Calabacín a la plancha con ajo y sal." },
  { template: "1 hamburguesa de pollo en {carb_g}g de {carb_name} con lechuga, tomate y 1 loncha de queso havarti",
    carb_source: "pan_thins", fixed_kcal: 230,
    note: "Hamburguesa de pollo Mercadona. Con pan thins o pan multicereales." },
  { template: "140g de pechuga de pollo a la plancha con ensalada variada o verduras al gusto",
    carb_source: "crackers", fixed_kcal: 190, display_override: "pollo a la plancha",
    note: "El clásico. Aliñar con limón y orégano." },
  // Fajitas / Wraps
  { template: "Fajita de {carb_g}g de {carb_name} con 130g de pollo, cebolla, pimiento y salsa de yogurt",
    carb_source: "pan_thins", fixed_kcal: 210,
    note: "Receta de Instagram. Salsa yogurt: yogurt griego + ajo + limón + eneldo." },
  { template: "2 fajitas de {carb_g}g de {carb_name} con 90g de ternera cada una, verduras y salsa de yogurt",
    carb_source: "pan_thins", fixed_kcal: 280,
    note: "Ternera en tiras finas. Salsa yogurt: yogurt griego + ajo + comino." },
  // Special
  { template: "Salmorejo cordobés con 1 huevo cocido, 1 lata de atún y 20g de picatostes",
    carb_source: "pan_integral", fixed_kcal: 195,
    note: "Salmorejo casero: tomates maduros, pan, ajo, aceite de oliva, sal y vinagre." },
  { template: "100g de gulas con 150g de gambas y 1 cda de salsa verde",
    carb_source: "crackers", fixed_kcal: 295, display_override: "gulas y gambas",
    note: "Saltear con ajo laminado y guindilla. Muy rápido y sabroso." },
  { template: "Chipirones a la plancha (150g) con aguacate troceado y 4-5 nueces",
    carb_source: "crackers", fixed_kcal: 295, display_override: "chipirones",
    note: "Aliña el aguacate con limón, sal y pimienta." },
  { template: "Serranito: 100g de lomo, 2 lonchas de jamón, 1 pimiento en {carb_g}g de {carb_name}",
    carb_source: "pan_integral", fixed_kcal: 310,
    note: "Pan blanco tipo bocadillo o pan thins. Sin frituras." },
]
```

#### Scaling Logic (`scaleMeal`)

Internal helper, not exported directly but used by `generateDayPlan` and `generateWeekPlan`:

```
function scaleMeal(template: MealTemplate, targetKcal: number, mealKey: string): ScaledMeal {
  const cs = CARB_SOURCES[template.carb_source]
  const carbKcal = Math.max(targetKcal - template.fixed_kcal, 0)
  let carbG = Math.round(carbKcal / (cs.kcal / 100))
  carbG = Math.max(carbG, MIN_CARB_G[mealKey] ?? 10)

  const carbDisplay = template.display_override ?? cs.name

  let text: string
  if (template.template.includes("{carb_g}")) {
    text = template.template
      .replace("{carb_g}", String(carbG))
      .replace("{carb_name}", cs.name)
  } else {
    text = template.template
  }

  const totalKcal = template.fixed_kcal + (carbG * cs.kcal / 100)

  return {
    text,
    kcal:       Math.round(totalKcal),
    carbG,
    carbName:   carbDisplay,
    note:       template.note,
    timingNote: "",
    fixedKcal:  template.fixed_kcal,
    targetKcal: Math.round(targetKcal),
  }
}
```

#### Exported Functions

**`generateDayPlan(profile: ProfileRow, exerciseAdjustment: number, excluded: string[], favorites: string[]): DayPlan`**

1. `bmr = calculateBMR(profile.gender, profile.age, profile.height_cm, profile.weight_kg)` (import from calculator.ts)
2. `dailyTarget = calculateDailyTarget(bmr, profile.goal, exerciseAdjustment, profile.activity_level)`
3. `macros = calculateMacros(profile.weight_kg, dailyTarget, profile.goal)`
4. `snackBudget = SNACK_TARGET_KCAL * 2`; `mainBudget = dailyTarget - snackBudget`
5. Pick random template from each pool; call `scaleMeal` with appropriate budget:
   - `desayuno`: `mainBudget * MAIN_MEAL_SPLIT.desayuno`
   - `media_manana`: `SNACK_TARGET_KCAL`
   - `almuerzo`: `mainBudget * MAIN_MEAL_SPLIT.almuerzo`
   - `merienda`: `SNACK_TARGET_KCAL`
   - `cena`: `mainBudget * MAIN_MEAL_SPLIT.cena`
6. Returns `DayPlan` with `dailyTarget`, `macros`, and `meals` map.

**`generateWeekPlan(profile: ProfileRow, excluded: string[], favorites: string[], dailyTarget: number, history: WeeklyHistorySummary[]): WeekPlan`**

1. Determine Monday of current week.
2. If `history.length > 0`, compute `adjustedTarget`:
   - `dailyExerciseAvg = history[0].total_exercise_kcal / 7`
   - `adherencePenalty = avg_adherence >= 0.8 ? 0 : Math.round(100 * (1 - avg_adherence / 0.8))`
   - `weightAdj`: if `weight_delta < -0.5` → `+100`; if `weight_delta > 0.1` → `-100`; else `0`
   - `adjustedTarget = Math.max(Math.round(dailyTarget + dailyExerciseAvg + weightAdj - adherencePenalty), 1200)`
3. `snackBudget = SNACK_TARGET_KCAL`; `mainBudget = adjustedTarget - 2 * snackBudget`
4. For each of 7 days (Mon–Sun): generate meals using `scaleMeal` same as `generateDayPlan`.
5. Returns `WeekPlan` with `days[]`, `generatedAt` (Monday ISO), `weeklyTargetKcal`, and `weeklySummaryUsed`.

---

### `lib/engine/training.ts`

Ported from `nutrition_assistant/training.py`.

#### Constants

```typescript
export const FULL_BODY_ROUTINE: Exercise[] = [
  { name: "Sentadilla",                  sets: "4x6-8",   muscles: "Cuádriceps, Glúteos, Core" },
  { name: "Press de Banca",              sets: "4x6-8",   muscles: "Pecho, Hombros, Tríceps" },
  { name: "Peso Muerto Rumano",          sets: "3x8-10",  muscles: "Isquiotibiales, Glúteos, Espalda baja" },
  { name: "Remo con Barra",              sets: "4x6-8",   muscles: "Dorsales, Bíceps, Core" },
  { name: "Press Militar (Barra)",       sets: "3x8-10",  muscles: "Hombros, Tríceps" },
  { name: "Dominadas / Jalón al Pecho",  sets: "3x8-10",  muscles: "Dorsales, Bíceps" },
]

export const PPL_ROUTINE: Record<string, Exercise[]> = {
  "Push (Empuje)": [
    { name: "Press de Banca",           sets: "4x6-8",   muscles: "Pecho, Hombros ant., Tríceps" },
    { name: "Press Inclinado Mancuernas",sets: "3x8-10", muscles: "Pecho superior" },
    { name: "Press Militar Barra",      sets: "4x6-8",   muscles: "Hombros, Tríceps" },
    { name: "Elevaciones Laterales",    sets: "3x12-15", muscles: "Hombros laterales" },
    { name: "Fondos en Paralelas",      sets: "3x8-12",  muscles: "Tríceps, Pecho" },
    { name: "Extensiones Tríceps Polea",sets: "3x12-15", muscles: "Tríceps" },
  ],
  "Pull (Jalón)": [
    { name: "Peso Muerto Convencional", sets: "4x5-6",   muscles: "Cadena posterior completa" },
    { name: "Dominadas",                sets: "4x6-10",  muscles: "Dorsales, Bíceps" },
    { name: "Remo con Barra",           sets: "4x6-8",   muscles: "Dorsales, Trapecios, Bíceps" },
    { name: "Remo en Polea Baja",       sets: "3x10-12", muscles: "Dorsales, Romboides" },
    { name: "Curl Bíceps con Barra",    sets: "3x8-12",  muscles: "Bíceps" },
    { name: "Curl Martillo",            sets: "3x10-12", muscles: "Bíceps, Braquial" },
  ],
  "Legs (Piernas)": [
    { name: "Sentadilla con Barra",     sets: "4x6-8",   muscles: "Cuádriceps, Glúteos, Core" },
    { name: "Prensa de Piernas",        sets: "4x8-10",  muscles: "Cuádriceps, Glúteos" },
    { name: "Peso Muerto Rumano",       sets: "4x8-10",  muscles: "Isquiotibiales, Glúteos" },
    { name: "Zancadas con Mancuernas",  sets: "3x10-12", muscles: "Cuádriceps, Glúteos" },
    { name: "Curl Femoral Tumbado",     sets: "3x10-12", muscles: "Isquiotibiales" },
    { name: "Elevaciones de Talón",     sets: "4x12-15", muscles: "Gemelos" },
  ],
}

// PPL day plans by training days per week
// 4d: Push/Pull/Legs/Legs
// 5d: Push/Pull/Legs/Push/Pull
// 6d: Push/Pull/Legs/Push/Pull/Legs
export const PPL_PLANS: Record<number, string[]> = {
  4: ["Push (Empuje)", "Pull (Jalón)", "Legs (Piernas)", "Legs (Piernas)"],
  5: ["Push (Empuje)", "Pull (Jalón)", "Legs (Piernas)", "Push (Empuje)", "Pull (Jalón)"],
  6: ["Push (Empuje)", "Pull (Jalón)", "Legs (Piernas)", "Push (Empuje)", "Pull (Jalón)", "Legs (Piernas)"],
}
```

**CALISTENIA data** — full nested structure by block > level > exercises, with `equip` field:

```typescript
export type CalisteniaEquip = "suelo" | "barra" | "paralelas"

export interface CalisteniaExercise {
  name:    string
  sets:    string
  muscles: string
  equip:   CalisteniaEquip
}

export const CALISTENIA: Record<string, Record<string, CalisteniaExercise[]>> = {
  "Empuje": {
    "principiante": [
      { name: "Flexiones (rodillas si es necesario)", sets: "4x8-12",      muscles: "Pecho, Tríceps, Hombros ant.",     equip: "suelo" },
      { name: "Pike Push-up",                         sets: "3x8-10",      muscles: "Hombros, Tríceps",                equip: "suelo" },
      { name: "Fondos en banco/silla",                sets: "3x10-15",     muscles: "Tríceps, Pecho",                  equip: "suelo" },
      { name: "Flexiones inclinadas (manos en alto)", sets: "3x10-12",     muscles: "Pecho inferior, Tríceps",         equip: "suelo" },
      { name: "Fondos en paralelas",                  sets: "3x6-10",      muscles: "Tríceps, Pecho",                  equip: "paralelas" },
    ],
    "intermedio": [
      { name: "Flexiones arquero",                    sets: "4x6-10/lado", muscles: "Pecho unilateral, Tríceps",       equip: "suelo" },
      { name: "Flexiones con palmada (explosive)",    sets: "3x6-8",       muscles: "Pecho, Potencia",                 equip: "suelo" },
      { name: "Pseudo planche push-up",               sets: "3x6-8",       muscles: "Pecho, Hombros, Core",            equip: "suelo" },
      { name: "Pike Push-up elevado (pies en alto)",  sets: "3x8-10",      muscles: "Hombros, Tríceps",                equip: "suelo" },
      { name: "Fondos en paralelas",                  sets: "4x8-12",      muscles: "Tríceps, Pecho",                  equip: "paralelas" },
      { name: "Fondos en paralelas lastrados",        sets: "3x6-8",       muscles: "Tríceps, Pecho",                  equip: "paralelas" },
    ],
    "avanzado": [
      { name: "Flexiones de pino asistidas (pared)",  sets: "4x5-8",       muscles: "Hombros, Tríceps, Core",          equip: "suelo" },
      { name: "Flexiones de pino libre",              sets: "3x3-6",       muscles: "Hombros, Tríceps, Equilibrio",    equip: "suelo" },
      { name: "Planche push-up (progresión)",         sets: "3x3-5",       muscles: "Pecho, Hombros, Core",            equip: "suelo" },
      { name: "Fondos en paralelas con peso corporal inclinado", sets: "4x6-10", muscles: "Pecho bajo, Tríceps",        equip: "paralelas" },
      { name: "Ring dips",                            sets: "4x6-10",      muscles: "Tríceps, Pecho, Estabilidad",     equip: "paralelas" },
    ],
  },
  "Jalón": {
    "principiante": [
      { name: "Remo australiano (barra baja o mesa)", sets: "4x8-12",      muscles: "Dorsales, Bíceps, Romboides",     equip: "suelo" },
      { name: "Dead hang (colgado estático)",          sets: "3x20-30s",   muscles: "Agarre, Dorsales",                equip: "barra" },
      { name: "Dominadas negativas (bajada lenta 5s)", sets: "3x4-6",      muscles: "Dorsales, Bíceps",                equip: "barra" },
      { name: "Chin-up asistida (con banda elástica)", sets: "3x6-8",      muscles: "Dorsales, Bíceps",                equip: "barra" },
    ],
    "intermedio": [
      { name: "Dominadas agarre prono",                sets: "4x6-10",     muscles: "Dorsales, Bíceps",                equip: "barra" },
      { name: "Chin-up agarre supino",                 sets: "4x6-10",     muscles: "Bíceps, Dorsales",                equip: "barra" },
      { name: "Dominadas agarre neutro",               sets: "3x8-10",     muscles: "Dorsales, Braquial",              equip: "barra" },
      { name: "Remo australiano pies elevados",        sets: "3x8-12",     muscles: "Dorsales, Romboides",             equip: "suelo" },
      { name: "L-sit pull-up",                         sets: "3x4-6",      muscles: "Dorsales, Core",                  equip: "barra" },
    ],
    "avanzado": [
      { name: "Dominadas lastradas",                   sets: "4x5-8",      muscles: "Dorsales, Bíceps",                equip: "barra" },
      { name: "Muscle-up",                             sets: "3x3-5",      muscles: "Dorsales, Tríceps, Pecho",        equip: "barra" },
      { name: "Dominadas arquero",                     sets: "3x4-6/lado", muscles: "Dorsales unilateral",             equip: "barra" },
      { name: "Back lever (progresión tuck/straddle)", sets: "3x8-12s",    muscles: "Dorsales, Core posterior",        equip: "barra" },
      { name: "Front lever remo",                      sets: "3x3-5",      muscles: "Dorsales, Core, Bíceps",          equip: "barra" },
    ],
  },
  "Piernas": {
    "principiante": [
      { name: "Sentadilla",                              sets: "4x15-20",        muscles: "Cuádriceps, Glúteos, Core",          equip: "suelo" },
      { name: "Zancadas alternadas",                     sets: "3x10-12/pierna", muscles: "Cuádriceps, Glúteos",                equip: "suelo" },
      { name: "Sentadilla sumo",                         sets: "3x15-20",        muscles: "Glúteos, Isquios, Aductores",        equip: "suelo" },
      { name: "Glute bridge",                            sets: "3x15-20",        muscles: "Glúteos, Isquios",                   equip: "suelo" },
      { name: "Elevación de talón unipodal",             sets: "3x15-20",        muscles: "Gemelos",                            equip: "suelo" },
    ],
    "intermedio": [
      { name: "Bulgarian split squat",                   sets: "4x10-12/pierna", muscles: "Cuádriceps, Glúteos",                equip: "suelo" },
      { name: "Pistol squat asistida (TRX/árbol)",       sets: "3x6-8/pierna",   muscles: "Cuádriceps, Glúteos",                equip: "suelo" },
      { name: "Sentadilla explosiva (jump squat)",        sets: "3x10-12",        muscles: "Cuádriceps, Glúteos, Potencia",      equip: "suelo" },
      { name: "Nordic curl (isquios excéntrico)",         sets: "3x4-6",          muscles: "Isquiotibiales",                     equip: "suelo" },
      { name: "Hip thrust unipodal",                     sets: "3x12-15/pierna", muscles: "Glúteos",                            equip: "suelo" },
    ],
    "avanzado": [
      { name: "Pistol squat",                            sets: "4x6-8/pierna",   muscles: "Cuádriceps, Glúteos, Equilibrio",    equip: "suelo" },
      { name: "Shrimp squat",                            sets: "3x5-8/pierna",   muscles: "Cuádriceps, Equilibrio",             equip: "suelo" },
      { name: "Box jump + sentadilla aterrizaje",         sets: "3x8-10",         muscles: "Explosividad, Cuádriceps",           equip: "suelo" },
      { name: "Nordic curl completo",                    sets: "4x5-8",          muscles: "Isquiotibiales",                     equip: "suelo" },
      { name: "Elevación de talón lastrada",             sets: "4x15-20",        muscles: "Gemelos",                            equip: "suelo" },
    ],
  },
  "Core": {
    "principiante": [
      { name: "Plancha frontal",                         sets: "3x30-45s",       muscles: "Core completo",                      equip: "suelo" },
      { name: "Plancha lateral",                         sets: "3x20-30s/lado",  muscles: "Oblicuos, Core",                     equip: "suelo" },
      { name: "Elevaciones de rodillas tumbado",         sets: "3x15-20",        muscles: "Abdomen bajo",                       equip: "suelo" },
      { name: "Hollow body hold",                        sets: "3x20-30s",       muscles: "Core, Abdomen",                      equip: "suelo" },
      { name: "Superman hold",                           sets: "3x15-20s",       muscles: "Espalda baja, Glúteos",              equip: "suelo" },
    ],
    "intermedio": [
      { name: "Elevaciones de piernas colgado",          sets: "3x10-15",        muscles: "Abdomen bajo, Flexores cadera",      equip: "barra" },
      { name: "L-sit en suelo (paralelas/sillas)",        sets: "3x15-20s",       muscles: "Core, Cuádriceps, Tríceps",          equip: "suelo" },
      { name: "Dragon flag negativo",                    sets: "3x4-6",          muscles: "Core completo",                      equip: "suelo" },
      { name: "Planche lean",                            sets: "3x20-30s",       muscles: "Hombros, Core",                      equip: "suelo" },
      { name: "Windshield wipers (colgado)",             sets: "3x8-10/lado",    muscles: "Oblicuos, Core",                     equip: "barra" },
    ],
    "avanzado": [
      { name: "L-sit completo (paralelas)",              sets: "3x20-30s",       muscles: "Core, Cuádriceps",                   equip: "paralelas" },
      { name: "Dragon flag completo",                    sets: "3x4-6",          muscles: "Core completo",                      equip: "suelo" },
      { name: "Front lever hold (tuck/straddle/full)",   sets: "3x8-15s",        muscles: "Core, Dorsales",                     equip: "barra" },
      { name: "Human flag (progresión)",                 sets: "3x5-10s",        muscles: "Oblicuos, Hombros, Core",            equip: "barra" },
      { name: "V-sit",                                   sets: "3x15-20s",       muscles: "Core, Flexores cadera",              equip: "suelo" },
    ],
  },
}

// Calistenia weekly block plans (blocks to rotate by training day)
export const CALISTENIA_PLANS: Record<number, string[][]> = {
  2: [["Empuje", "Core"], ["Jalón", "Piernas"]],
  3: [["Empuje", "Core"], ["Jalón", "Piernas"], ["Empuje", "Jalón"]],
  4: [["Empuje", "Core"], ["Jalón", "Piernas"], ["Empuje", "Core"], ["Jalón", "Piernas"]],
  5: [["Empuje", "Core"], ["Jalón", "Piernas"], ["Empuje"], ["Jalón", "Core"], ["Piernas"]],
}
```

#### Exported Functions

**`generateRoutine(days: number, weightKg: number, type: 'weights'): TrainingRoutine`**

- If `days <= 3`: type = Full Body. Each of the `days` sessions uses `FULL_BODY_ROUTINE`.
- If `days >= 4`: type = PPL. Use `PPL_PLANS[days]` (capped at 6) to determine session sequence. Exercises for each session come from `PPL_ROUTINE[sessionName]`.
- Post-workout protein suggestion: `Math.round(weightKg * 0.3)` g.
- Returns `TrainingRoutine`.

**`generateCalisthenicsRoutine(days: number, level: 'principiante' | 'intermedio' | 'avanzado', hasBarra: boolean, hasParalelas: boolean): TrainingRoutine`**

- Clamp `days` to 2–5.
- Lookup `plan = CALISTENIA_PLANS[days]`.
- For each day in plan: for each block in that day, filter exercises by equipment availability (`equip === 'suelo'` always included; `equip === 'barra'` only if `hasBarra`; `equip === 'paralelas'` only if `hasParalelas`).
- Returns `TrainingRoutine`.

---

## Database Layer (`lib/db/`)

All DB functions are async and use `@capacitor-community/sqlite`. They depend on a singleton `SQLiteConnection` instance initialized in `schema.ts`.

### `lib/db/schema.ts`

**`initializeDatabase(): Promise<void>`**

Opens (or creates) the database named `metabolic.db`. Executes all 8 `CREATE TABLE IF NOT EXISTS` statements. Must be called once at app startup before any other DB operation.

SQL statements:

```sql
CREATE TABLE IF NOT EXISTS profile (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  gender TEXT NOT NULL,
  age INTEGER NOT NULL,
  height_cm REAL NOT NULL,
  weight_kg REAL NOT NULL,
  activity_level INTEGER NOT NULL,
  goal TEXT NOT NULL,
  week_start_day INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value_json TEXT NOT NULL,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS exercise_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  exercise_key TEXT NOT NULL,
  type TEXT NOT NULL,
  minutes INTEGER NOT NULL,
  calories_burned REAL NOT NULL,
  source TEXT DEFAULT 'manual',
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS weight_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  weight_kg REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS adherence_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  meal_id TEXT NOT NULL,
  status TEXT NOT NULL,
  UNIQUE(date, meal_id)
);

CREATE TABLE IF NOT EXISTS survey_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  energy INTEGER NOT NULL,
  sleep INTEGER NOT NULL,
  mood INTEGER NOT NULL,
  hunger INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS meal_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_start TEXT NOT NULL UNIQUE,
  plan_json TEXT NOT NULL,
  generated_at TEXT
);
```

### `lib/db/profile.ts`

```typescript
getProfile(): Promise<ProfileRow | null>
saveProfile(profile: ProfileRow): Promise<void>        // upsert by id=1
getPreferences(): Promise<{ excluded: string[]; favorites: string[]; disliked: string[] }>
savePreferences(prefs: { excluded?: string[]; favorites?: string[]; disliked?: string[] }): Promise<void>
getEvents(): Promise<EventRow[]>
saveEvent(event: Omit<EventRow, 'id'>): Promise<number>  // returns new id
deleteEvent(id: number): Promise<void>
```

### `lib/db/logs.ts`

```typescript
logExercise(entry: Omit<ExerciseLogRow, 'id'>): Promise<number>
getExerciseLogs(days: number): Promise<ExerciseLogRow[]>   // last N calendar days
deleteExerciseLog(id: number): Promise<void>
logWeight(entry: Omit<WeightEntryRow, 'id'>): Promise<void>  // upsert by date
getWeightHistory(): Promise<WeightEntryRow[]>               // all entries, ASC date
logAdherence(entry: Omit<AdherenceRow, 'id'>): Promise<void>  // upsert by (date, meal_id)
getAdherenceHistory(days: number): Promise<AdherenceRow[]>
saveSurvey(survey: Omit<SurveyRow, 'id'>): Promise<void>
getLastSurvey(): Promise<SurveyRow | null>
```

### `lib/db/meals.ts`

```typescript
getMealPlan(weekStart: string): Promise<WeekPlan | null>    // parse plan_json on read
saveMealPlan(weekStart: string, plan: WeekPlan): Promise<void>  // stringify plan_json on write
getWeeklyPlans(limit?: number): Promise<WeekPlan[]>         // newest first, default limit 12
```

---

## TypeScript Types

New types to define in `lib/types/local.ts`. Types already exported from `lib/api.ts` (`Meal`, `PlanDay`, `WeeklyPlanResponse`, `ExerciseLog`, `WeeklyHistorySummary`, etc.) must NOT be duplicated — import from `lib/api.ts` where they are needed.

```typescript
// Calculation results
export interface MacroResult {
  targetKcal: number
  proteinG:   number
  fatG:       number
  carbG:      number
}

export interface GamificationResult {
  level:           number
  name:            string
  xp:              number
  xpInLevel:       number
  xpToNext:        number
  xpNextLevel:     number
  progressPct:     number
  isMaxLevel:      boolean
  nextLevelName:   string | null
  breakdown: {
    training: number
    diet:     number
    combo:    number
    weight:   number
    surveys:  number
    streak:   number
  }
}

export interface LevelInfo {
  level:          number
  name:           string
  xp:             number
  xpInLevel:      number
  xpToNext:       number
  xpNextLevel:    number
  progressPct:    number
  isMaxLevel:     boolean
  nextLevelName:  string | null
}

export interface WeeklyReport {
  exDays:         number
  exKcal:         number
  currentWeight:  number | null
  weightChange:   number | null
  adherencePct:   number
  survey:         SurveyRow | null
  recommendations: string[]
}

export interface ScaledMeal {
  text:       string
  kcal:       number
  carbG:      number
  carbName:   string
  note:       string
  timingNote: string
  fixedKcal:  number
  targetKcal: number
}

export interface DayPlan {
  dailyTarget: number
  macros:      MacroResult
  meals: {
    desayuno:     ScaledMeal
    media_manana: ScaledMeal
    almuerzo:     ScaledMeal
    merienda:     ScaledMeal
    cena:         ScaledMeal
  }
}

export interface WeekPlan {
  days:                PlanDay[]    // from lib/api.ts
  generatedAt:         string       // ISO date of Monday
  weeklyTargetKcal:    number
  weeklySummaryUsed:   WeeklyHistorySummary | null
}

export interface Exercise {
  name:    string
  sets:    string
  muscles: string
}

export interface TrainingDay {
  dayNumber:   number
  sessionName: string         // "Full Body", "Push (Empuje)", etc.
  exercises:   Exercise[]
}

export interface TrainingRoutine {
  type:              'full_body' | 'ppl' | 'calistenia'
  daysPerWeek:       number
  days:              TrainingDay[]
  proteinSuggestionG: number
}

// Database row shapes
export interface ProfileRow {
  id:             number
  name:           string
  gender:         'male' | 'female'
  age:            number
  height_cm:      number
  weight_kg:      number
  activity_level: number
  goal:           'lose' | 'maintain' | 'gain'
  week_start_day: number
  updated_at?:    string
}

export interface EventRow {
  id:   number
  name: string
  date: string
}

export interface ExerciseLogRow {
  id:              number
  date:            string
  exercise_key:    string
  type:            string
  minutes:         number
  calories_burned: number
  source:          string
  created_at?:     string
}

export interface WeightEntryRow {
  id:        number
  date:      string
  weight_kg: number
}

export interface AdherenceRow {
  id:      number
  date:    string
  meal_id: string
  status:  'compliant' | 'non_compliant'
}

export interface SurveyRow {
  id:     number
  date:   string
  energy: number
  sleep:  number
  mood:   number
  hunger: number
}

export interface GamificationInput {
  exerciseLogs:  ExerciseLogRow[]
  adherenceLogs: AdherenceRow[]
  weightHistory: WeightEntryRow[]
  surveys:       SurveyRow[]
}

export interface WeeklyReportInput {
  goal:          string
  exerciseLogs:  ExerciseLogRow[]
  weightHistory: WeightEntryRow[]
  adherenceLogs: AdherenceRow[]
  survey:        SurveyRow | null
}
```

---

## Out of Scope for This Sub-project

- Wiring Next.js pages to use local data (Sub-project 2)
- `platform-api.ts` routing layer (detects Capacitor native vs. web and calls local DB vs. Python API) — Sub-project 2
- iCloud / Google Drive backup
- PDF export
- Apple Health data sync (the `source` column in `exercise_logs` is prepared for it, but ingestion is out of scope)
- Any UI changes — all existing Next.js pages continue to call the Python API unchanged until Sub-project 2
