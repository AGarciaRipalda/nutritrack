"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Play, Edit, Trash2, ChevronDown, ChevronUp, Dumbbell, Calendar } from "lucide-react"
import type { Routine } from "@/lib/workout-types"

interface RoutineCardProps {
  routine: Routine
  onStartWorkout: (routine: Routine, dayId: string) => void
  onEdit: (routine: Routine) => void
  onDelete: (routine: Routine) => void
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
}

export default function RoutineCard({ routine, onStartWorkout, onEdit, onDelete }: RoutineCardProps) {
  const [expanded, setExpanded] = useState(false)

  const muscles = new Set<string>()
  routine.days.forEach(d => d.exercises.forEach(e => muscles.add(e.muscle_primary)))
  const totalExercises = routine.days.reduce((sum, d) => sum + d.exercises.length, 0)

  return (
    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-foreground truncate">{routine.name}</h3>
            {routine.description && (
              <p className="text-xs text-foreground/50 mt-0.5 truncate">{routine.description}</p>
            )}
          </div>
          <div className="flex gap-1 shrink-0 ml-2">
            <button
              onClick={() => onEdit(routine)}
              className="p-1.5 rounded-lg text-foreground/40 hover:text-foreground/70 hover:bg-white/5"
            >
              <Edit className="h-4 w-4" />
            </button>
            <button
              onClick={() => onDelete(routine)}
              className="p-1.5 rounded-lg text-red-400/40 hover:text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 text-xs text-foreground/50 mb-3">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />{routine.days.length} día{routine.days.length !== 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1">
            <Dumbbell className="h-3 w-3" />{totalExercises} ejercicios
          </span>
        </div>

        {/* Muscle badges */}
        <div className="flex flex-wrap gap-1 mb-3">
          {Array.from(muscles).map(m => (
            <Badge
              key={m}
              variant="outline"
              className={`text-[10px] border-0 ${MUSCLE_COLORS[m] || "bg-white/10 text-foreground/60"}`}
            >
              {m}
            </Badge>
          ))}
        </div>

        {/* Expand/collapse for day details */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-foreground/40 hover:text-foreground/60"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? "Ocultar días" : "Ver días"}
        </button>
      </div>

      {/* Day details (expanded) */}
      {expanded && (
        <div className="border-t border-white/10 px-4 py-3 space-y-3">
          {routine.days.map(day => (
            <div key={day.id} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground/80">
                  {day.label || "Sin nombre"}
                </span>
                <Button
                  size="sm"
                  onClick={() => onStartWorkout(routine, day.id)}
                  className="h-7 px-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs"
                >
                  <Play className="h-3 w-3 mr-1" /> Iniciar
                </Button>
              </div>
              <div className="pl-2 space-y-0.5">
                {day.exercises.map((ex, i) => (
                  <p key={i} className="text-xs text-foreground/50">
                    {ex.exercise_name} — {ex.target_sets}×{ex.target_reps}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick start (collapsed) */}
      {!expanded && routine.days.length > 0 && (
        <div className="border-t border-white/10 px-4 py-3">
          <div className="flex gap-2 overflow-x-auto">
            {routine.days.map(day => (
              <Button
                key={day.id}
                size="sm"
                onClick={() => onStartWorkout(routine, day.id)}
                className="shrink-0 h-8 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs"
              >
                <Play className="h-3 w-3 mr-1" /> {day.label || "Día"}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
