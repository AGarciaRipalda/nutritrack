"use client"

import { Trophy } from "lucide-react"
import type { GamificationStatus } from "@/lib/api"

interface LevelBadgeProps {
  status: GamificationStatus
  collapsed?: boolean
}

export function LevelBadge({ status, collapsed = false }: LevelBadgeProps) {
  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="relative w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
          <span className="text-xs font-black text-indigo-400">{status.level}</span>
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-500/20" />
            <circle
              cx="20" cy="20" r="17" fill="none" stroke="currentColor" strokeWidth="2"
              className="text-indigo-400"
              strokeDasharray={`${(status.progress_pct / 100) * 106.8} 106.8`}
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <div className="relative w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
        <Trophy className="h-5 w-5 text-indigo-400" />
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-500/20" />
          <circle
            cx="24" cy="24" r="21" fill="none" stroke="currentColor" strokeWidth="2"
            className="text-indigo-400"
            strokeDasharray={`${(status.progress_pct / 100) * 131.9} 131.9`}
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-white truncate">
          Nv. {status.level} — {status.name}
        </p>
        <p className="text-[10px] text-white/50 font-medium">
          {status.xp_in_level} / {status.xp_next_level} XP
        </p>
      </div>
    </div>
  )
}
