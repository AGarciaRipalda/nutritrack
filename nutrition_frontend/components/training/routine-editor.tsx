"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, ChevronUp, ChevronDown, Save, X, Dumbbell, Link } from "lucide-react"
import type { Routine, RoutineDay, RoutineExercise, LibraryExercise, MuscleGroup } from "@/lib/workout-types"
import ExercisePicker from "./exercise-picker"

interface RoutineEditorProps {
  routine?: Routine
  onSave: (data: { name: string; description: string; days: RoutineDay[] }) => void
  onCancel: () => void
}

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
  trapecio: "bg-cyan-400/20 text-cyan-300",
  antebrazo: "bg-lime-400/20 text-lime-300",
}

let nextId = 1
function genId() { return `tmp_${Date.now()}_${nextId++}` }

function emptyDay(): RoutineDay {
  return { id: genId(), label: "", exercises: [] }
}

function exerciseFromLib(lib: LibraryExercise, order: number): RoutineExercise {
  return {
    exercise_id: lib.id,
    exercise_name: lib.name,
    muscle_primary: lib.muscle_primary,
    target_sets: 3,
    target_reps: "8-12",
    target_weight_kg: null,
    rest_seconds: 90,
    notes: "",
    superset_group: null,
    order,
  }
}

export default function RoutineEditor({ routine, onSave, onCancel }: RoutineEditorProps) {
  const [name, setName] = useState(routine?.name || "")
  const [description, setDescription] = useState(routine?.description || "")
  const [days, setDays] = useState<RoutineDay[]>(
    routine?.days?.length ? routine.days : [emptyDay()]
  )
  const [activeDay, setActiveDay] = useState(0)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerDayIdx, setPickerDayIdx] = useState(0)

  const updateDay = useCallback((idx: number, patch: Partial<RoutineDay>) => {
    setDays(prev => prev.map((d, i) => i === idx ? { ...d, ...patch } : d))
  }, [])

  const addDay = useCallback(() => {
    setDays(prev => [...prev, emptyDay()])
    setActiveDay(days.length)
  }, [days.length])

  const removeDay = useCallback((idx: number) => {
    setDays(prev => prev.filter((_, i) => i !== idx))
    setActiveDay(a => Math.min(a, days.length - 2))
  }, [days.length])

  const openPickerForDay = useCallback((dayIdx: number) => {
    setPickerDayIdx(dayIdx)
    setPickerOpen(true)
  }, [])

  const handleExerciseSelect = useCallback((exercise: LibraryExercise) => {
    setDays(prev => prev.map((d, i) => {
      if (i !== pickerDayIdx) return d
      return {
        ...d,
        exercises: [...d.exercises, exerciseFromLib(exercise, d.exercises.length)],
      }
    }))
  }, [pickerDayIdx])

  const removeExercise = useCallback((dayIdx: number, exIdx: number) => {
    setDays(prev => prev.map((d, i) => {
      if (i !== dayIdx) return d
      const exercises = d.exercises.filter((_, j) => j !== exIdx).map((e, j) => ({ ...e, order: j }))
      return { ...d, exercises }
    }))
  }, [])

  const moveExercise = useCallback((dayIdx: number, exIdx: number, dir: "up" | "down") => {
    setDays(prev => prev.map((d, i) => {
      if (i !== dayIdx) return d
      const arr = [...d.exercises]
      const target = dir === "up" ? exIdx - 1 : exIdx + 1
      if (target < 0 || target >= arr.length) return d
      ;[arr[exIdx], arr[target]] = [arr[target], arr[exIdx]]
      return { ...d, exercises: arr.map((e, j) => ({ ...e, order: j })) }
    }))
  }, [])

  const updateExercise = useCallback((dayIdx: number, exIdx: number, patch: Partial<RoutineExercise>) => {
    setDays(prev => prev.map((d, i) => {
      if (i !== dayIdx) return d
      return {
        ...d,
        exercises: d.exercises.map((e, j) => j === exIdx ? { ...e, ...patch } : e),
      }
    }))
  }, [])

  const handleSave = () => {
    if (!name.trim()) return
    onSave({ name: name.trim(), description: description.trim(), days })
  }

  const currentDay = days[activeDay]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h2 className="text-lg font-bold text-foreground">
          {routine ? "Editar rutina" : "Nueva rutina"}
        </h2>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={handleSave} className="bg-emerald-500 hover:bg-emerald-600 text-white">
            <Save className="h-4 w-4 mr-1" /> Guardar
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Name & description */}
          <div className="space-y-2">
            <Label className="text-foreground/80">Nombre</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Push Pull Legs"
              className="bg-white/5 border-white/20 text-foreground"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-foreground/80">Descripción (opcional)</Label>
            <Input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ej: Rutina de 6 días enfocada en hipertrofia"
              className="bg-white/5 border-white/20 text-foreground"
            />
          </div>

          {/* Day tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {days.map((d, i) => (
              <button
                key={d.id}
                onClick={() => setActiveDay(i)}
                className={`shrink-0 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors border ${
                  i === activeDay
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    : "bg-white/5 text-foreground/60 border-white/10 hover:bg-white/10"
                }`}
              >
                {d.label || `Día ${i + 1}`}
              </button>
            ))}
            <button
              onClick={addDay}
              className="shrink-0 px-3 py-1.5 rounded-xl text-sm font-medium bg-white/5 text-foreground/40 border border-dashed border-white/20 hover:bg-white/10 transition-colors"
            >
              <Plus className="h-3 w-3 inline mr-1" />Día
            </button>
          </div>

          {/* Current day editor */}
          {currentDay && (
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Input
                  value={currentDay.label}
                  onChange={e => updateDay(activeDay, { label: e.target.value })}
                  placeholder="Nombre del día (ej: Push, Pull, Legs)"
                  className="bg-white/5 border-white/20 text-foreground text-sm flex-1"
                />
                {days.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeDay(activeDay)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Exercises list */}
              <div className="space-y-2">
                {currentDay.exercises.map((ex, exIdx) => {
                  const mc = MUSCLE_COLORS[ex.muscle_primary] || "bg-white/10 text-foreground/60"
                  return (
                    <div
                      key={`${currentDay.id}-${exIdx}`}
                      className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col gap-0.5 shrink-0">
                          <button
                            onClick={() => moveExercise(activeDay, exIdx, "up")}
                            disabled={exIdx === 0}
                            className="p-0.5 rounded text-foreground/30 hover:text-foreground/60 disabled:opacity-30"
                          >
                            <ChevronUp className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => moveExercise(activeDay, exIdx, "down")}
                            disabled={exIdx === currentDay.exercises.length - 1}
                            className="p-0.5 rounded text-foreground/30 hover:text-foreground/60 disabled:opacity-30"
                          >
                            <ChevronDown className="h-3 w-3" />
                          </button>
                        </div>
                        <Dumbbell className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span className="text-sm font-medium text-foreground flex-1 truncate">{ex.exercise_name}</span>
                        <Badge variant="outline" className={`text-[10px] ${mc} border-0`}>
                          {ex.muscle_primary}
                        </Badge>
                        <button
                          onClick={() => removeExercise(activeDay, exIdx)}
                          className="p-1 rounded text-red-400/60 hover:text-red-400 hover:bg-red-500/10 shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Set config */}
                      <div className="flex gap-2 items-center">
                        <div className="flex-1 space-y-0.5">
                          <label className="text-[10px] text-foreground/50">Series</label>
                          <Input
                            type="number"
                            min={1}
                            max={10}
                            value={ex.target_sets}
                            onChange={e => updateExercise(activeDay, exIdx, { target_sets: Number(e.target.value) || 3 })}
                            className="h-8 text-xs bg-white/5 border-white/10 text-foreground"
                          />
                        </div>
                        <div className="flex-1 space-y-0.5">
                          <label className="text-[10px] text-foreground/50">Reps</label>
                          <Input
                            value={ex.target_reps}
                            onChange={e => updateExercise(activeDay, exIdx, { target_reps: e.target.value })}
                            className="h-8 text-xs bg-white/5 border-white/10 text-foreground"
                            placeholder="8-12"
                          />
                        </div>
                        <div className="flex-1 space-y-0.5">
                          <label className="text-[10px] text-foreground/50">Descanso</label>
                          <Input
                            type="number"
                            min={0}
                            step={15}
                            value={ex.rest_seconds}
                            onChange={e => updateExercise(activeDay, exIdx, { rest_seconds: Number(e.target.value) || 90 })}
                            className="h-8 text-xs bg-white/5 border-white/10 text-foreground"
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* Add exercise button */}
                <button
                  onClick={() => openPickerForDay(activeDay)}
                  className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-white/20 text-foreground/40 hover:text-emerald-400 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span className="text-sm">Añadir ejercicio</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <ExercisePicker open={pickerOpen} onOpenChange={setPickerOpen} onSelect={handleExerciseSelect} />
    </div>
  )
}
