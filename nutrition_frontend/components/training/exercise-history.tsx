"use client"

import { Dumbbell, Calendar, Crown, TrendingUp, Target } from "lucide-react"
import type { ExerciseStats } from "@/lib/workout-types"

interface ExerciseHistoryProps {
  stats: ExerciseStats
  exerciseName: string
}

export default function ExerciseHistory({ stats, exerciseName }: ExerciseHistoryProps) {
  const maxVolume = stats.history.length > 0
    ? Math.max(...stats.history.map(h => h.total_volume))
    : 0
  const max1rm = stats.history.length > 0
    ? Math.max(...stats.history.filter(h => h.estimated_1rm).map(h => h.estimated_1rm!))
    : 0

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Dumbbell className="h-5 w-5 text-emerald-400" />
        <h3 className="text-base font-bold text-foreground">{exerciseName}</h3>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
          <Target className="h-3.5 w-3.5 mx-auto text-purple-400 mb-1" />
          <p className="text-lg font-bold text-foreground">{stats.total_times_performed}</p>
          <p className="text-[10px] text-foreground/30">Veces</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
          <Crown className="h-3.5 w-3.5 mx-auto text-amber-400 mb-1" />
          <p className="text-lg font-bold text-foreground">{stats.estimated_1rm ?? "—"}</p>
          <p className="text-[10px] text-foreground/30">1RM (kg)</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
          <Calendar className="h-3.5 w-3.5 mx-auto text-blue-400 mb-1" />
          <p className="text-xs font-bold text-foreground mt-1">{stats.last_performed ?? "—"}</p>
          <p className="text-[10px] text-foreground/30">Último</p>
        </div>
      </div>

      {/* Volume progression */}
      {stats.history.length > 1 && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-3">
          <h4 className="text-xs font-medium text-foreground/40 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3" /> Volumen por sesión
          </h4>
          <div className="flex items-end gap-1 h-20">
            {stats.history.slice(-15).map((h, i) => {
              const height = maxVolume > 0 ? (h.total_volume / maxVolume) * 100 : 0
              return (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center"
                  title={`${h.date}: ${Math.round(h.total_volume)}kg`}
                >
                  <div
                    className="w-full bg-blue-500/50 rounded-t hover:bg-blue-400/70 transition-colors min-h-[2px]"
                    style={{ height: `${Math.max(2, height)}%` }}
                  />
                </div>
              )
            })}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-foreground/20">{stats.history[Math.max(0, stats.history.length - 15)]?.date}</span>
            <span className="text-[9px] text-foreground/20">{stats.history[stats.history.length - 1]?.date}</span>
          </div>
        </div>
      )}

      {/* Top sets per session */}
      {stats.history.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-3">
          <h4 className="text-xs font-medium text-foreground/40 uppercase tracking-wider mb-2">Top set por sesión</h4>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {stats.history.slice(-10).reverse().map((h, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-white/5 last:border-0">
                <span className="text-foreground/40">{h.date}</span>
                <span className="text-foreground font-medium">{h.top_set_weight}kg × {h.top_set_reps}</span>
                {h.estimated_1rm && <span className="text-amber-400/60 text-[10px]">~{h.estimated_1rm}kg 1RM</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Set records */}
      {Object.keys(stats.set_records).length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-3">
          <h4 className="text-xs font-medium text-foreground/40 uppercase tracking-wider mb-2">Records por repeticiones</h4>
          <div className="grid grid-cols-5 gap-1">
            {Array.from({ length: 10 }, (_, i) => i + 1).map(reps => {
              const record = stats.set_records[reps]
              return (
                <div key={reps} className={`text-center p-1.5 rounded-lg ${record ? "bg-emerald-500/10" : "bg-white/5"}`}>
                  <p className="text-[10px] text-foreground/30">{reps}r</p>
                  <p className={`text-xs font-bold ${record ? "text-foreground" : "text-foreground/15"}`}>
                    {record ? `${record.weight_kg}` : "—"}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!stats.history.length && (
        <div className="text-center py-8 text-foreground/20">
          <p className="text-sm">Sin historial aún</p>
        </div>
      )}
    </div>
  )
}
