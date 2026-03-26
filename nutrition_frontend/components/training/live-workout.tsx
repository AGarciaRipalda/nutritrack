"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import {
  Check, Plus, Trash2, Timer, ChevronUp, ChevronDown,
  Trophy, Minus, X, Dumbbell, RotateCcw, Play, Square, SkipForward
} from "lucide-react"
import type { Workout, WorkoutExercise, WorkoutSet, PreviousSet, SetType } from "@/lib/workout-types"

// ── Props ───────────────────────────────────────────────────────────────────

interface LiveWorkoutProps {
  workout: Workout
  onUpdateSet: (exerciseId: string, setId: string, data: Partial<WorkoutSet>) => void
  onAddSet: (exerciseId: string) => void
  onDeleteSet: (exerciseId: string, setId: string) => void
  onAddExercise: () => void
  onRemoveExercise: (exerciseId: string) => void
  onFinish: (notes: string) => void
  onDiscard: () => void
  onReorderExercise?: (exerciseId: string, direction: "up" | "down") => void
}

// ── Constants ───────────────────────────────────────────────────────────────

const MUSCLE_COLORS: Record<string, string> = {
  pecho: "bg-rose-400/20 text-rose-300",
  espalda: "bg-blue-400/20 text-blue-300",
  hombros: "bg-amber-400/20 text-amber-300",
  biceps: "bg-purple-400/20 text-purple-300",
  triceps: "bg-indigo-400/20 text-indigo-300",
  core: "bg-emerald-400/20 text-emerald-300",
  cuadriceps: "bg-orange-400/20 text-orange-300",
  isquiotibiales: "bg-yellow-400/20 text-yellow-300",
  gluteos: "bg-pink-400/20 text-pink-300",
  gemelos: "bg-teal-400/20 text-teal-300",
}

const SET_TYPE_LABELS: Record<SetType, { label: string; color: string }> = {
  normal: { label: "", color: "" },
  warmup: { label: "W", color: "text-yellow-400" },
  dropset: { label: "D", color: "text-purple-400" },
  failure: { label: "F", color: "text-red-400" },
  rest_pause: { label: "RP", color: "text-blue-400" },
}

const STORAGE_KEY = "metabolic_active_workout"

// ── Rest Timer Component ────────────────────────────────────────────────────

function RestTimer({
  seconds,
  onComplete,
  onSkip,
  onAdjust,
}: {
  seconds: number
  onComplete: () => void
  onSkip: () => void
  onAdjust: (delta: number) => void
}) {
  const [remaining, setRemaining] = useState(seconds)
  const [total, setTotal] = useState(seconds)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setRemaining(seconds)
    setTotal(seconds)
  }, [seconds])

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!)
          onComplete()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [total, onComplete])

  const handleAdjust = (delta: number) => {
    setRemaining(prev => Math.max(0, prev + delta))
    setTotal(prev => Math.max(15, prev + delta))
    onAdjust(delta)
  }

  const progress = total > 0 ? ((total - remaining) / total) * 100 : 100
  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60

  return (
    <div className="backdrop-blur-xl bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 mx-4 mb-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-medium text-emerald-300">Descanso</span>
        </div>
        <span className="text-2xl font-mono font-bold text-emerald-400">
          {mins}:{secs.toString().padStart(2, "0")}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-white/10 rounded-full mb-3 overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center justify-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleAdjust(-15)}
          className="h-8 text-xs text-foreground/60 hover:text-foreground"
        >
          <Minus className="h-3 w-3 mr-1" />15s
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleAdjust(15)}
          className="h-8 text-xs text-foreground/60 hover:text-foreground"
        >
          <Plus className="h-3 w-3 mr-1" />15s
        </Button>
        <Button
          size="sm"
          onClick={onSkip}
          className="h-8 text-xs bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
        >
          <SkipForward className="h-3 w-3 mr-1" /> Saltar
        </Button>
      </div>
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function LiveWorkout({
  workout,
  onUpdateSet,
  onAddSet,
  onDeleteSet,
  onAddExercise,
  onRemoveExercise,
  onFinish,
  onDiscard,
  onReorderExercise,
}: LiveWorkoutProps) {
  const [elapsed, setElapsed] = useState(0)
  const [restTimer, setRestTimer] = useState<{ exerciseId: string; seconds: number } | null>(null)
  const [notes, setNotes] = useState("")
  const [showFinishConfirm, setShowFinishConfirm] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)

  // Elapsed timer
  useEffect(() => {
    const start = new Date(workout.started_at).getTime()
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000))
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [workout.started_at])

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workout))
    } catch {}
  }, [workout])

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
    return `${m}:${s.toString().padStart(2, "0")}`
  }

  const handleSetComplete = useCallback((exercise: WorkoutExercise, set: WorkoutSet) => {
    onUpdateSet(exercise.id, set.id, { completed: !set.completed })
    if (!set.completed) {
      // Start rest timer
      setRestTimer({ exerciseId: exercise.id, seconds: exercise.rest_seconds || 90 })
    }
  }, [onUpdateSet])

  const handleSetTypeToggle = useCallback((exercise: WorkoutExercise, set: WorkoutSet) => {
    const types: SetType[] = ["normal", "warmup", "dropset", "failure", "rest_pause"]
    const currentIdx = types.indexOf(set.set_type || "normal")
    const nextType = types[(currentIdx + 1) % types.length]
    onUpdateSet(exercise.id, set.id, { set_type: nextType })
  }, [onUpdateSet])

  // Check for PRs client-side
  const isPR = (exercise: WorkoutExercise, set: WorkoutSet): boolean => {
    if (!set.completed || set.set_type === "warmup") return false
    const w = set.weight_kg || 0
    const r = set.reps || 0
    if (w <= 0 || r <= 0) return false
    const prevSets = exercise.previous_sets || []
    const bestPrevWeight = Math.max(0, ...prevSets.map(p => p.weight_kg || 0))
    return w > bestPrevWeight
  }

  const totalVolume = workout.exercises.reduce((total, ex) => {
    return total + ex.sets.reduce((sum, s) => {
      if (!s.completed) return sum
      return sum + (s.weight_kg || 0) * (s.reps || 0)
    }, 0)
  }, 0)

  const completedSets = workout.exercises.reduce((total, ex) => {
    return total + ex.sets.filter(s => s.completed).length
  }, 0)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 backdrop-blur-xl bg-white/5 border-b border-white/10 p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-foreground truncate flex-1">{workout.name}</h2>
          <span className="text-lg font-mono font-bold text-emerald-400 ml-2">{formatTime(elapsed)}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex gap-3 text-xs text-foreground/50">
            <span>{completedSets} series</span>
            <span>{Math.round(totalVolume).toLocaleString()} kg vol.</span>
          </div>
          <div className="flex gap-2">
            {showDiscardConfirm ? (
              <div className="flex gap-1 items-center">
                <span className="text-xs text-red-400 mr-1">Descartar?</span>
                <Button size="sm" variant="ghost" onClick={() => setShowDiscardConfirm(false)} className="h-7 text-xs">No</Button>
                <Button size="sm" onClick={() => { localStorage.removeItem(STORAGE_KEY); onDiscard() }} className="h-7 text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30">Sí</Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowDiscardConfirm(true)}
                className="h-7 text-xs text-red-400/60 hover:text-red-400"
              >
                <Trash2 className="h-3 w-3 mr-1" /> Descartar
              </Button>
            )}

            {showFinishConfirm ? (
              <div className="flex gap-1 items-center">
                <span className="text-xs text-emerald-400 mr-1">Terminar?</span>
                <Button size="sm" variant="ghost" onClick={() => setShowFinishConfirm(false)} className="h-7 text-xs">No</Button>
                <Button size="sm" onClick={() => { localStorage.removeItem(STORAGE_KEY); onFinish(notes) }} className="h-7 text-xs bg-emerald-500 hover:bg-emerald-600 text-white">Sí</Button>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={() => setShowFinishConfirm(true)}
                className="h-7 text-xs bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                <Check className="h-3 w-3 mr-1" /> Terminar
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Rest Timer */}
      {restTimer && (
        <div className="shrink-0 pt-3">
          <RestTimer
            seconds={restTimer.seconds}
            onComplete={() => setRestTimer(null)}
            onSkip={() => setRestTimer(null)}
            onAdjust={() => {}}
          />
        </div>
      )}

      {/* Exercises */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {workout.exercises.map((exercise, exIdx) => {
            const mc = MUSCLE_COLORS[exercise.muscle_primary] || "bg-white/10 text-foreground/60"
            const isSuperset = exercise.superset_group != null
            const prevEx = exIdx > 0 ? workout.exercises[exIdx - 1] : null
            const showSupersetLabel = isSuperset && (!prevEx || prevEx.superset_group !== exercise.superset_group)

            return (
              <div key={exercise.id}>
                {/* Superset label */}
                {showSupersetLabel && (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-px flex-1 bg-purple-500/30" />
                    <span className="text-xs font-medium text-purple-400">Superserie</span>
                    <div className="h-px flex-1 bg-purple-500/30" />
                  </div>
                )}

                <div className={`backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl overflow-hidden ${isSuperset ? "border-l-2 border-l-purple-500/50" : ""}`}>
                  {/* Exercise header */}
                  <div className="flex items-center gap-2 p-3 pb-2">
                    {onReorderExercise && (
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button onClick={() => onReorderExercise(exercise.id, "up")} disabled={exIdx === 0} className="p-0.5 text-foreground/20 hover:text-foreground/50 disabled:opacity-30">
                          <ChevronUp className="h-3 w-3" />
                        </button>
                        <button onClick={() => onReorderExercise(exercise.id, "down")} disabled={exIdx === workout.exercises.length - 1} className="p-0.5 text-foreground/20 hover:text-foreground/50 disabled:opacity-30">
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    <Dumbbell className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span className="text-sm font-bold text-foreground flex-1 truncate">{exercise.exercise_name}</span>
                    <Badge variant="outline" className={`text-[10px] border-0 ${mc}`}>{exercise.muscle_primary}</Badge>
                    <button
                      onClick={() => onRemoveExercise(exercise.id)}
                      className="p-1 rounded text-red-400/40 hover:text-red-400 hover:bg-red-500/10"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Column headers */}
                  <div className="grid grid-cols-[40px_1fr_60px_60px_40px_36px] gap-1 px-3 pb-1 text-[10px] text-foreground/30 uppercase tracking-wider font-medium">
                    <span>Set</span>
                    <span>Anterior</span>
                    <span className="text-center">Kg</span>
                    <span className="text-center">Reps</span>
                    <span className="text-center">RPE</span>
                    <span />
                  </div>

                  {/* Set rows */}
                  <div className="px-3 pb-2 space-y-1">
                    {exercise.sets.map((set, setIdx) => {
                      const typeInfo = SET_TYPE_LABELS[set.set_type || "normal"]
                      const prev = (exercise.previous_sets || [])[setIdx]
                      const prDetected = isPR(exercise, set)

                      return (
                        <div
                          key={set.id}
                          className={`grid grid-cols-[40px_1fr_60px_60px_40px_36px] gap-1 items-center rounded-lg py-1 px-1 transition-colors ${
                            set.completed ? "bg-emerald-500/10" : ""
                          }`}
                        >
                          {/* Set number / type */}
                          <button
                            onClick={() => handleSetTypeToggle(exercise, set)}
                            className={`text-xs font-bold text-center ${typeInfo.color || "text-foreground/50"}`}
                            title="Cambiar tipo de serie"
                          >
                            {typeInfo.label || set.set_number}
                          </button>

                          {/* Previous */}
                          <span className="text-xs text-foreground/30 truncate">
                            {prev ? `${prev.weight_kg ?? "-"}kg × ${prev.reps ?? "-"}` : "—"}
                          </span>

                          {/* Weight */}
                          <Input
                            type="number"
                            step="0.5"
                            min={0}
                            value={set.weight_kg ?? ""}
                            onChange={e => onUpdateSet(exercise.id, set.id, { weight_kg: e.target.value ? Number(e.target.value) : null })}
                            className="h-8 text-xs text-center bg-white/5 border-white/10 text-foreground px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            placeholder="—"
                          />

                          {/* Reps */}
                          <Input
                            type="number"
                            min={0}
                            value={set.reps ?? ""}
                            onChange={e => onUpdateSet(exercise.id, set.id, { reps: e.target.value ? Number(e.target.value) : null })}
                            className="h-8 text-xs text-center bg-white/5 border-white/10 text-foreground px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            placeholder="—"
                          />

                          {/* RPE */}
                          <Input
                            type="number"
                            min={1}
                            max={10}
                            value={set.rpe ?? ""}
                            onChange={e => onUpdateSet(exercise.id, set.id, { rpe: e.target.value ? Number(e.target.value) : null })}
                            className="h-8 text-[10px] text-center bg-white/5 border-white/10 text-foreground/50 px-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            placeholder="—"
                          />

                          {/* Complete checkbox + PR */}
                          <div className="flex items-center justify-center gap-0.5">
                            <button
                              onClick={() => handleSetComplete(exercise, set)}
                              className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors ${
                                set.completed
                                  ? "bg-emerald-500 text-white"
                                  : "bg-white/5 border border-white/20 text-foreground/30 hover:text-foreground/60"
                              }`}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            {prDetected && (
                              <Trophy className="h-3 w-3 text-amber-400 shrink-0" />
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Add set + delete set */}
                  <div className="flex items-center justify-between px-3 pb-3">
                    <button
                      onClick={() => onAddSet(exercise.id)}
                      className="flex items-center gap-1 text-xs text-foreground/40 hover:text-emerald-400 transition-colors"
                    >
                      <Plus className="h-3 w-3" /> Añadir serie
                    </button>
                    {exercise.sets.length > 1 && (
                      <button
                        onClick={() => {
                          const lastSet = exercise.sets[exercise.sets.length - 1]
                          onDeleteSet(exercise.id, lastSet.id)
                        }}
                        className="flex items-center gap-1 text-xs text-red-400/40 hover:text-red-400 transition-colors"
                      >
                        <Minus className="h-3 w-3" /> Quitar última
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Add exercise */}
          <button
            onClick={onAddExercise}
            className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl border border-dashed border-white/20 text-foreground/40 hover:text-emerald-400 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span className="text-sm font-medium">Añadir ejercicio</span>
          </button>

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-xs text-foreground/40">Notas del workout</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notas opcionales..."
              rows={2}
              className="w-full rounded-xl bg-white/5 border border-white/10 text-foreground text-sm p-3 resize-none placeholder:text-foreground/20 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
            />
          </div>

          {/* Bottom spacer for mobile */}
          <div className="h-8" />
        </div>
      </ScrollArea>
    </div>
  )
}
