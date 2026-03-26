// ============================================================================
// Training 2.0 — API Client
// ============================================================================
//
// Mirrors the helper pattern from lib/api.ts (get / post / put / del).
// All endpoints hit the /v2/training/* namespace.
// ============================================================================

import type {
  LibraryExercise,
  Routine,
  CreateRoutineRequest,
  Workout,
  WorkoutExercise,
  WorkoutSet,
  WorkoutSummary,
  StartWorkoutRequest,
  ExerciseStats,
  MuscleVolumeData,
  WeeklyTrainingStats,
  TrainingCalendarDay,
  PRRecord,
} from "./workout-types"

// ── Config ──────────────────────────────────────────────────────────────────

const API_BASE =
  (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/+$/, "")

// ── Helpers (same pattern as lib/api.ts) ────────────────────────────────────

function getHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    "ngrok-skip-browser-warning": "true",
    "X-User-Timezone": Intl.DateTimeFormat().resolvedOptions().timeZone,
    ...extra,
  }
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    headers: getHeaders(),
    signal,
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
  const res = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: getHeaders(),
  })
  if (!res.ok) throw new Error(`DELETE ${path} failed: ${res.status}`)
}

// ── Exercise Library ────────────────────────────────────────────────────────

export async function searchExercises(params: {
  q?: string
  muscle?: string
  equipment?: string
  category?: string
}): Promise<LibraryExercise[]> {
  const sp = new URLSearchParams()
  if (params.q) sp.set("q", params.q)
  if (params.muscle) sp.set("muscle", params.muscle)
  if (params.equipment) sp.set("equipment", params.equipment)
  if (params.category) sp.set("category", params.category)
  const qs = sp.toString()
  return get<LibraryExercise[]>(`/v2/training/exercises${qs ? `?${qs}` : ""}`)
}

export async function getExercise(id: string): Promise<LibraryExercise> {
  return get<LibraryExercise>(`/v2/training/exercises/${id}`)
}

export async function getMuscleGroups(): Promise<{ id: string; label: string }[]> {
  return get<{ id: string; label: string }[]>("/v2/training/muscles")
}

export async function getEquipmentTypes(): Promise<{ id: string; label: string }[]> {
  return get<{ id: string; label: string }[]>("/v2/training/equipment")
}

// ── Routines ────────────────────────────────────────────────────────────────

export async function listRoutines(): Promise<Routine[]> {
  return get<Routine[]>("/v2/training/routines")
}

export async function getRoutine(id: string): Promise<Routine> {
  return get<Routine>(`/v2/training/routines/${id}`)
}

export async function createRoutine(data: CreateRoutineRequest): Promise<Routine> {
  return post<Routine>("/v2/training/routines", data)
}

export async function updateRoutine(id: string, data: Partial<Routine>): Promise<Routine> {
  return put<Routine>(`/v2/training/routines/${id}`, data)
}

export async function deleteRoutine(id: string): Promise<void> {
  return del(`/v2/training/routines/${id}`)
}

// ── Workouts ────────────────────────────────────────────────────────────────

export async function startWorkout(data: StartWorkoutRequest): Promise<Workout> {
  return post<Workout>("/v2/training/workouts", data)
}

export async function getActiveWorkout(): Promise<Workout | null> {
  try {
    return await get<Workout>("/v2/training/workouts/active")
  } catch {
    return null
  }
}

export async function getWorkout(id: string): Promise<Workout> {
  return get<Workout>(`/v2/training/workouts/${id}`)
}

export async function addExerciseToWorkout(
  workoutId: string,
  exerciseId: string,
): Promise<WorkoutExercise> {
  return post<WorkoutExercise>(
    `/v2/training/workouts/${workoutId}/exercises`,
    { exercise_id: exerciseId },
  )
}

export async function removeExerciseFromWorkout(
  workoutId: string,
  exerciseId: string,
): Promise<void> {
  return del(`/v2/training/workouts/${workoutId}/exercises/${exerciseId}`)
}

export async function addSet(
  workoutId: string,
  exerciseId: string,
): Promise<WorkoutSet> {
  return post<WorkoutSet>(
    `/v2/training/workouts/${workoutId}/exercises/${exerciseId}/sets`,
  )
}

export async function updateSet(
  workoutId: string,
  exerciseId: string,
  setId: string,
  data: Partial<WorkoutSet>,
): Promise<WorkoutSet> {
  return put<WorkoutSet>(
    `/v2/training/workouts/${workoutId}/exercises/${exerciseId}/sets/${setId}`,
    data,
  )
}

export async function deleteSet(
  workoutId: string,
  exerciseId: string,
  setId: string,
): Promise<void> {
  return del(
    `/v2/training/workouts/${workoutId}/exercises/${exerciseId}/sets/${setId}`,
  )
}

export async function finishWorkout(
  workoutId: string,
  notes?: string,
): Promise<Workout> {
  return post<Workout>(`/v2/training/workouts/${workoutId}/finish`, { notes })
}

export async function discardWorkout(workoutId: string): Promise<void> {
  return del(`/v2/training/workouts/${workoutId}`)
}

export async function listWorkouts(
  limit?: number,
  offset?: number,
): Promise<WorkoutSummary[]> {
  const sp = new URLSearchParams()
  if (limit !== undefined) sp.set("limit", String(limit))
  if (offset !== undefined) sp.set("offset", String(offset))
  const qs = sp.toString()
  return get<WorkoutSummary[]>(`/v2/training/workouts${qs ? `?${qs}` : ""}`)
}

// ── Analytics ───────────────────────────────────────────────────────────────

export async function getExerciseStats(exerciseId: string): Promise<ExerciseStats> {
  return get<ExerciseStats>(`/v2/training/analytics/exercise/${exerciseId}`)
}

export async function getMuscleVolume(days?: number): Promise<MuscleVolumeData[]> {
  const qs = days !== undefined ? `?days=${days}` : ""
  return get<MuscleVolumeData[]>(`/v2/training/analytics/muscle-volume${qs}`)
}

export async function getWeeklyStats(weeks?: number): Promise<WeeklyTrainingStats[]> {
  const qs = weeks !== undefined ? `?weeks=${weeks}` : ""
  return get<WeeklyTrainingStats[]>(`/v2/training/analytics/weekly${qs}`)
}

export async function getCalendarData(
  year: number,
  month: number,
): Promise<TrainingCalendarDay[]> {
  return get<TrainingCalendarDay[]>(
    `/v2/training/analytics/calendar?year=${year}&month=${month}`,
  )
}

export async function getRecentPRs(): Promise<PRRecord[]> {
  return get<PRRecord[]>("/v2/training/analytics/prs")
}
