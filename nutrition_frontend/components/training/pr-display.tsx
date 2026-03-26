"use client"

import { Trophy, Crown, Dumbbell, TrendingUp, Repeat } from "lucide-react"
import type { PRRecord, ExerciseStats } from "@/lib/workout-types"

const PR_TYPE_CONFIG: Record<string, { icon: typeof Trophy; label: string; unit: string; color: string }> = {
  "1rm": { icon: Crown, label: "1RM Estimado", unit: "kg", color: "text-amber-400 bg-amber-400/10 border-amber-400/20" },
  weight: { icon: Dumbbell, label: "Peso máximo", unit: "kg", color: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
  volume: { icon: TrendingUp, label: "Volumen", unit: "kg", color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
  reps: { icon: Repeat, label: "Máx reps", unit: "", color: "text-purple-400 bg-purple-400/10 border-purple-400/20" },
}

// ── Recent PRs Feed ─────────────────────────────────────────────────────────

export function RecentPRs({ prs }: { prs: PRRecord[] }) {
  if (!prs.length) {
    return (
      <div className="text-center py-8 text-foreground/30">
        <Trophy className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Aún no hay records personales</p>
        <p className="text-xs mt-1">Completa workouts para registrar PRs</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {prs.map((pr, i) => {
        const config = PR_TYPE_CONFIG[pr.pr_type] || PR_TYPE_CONFIG.weight
        const Icon = config.icon
        return (
          <div
            key={`${pr.exercise_id}-${pr.pr_type}-${i}`}
            className={`flex items-center gap-3 p-3 rounded-2xl border ${config.color} transition-all`}
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-white/5 shrink-0">
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{pr.exercise_name}</p>
              <p className="text-xs text-foreground/50">{config.label} — {pr.date}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-lg font-bold text-foreground">{pr.value}{config.unit && <span className="text-xs ml-0.5 text-foreground/50">{config.unit}</span>}</p>
              {pr.weight_kg && pr.reps ? (
                <p className="text-[10px] text-foreground/30">{pr.weight_kg}kg × {pr.reps}</p>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Exercise PR Detail ──────────────────────────────────────────────────────

export function ExercisePRDetail({ stats }: { stats: ExerciseStats }) {
  const maxHistory1rm = stats.history.length > 0
    ? Math.max(...stats.history.filter(h => h.estimated_1rm).map(h => h.estimated_1rm!))
    : 0

  return (
    <div className="space-y-4">
      {/* Big stats */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "1RM Estimado", value: stats.estimated_1rm, unit: "kg", icon: Crown, color: "text-amber-400" },
          { label: "Peso máximo", value: stats.best_weight, unit: "kg", icon: Dumbbell, color: "text-blue-400" },
          { label: "Vol. máx serie", value: stats.best_volume_set, unit: "kg", icon: TrendingUp, color: "text-emerald-400" },
          { label: "Veces realizado", value: stats.total_times_performed, unit: "", icon: Repeat, color: "text-purple-400" },
        ].map(stat => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className={`h-3.5 w-3.5 ${stat.color}`} />
                <span className="text-[10px] text-foreground/40 uppercase tracking-wider">{stat.label}</span>
              </div>
              <p className="text-xl font-bold text-foreground">
                {stat.value != null ? stat.value : "—"}
                {stat.unit && stat.value != null && <span className="text-xs ml-0.5 text-foreground/40">{stat.unit}</span>}
              </p>
            </div>
          )
        })}
      </div>

      {/* 1RM Progression chart */}
      {stats.history.length > 1 && (
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-3">
          <h4 className="text-xs font-medium text-foreground/40 uppercase tracking-wider mb-3">Progresión 1RM</h4>
          <div className="flex items-end gap-1 h-24">
            {stats.history.slice(-20).map((h, i) => {
              const height = maxHistory1rm > 0 && h.estimated_1rm
                ? (h.estimated_1rm / maxHistory1rm) * 100
                : 0
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5" title={`${h.date}: ${h.estimated_1rm}kg`}>
                  <div
                    className="w-full bg-emerald-500/60 rounded-t transition-all hover:bg-emerald-400/80 min-h-[2px]"
                    style={{ height: `${Math.max(2, height)}%` }}
                  />
                </div>
              )
            })}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-foreground/20">{stats.history[Math.max(0, stats.history.length - 20)]?.date}</span>
            <span className="text-[9px] text-foreground/20">{stats.history[stats.history.length - 1]?.date}</span>
          </div>
        </div>
      )}

      {/* Set Records table */}
      {Object.keys(stats.set_records).length > 0 && (
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-3">
          <h4 className="text-xs font-medium text-foreground/40 uppercase tracking-wider mb-2">Records por reps</h4>
          <div className="grid grid-cols-5 gap-1">
            {Array.from({ length: 10 }, (_, i) => i + 1).map(reps => {
              const record = stats.set_records[reps]
              return (
                <div key={reps} className="text-center p-1.5 rounded-lg bg-white/5">
                  <p className="text-[10px] text-foreground/30">{reps} rep{reps > 1 ? "s" : ""}</p>
                  <p className="text-xs font-bold text-foreground">
                    {record ? `${record.weight_kg}` : "—"}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {stats.last_performed && (
        <p className="text-xs text-foreground/30 text-center">Último: {stats.last_performed}</p>
      )}
    </div>
  )
}
