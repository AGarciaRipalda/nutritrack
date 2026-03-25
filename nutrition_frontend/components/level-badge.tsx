"use client"

import type { GamificationStatus } from "@/lib/api"

const LEVEL_COLORS: Record<number, { ring: string; text: string; bg: string; bar: string }> = {
  1: { ring: "border-zinc-400/40",   text: "text-zinc-300",   bg: "bg-zinc-500/20",   bar: "from-zinc-400 to-zinc-500" },
  2: { ring: "border-emerald-400/40",text: "text-emerald-300",bg: "bg-emerald-500/20", bar: "from-emerald-400 to-emerald-500" },
  3: { ring: "border-blue-400/40",   text: "text-blue-300",   bg: "bg-blue-500/20",   bar: "from-blue-400 to-blue-500" },
  4: { ring: "border-violet-400/40", text: "text-violet-300", bg: "bg-violet-500/20",  bar: "from-violet-400 to-violet-500" },
  5: { ring: "border-amber-400/40",  text: "text-amber-300",  bg: "bg-amber-500/20",  bar: "from-amber-400 to-amber-500" },
  6: { ring: "border-red-400/40",    text: "text-red-300",    bg: "bg-red-500/20",    bar: "from-red-400 to-orange-400" },
}

interface LevelBadgeProps {
  status: GamificationStatus
  collapsed?: boolean
}

export function LevelBadge({ status, collapsed = false }: LevelBadgeProps) {
  const colors = LEVEL_COLORS[status.level] ?? LEVEL_COLORS[1]

  if (collapsed) {
    return (
      <div
        title={`Nv. ${status.level} ${status.name} · ${status.xp} XP`}
        className={`w-9 h-9 rounded-full border-2 ${colors.ring} ${colors.bg} flex items-center justify-center shrink-0`}
      >
        <span className={`text-xs font-bold ${colors.text}`}>{status.level}</span>
      </div>
    )
  }

  return (
    <div className={`rounded-2xl border ${colors.ring} ${colors.bg} p-3`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full border-2 ${colors.ring} flex items-center justify-center shrink-0`}>
            <span className={`text-xs font-bold ${colors.text}`}>{status.level}</span>
          </div>
          <div>
            <p className={`text-sm font-semibold ${colors.text} leading-none`}>{status.name}</p>
            <p className="text-white/40 text-[10px] leading-none mt-0.5">{status.xp} XP total</p>
          </div>
        </div>
        {!status.is_max_level && (
          <p className="text-white/30 text-[10px] text-right leading-none">
            {status.xp_to_next} XP<br />
            <span className="text-white/20">para {status.next_level_name}</span>
          </p>
        )}
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${colors.bar} rounded-full transition-all duration-500`}
          style={{ width: `${status.progress_pct}%` }}
        />
      </div>
    </div>
  )
}
