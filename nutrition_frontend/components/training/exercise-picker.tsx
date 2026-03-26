"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Search, Dumbbell, X } from "lucide-react"
import type { LibraryExercise, MuscleGroup, Equipment } from "@/lib/workout-types"
import { searchExercises, getMuscleGroups, getEquipmentTypes } from "@/lib/workout-api"

interface ExercisePickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (exercise: LibraryExercise) => void
}

const MUSCLE_COLORS: Record<string, string> = {
  pecho: "bg-rose-400/20 text-rose-300 border-rose-400/30",
  espalda: "bg-blue-400/20 text-blue-300 border-blue-400/30",
  hombros: "bg-amber-400/20 text-amber-300 border-amber-400/30",
  biceps: "bg-purple-400/20 text-purple-300 border-purple-400/30",
  triceps: "bg-indigo-400/20 text-indigo-300 border-indigo-400/30",
  core: "bg-emerald-400/20 text-emerald-300 border-emerald-400/30",
  cuadriceps: "bg-orange-400/20 text-orange-300 border-orange-400/30",
  isquiotibiales: "bg-yellow-400/20 text-yellow-300 border-yellow-400/30",
  gluteos: "bg-pink-400/20 text-pink-300 border-pink-400/30",
  gemelos: "bg-teal-400/20 text-teal-300 border-teal-400/30",
  trapecio: "bg-cyan-400/20 text-cyan-300 border-cyan-400/30",
  antebrazo: "bg-lime-400/20 text-lime-300 border-lime-400/30",
  aductores: "bg-fuchsia-400/20 text-fuchsia-300 border-fuchsia-400/30",
  cardio: "bg-red-400/20 text-red-300 border-red-400/30",
  cuerpo_completo: "bg-sky-400/20 text-sky-300 border-sky-400/30",
}

const RECENT_KEY = "metabolic_recent_exercises"

function getRecentExercises(): string[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]")
  } catch { return [] }
}

function saveRecentExercise(id: string) {
  const recent = getRecentExercises().filter(r => r !== id)
  recent.unshift(id)
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 5)))
}

export default function ExercisePicker({ open, onOpenChange, onSelect }: ExercisePickerProps) {
  const [query, setQuery] = useState("")
  const [muscleFilter, setMuscleFilter] = useState("")
  const [equipFilter, setEquipFilter] = useState("")
  const [allExercises, setAllExercises] = useState<LibraryExercise[]>([])
  const [muscles, setMuscles] = useState<{ id: string; label: string }[]>([])
  const [equipment, setEquipment] = useState<{ id: string; label: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    Promise.all([
      searchExercises({}),
      getMuscleGroups(),
      getEquipmentTypes(),
    ]).then(([ex, m, e]) => {
      setAllExercises(ex)
      setMuscles(m)
      setEquipment(e)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [open])

  const filtered = useMemo(() => {
    let results = allExercises
    if (query) {
      const q = query.toLowerCase()
      results = results.filter(e => e.name.toLowerCase().includes(q) || e.id.includes(q))
    }
    if (muscleFilter) {
      results = results.filter(e => e.muscle_primary === muscleFilter || e.muscle_secondary?.includes(muscleFilter as MuscleGroup))
    }
    if (equipFilter) {
      results = results.filter(e => e.equipment === equipFilter)
    }
    return results
  }, [allExercises, query, muscleFilter, equipFilter])

  const recentIds = getRecentExercises()
  const recentExercises = useMemo(() => {
    if (query || muscleFilter || equipFilter) return []
    return recentIds
      .map(id => allExercises.find(e => e.id === id))
      .filter(Boolean) as LibraryExercise[]
  }, [allExercises, recentIds, query, muscleFilter, equipFilter])

  const handleSelect = useCallback((exercise: LibraryExercise) => {
    saveRecentExercise(exercise.id)
    onSelect(exercise)
    onOpenChange(false)
  }, [onSelect, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg h-[85vh] flex flex-col p-0 gap-0 backdrop-blur-xl bg-black/80 dark:bg-black/80 border-white/20 rounded-3xl">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="text-foreground">Seleccionar ejercicio</DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar ejercicio..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="pl-9 bg-white/5 border-white/20 text-foreground"
            />
          </div>
        </div>

        {/* Muscle filter chips */}
        <div className="px-4 pb-1 overflow-x-auto">
          <div className="flex gap-1.5 pb-1">
            <button
              onClick={() => setMuscleFilter("")}
              className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                !muscleFilter
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                  : "bg-white/5 text-foreground/60 border-white/10 hover:bg-white/10"
              }`}
            >
              Todos
            </button>
            {muscles.map(m => (
              <button
                key={m.id}
                onClick={() => setMuscleFilter(muscleFilter === m.id ? "" : m.id)}
                className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                  muscleFilter === m.id
                    ? (MUSCLE_COLORS[m.id] || "bg-emerald-500/20 text-emerald-300 border-emerald-500/30")
                    : "bg-white/5 text-foreground/60 border-white/10 hover:bg-white/10"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Equipment filter chips */}
        <div className="px-4 pb-2 overflow-x-auto">
          <div className="flex gap-1.5 pb-1">
            <button
              onClick={() => setEquipFilter("")}
              className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                !equipFilter
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                  : "bg-white/5 text-foreground/60 border-white/10 hover:bg-white/10"
              }`}
            >
              Todo equipo
            </button>
            {equipment.map(e => (
              <button
                key={e.id}
                onClick={() => setEquipFilter(equipFilter === e.id ? "" : e.id)}
                className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                  equipFilter === e.id
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    : "bg-white/5 text-foreground/60 border-white/10 hover:bg-white/10"
                }`}
              >
                {e.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <ScrollArea className="flex-1 px-4 pb-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">Cargando...</div>
          ) : (
            <>
              {/* Recent */}
              {recentExercises.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Recientes</p>
                  {recentExercises.map(ex => (
                    <ExerciseRow key={`recent-${ex.id}`} exercise={ex} onSelect={handleSelect} />
                  ))}
                </div>
              )}

              {/* All results */}
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                {filtered.length} ejercicio{filtered.length !== 1 ? "s" : ""}
              </p>
              {filtered.map(ex => (
                <ExerciseRow key={ex.id} exercise={ex} onSelect={handleSelect} />
              ))}
              {filtered.length === 0 && (
                <p className="text-center text-muted-foreground py-8">Sin resultados</p>
              )}
            </>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

function ExerciseRow({ exercise, onSelect }: { exercise: LibraryExercise; onSelect: (e: LibraryExercise) => void }) {
  const muscleColor = MUSCLE_COLORS[exercise.muscle_primary] || "bg-white/10 text-foreground/60 border-white/20"

  return (
    <button
      onClick={() => onSelect(exercise)}
      className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 transition-colors text-left mb-1"
    >
      <div className="h-9 w-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
        <Dumbbell className="h-4 w-4 text-emerald-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{exercise.name}</p>
        <div className="flex gap-1.5 mt-0.5">
          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium border ${muscleColor}`}>
            {exercise.muscle_primary}
          </span>
          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/5 text-foreground/50 border border-white/10">
            {exercise.equipment}
          </span>
        </div>
      </div>
    </button>
  )
}
