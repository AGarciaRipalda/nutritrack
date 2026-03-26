// ============================================================================
// Training 2.0 — Shared TypeScript types
// ============================================================================

// ── Exercise Library ────────────────────────────────────────────────────────

export type MuscleGroup =
  | "pecho" | "espalda" | "hombros" | "biceps" | "triceps"
  | "antebrazo" | "core" | "cuadriceps" | "isquiotibiales"
  | "gluteos" | "gemelos" | "aductores" | "trapecio"
  | "cardio" | "cuerpo_completo"

export type Equipment =
  | "barra" | "mancuernas" | "maquina" | "cable"
  | "peso_corporal" | "kettlebell" | "banda_elastica"
  | "barra_ez" | "polea" | "smith" | "trx" | "ninguno"

export type ExerciseCategory =
  | "fuerza" | "cardio" | "flexibilidad" | "pliometria"

export type ForceType = "push" | "pull" | "isometric" | "compound" | "cardio"

export interface LibraryExercise {
  id: string                      // "bench_press", "squat", etc.
  name: string                    // "Press de banca"
  muscle_primary: MuscleGroup
  muscle_secondary: MuscleGroup[]
  equipment: Equipment
  category: ExerciseCategory
  force: ForceType
  instructions?: string
  is_custom?: boolean
}

// ── Sets & Series ───────────────────────────────────────────────────────────

export type SetType = "normal" | "warmup" | "dropset" | "failure" | "rest_pause"

export interface WorkoutSet {
  id: string
  set_number: number
  set_type: SetType
  weight_kg: number | null
  reps: number | null
  rpe: number | null            // 1-10 Rate of Perceived Exertion
  duration_sec: number | null   // for timed exercises (planks, cardio)
  completed: boolean
  is_pr?: boolean               // flagged if this set is a new PR
}

export interface PreviousSet {
  set_number: number
  weight_kg: number | null
  reps: number | null
  rpe: number | null
}

// ── Workout Exercise (exercise inside a workout) ────────────────────────────

export interface WorkoutExercise {
  id: string                       // unique within workout
  exercise_id: string              // ref to LibraryExercise.id
  exercise_name: string
  muscle_primary: MuscleGroup
  sets: WorkoutSet[]
  previous_sets: PreviousSet[]     // from last time this exercise was done
  rest_seconds: number             // default rest timer for this exercise
  notes: string
  superset_group: string | null    // group id if part of a superset
  order: number
}

// ── Routine (template) ──────────────────────────────────────────────────────

export interface RoutineExercise {
  exercise_id: string
  exercise_name: string
  muscle_primary: MuscleGroup
  target_sets: number
  target_reps: string             // "8-12", "5", "AMRAP", "60s"
  target_weight_kg: number | null
  rest_seconds: number
  notes: string
  superset_group: string | null
  order: number
}

export interface RoutineDay {
  id: string
  label: string                   // "Push", "Pull", "Legs", "Full Body A"
  exercises: RoutineExercise[]
}

export interface Routine {
  id: string
  name: string                    // "PPL 6 días", "Full Body 3x"
  description: string
  days: RoutineDay[]
  created_at: string              // ISO date
  updated_at: string
}

// ── Workout (executed session) ──────────────────────────────────────────────

export type WorkoutStatus = "active" | "completed" | "discarded"

export interface Workout {
  id: string
  routine_id: string | null       // null if started from scratch
  routine_day_id: string | null
  name: string                    // "Push - 26 mar 2026"
  status: WorkoutStatus
  started_at: string              // ISO datetime
  finished_at: string | null
  duration_seconds: number | null
  exercises: WorkoutExercise[]
  total_volume_kg: number         // sum(weight * reps) across all sets
  total_sets: number
  prs_hit: PRRecord[]             // PRs achieved during this workout
  notes: string
  training_block?: "morning" | "midday" | "afternoon" | "evening" | null
}

// ── PRs & Records ───────────────────────────────────────────────────────────

export type PRType = "1rm" | "weight" | "volume" | "reps"

export interface PRRecord {
  id: string
  exercise_id: string
  exercise_name: string
  pr_type: PRType
  value: number                   // kg for weight/1rm/volume, count for reps
  reps: number | null             // only for set records
  weight_kg: number | null
  date: string                    // ISO date
  workout_id: string
}

export interface ExerciseStats {
  exercise_id: string
  exercise_name: string
  estimated_1rm: number | null
  best_weight: number | null
  best_volume_set: number | null  // best single-set volume (weight * reps)
  best_total_volume: number | null // best session total volume
  total_times_performed: number
  last_performed: string | null   // ISO date
  set_records: Record<number, { weight_kg: number; date: string }> // reps -> best weight
  history: {
    date: string
    estimated_1rm: number | null
    total_volume: number
    top_set_weight: number
    top_set_reps: number
  }[]
}

// ── Analytics ───────────────────────────────────────────────────────────────

export interface MuscleVolumeData {
  muscle: MuscleGroup
  label: string
  sets: number
  volume_kg: number
  percentage: number
}

export interface WeeklyTrainingStats {
  week_start: string
  workouts_count: number
  total_volume_kg: number
  total_sets: number
  total_duration_min: number
  muscle_distribution: MuscleVolumeData[]
  prs_count: number
}

export interface TrainingCalendarDay {
  date: string
  trained: boolean
  workout_names: string[]
  total_volume_kg: number
  muscles_hit: MuscleGroup[]
  source: ("manual" | "apple_health" | "sheets")[]
}

// ── Rest Timer ──────────────────────────────────────────────────────────────

export interface RestTimerState {
  is_running: boolean
  remaining_seconds: number
  total_seconds: number
}

// ── API Request/Response types ──────────────────────────────────────────────

export interface CreateRoutineRequest {
  name: string
  description: string
  days: Omit<RoutineDay, "id">[]
}

export interface StartWorkoutRequest {
  routine_id?: string
  routine_day_id?: string
  name?: string
  training_block?: "morning" | "midday" | "afternoon" | "evening"
}

export interface UpdateWorkoutSetRequest {
  workout_id: string
  exercise_id: string
  set_id: string
  weight_kg?: number | null
  reps?: number | null
  rpe?: number | null
  duration_sec?: number | null
  completed?: boolean
  set_type?: SetType
}

export interface FinishWorkoutRequest {
  workout_id: string
  notes?: string
}

export interface WorkoutSummary {
  id: string
  name: string
  date: string
  duration_min: number
  total_volume_kg: number
  total_sets: number
  exercises_count: number
  prs_count: number
  muscles: MuscleGroup[]
}
