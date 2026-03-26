"use client"

import { BarChart3, Dumbbell } from "lucide-react"
import type { MuscleVolumeData } from "@/lib/workout-types"

interface MuscleVolumeChartProps {
  data: MuscleVolumeData[]
  totalSets: number
  totalVolume: number
  period: number
  onPeriodChange?: (days: number) => void
}

const MUSCLE_BAR_COLORS: Record<string, string> = {
  pecho: "bg-rose-400",
  espalda: "bg-blue-400",
  hombros: "bg-amber-400",
  biceps: "bg-purple-400",
  triceps: "bg-indigo-400",
  core: "bg-emerald-400",
  cuadriceps: "bg-orange-400",
  isquiotibiales: "bg-yellow-400",
  gluteos: "bg-pink-400",
  gemelos: "bg-teal-400",
  trapecio: "bg-cyan-400",
  antebrazo: "bg-lime-400",
  aductores: "bg-fuchsia-400",
  cardio: "bg-red-400",
  cuerpo_completo: "bg-sky-400",
}

const PERIODS = [7, 14, 30]

export default function MuscleVolumeChart({ data, totalSets, totalVolume, period, onPeriodChange }: MuscleVolumeChartProps) {
  const maxSets = Math.max(1, ...data.map(d => d.sets))

  if (!data.length) {
    return (
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
        <BarChart3 className="h-8 w-8 mx-auto mb-2 text-foreground/20" />
        <p className="text-sm text-foreground/30">Sin datos de volumen</p>
        <p className="text-xs text-foreground/20 mt-1">Completa workouts para ver distribución muscular</p>
      </div>
    )
  }

  return (
    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4 text-emerald-400" />
            Volumen muscular
          </h3>
          <p className="text-xs text-foreground/40 mt-0.5">
            {totalSets} series · {Math.round(totalVolume).toLocaleString()} kg
          </p>
        </div>

        {/* Period selector */}
        {onPeriodChange && (
          <div className="flex gap-1">
            {PERIODS.map(p => (
              <button
                key={p}
                onClick={() => onPeriodChange(p)}
                className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                  period === p
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "text-foreground/30 hover:text-foreground/50"
                }`}
              >
                {p}d
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bars */}
      <div className="space-y-2">
        {data.map(d => {
          const barColor = MUSCLE_BAR_COLORS[d.muscle] || "bg-gray-400"
          const width = (d.sets / maxSets) * 100

          return (
            <div key={d.muscle} className="space-y-0.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-foreground/70 font-medium">{d.label}</span>
                <span className="text-foreground/40">{d.sets} series · {d.percentage}%</span>
              </div>
              <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full ${barColor} rounded-full transition-all duration-500`}
                  style={{ width: `${Math.max(2, width)}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
