"use client"

import { ChevronLeft, ChevronRight, Flame, Dumbbell } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { TrainingCalendarDay } from "@/lib/workout-types"

interface TrainingCalendarProps {
  data: TrainingCalendarDay[]
  year: number
  month: number
  onMonthChange: (year: number, month: number) => void
  onDayClick?: (date: string) => void
}

const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

const SOURCE_COLORS: Record<string, string> = {
  manual: "bg-emerald-400",
  apple_health: "bg-red-400",
  sheets: "bg-blue-400",
}

export default function TrainingCalendar({ data, year, month, onMonthChange, onDayClick }: TrainingCalendarProps) {
  const today = new Date().toISOString().slice(0, 10)

  const handlePrev = () => {
    if (month === 1) onMonthChange(year - 1, 12)
    else onMonthChange(year, month - 1)
  }

  const handleNext = () => {
    if (month === 12) onMonthChange(year + 1, 1)
    else onMonthChange(year, month + 1)
  }

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1)
  let startDow = firstDay.getDay() // 0=Sun
  startDow = startDow === 0 ? 6 : startDow - 1 // Convert to Mon=0

  const dataMap: Record<string, TrainingCalendarDay> = {}
  data.forEach(d => { dataMap[d.date] = d })

  const totalDays = new Date(year, month, 0).getDate()

  // Count trained days and streak
  const trainedDays = data.filter(d => d.trained).length
  let streak = 0
  for (let i = data.length - 1; i >= 0; i--) {
    const d = data[i]
    if (d.date > today) continue
    if (d.trained) streak++
    else break
  }

  // Cells: pad start
  const cells: (TrainingCalendarDay | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let day = 1; day <= totalDays; day++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    cells.push(dataMap[dateStr] || { date: dateStr, trained: false, workout_names: [], total_volume_kg: 0, muscles_hit: [], source: [] })
  }

  return (
    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={handlePrev} className="p-1.5 rounded-lg hover:bg-white/5 text-foreground/50 hover:text-foreground">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h3 className="text-sm font-bold text-foreground">
          {MONTH_NAMES[month - 1]} {year}
        </h3>
        <button onClick={handleNext} className="p-1.5 rounded-lg hover:bg-white/5 text-foreground/50 hover:text-foreground">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {DAY_NAMES.map(d => (
          <span key={d} className="text-[10px] font-medium text-foreground/30">{d}</span>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (!cell) return <div key={`empty-${i}`} />

          const dayNum = parseInt(cell.date.slice(-2))
          const isToday = cell.date === today
          const isTrained = cell.trained

          return (
            <button
              key={cell.date}
              onClick={() => onDayClick?.(cell.date)}
              className={`relative h-10 rounded-xl flex flex-col items-center justify-center transition-colors ${
                isToday
                  ? "ring-1 ring-emerald-500/50 bg-emerald-500/10"
                  : isTrained
                  ? "bg-emerald-500/10 hover:bg-emerald-500/20"
                  : "hover:bg-white/5"
              }`}
            >
              <span className={`text-xs font-medium ${
                isToday ? "text-emerald-400" : isTrained ? "text-foreground/80" : "text-foreground/30"
              }`}>
                {dayNum}
              </span>
              {isTrained && (
                <div className="flex gap-0.5 mt-0.5">
                  {cell.source.map(s => (
                    <div key={s} className={`h-1 w-1 rounded-full ${SOURCE_COLORS[s] || "bg-white/40"}`} />
                  ))}
                  {cell.source.length === 0 && <div className="h-1 w-1 rounded-full bg-emerald-400" />}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Footer stats */}
      <div className="flex items-center justify-between pt-1 border-t border-white/5">
        <div className="flex items-center gap-1.5 text-xs text-foreground/40">
          <Dumbbell className="h-3 w-3" />
          <span>{trainedDays} día{trainedDays !== 1 ? "s" : ""} entrenados</span>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-1 text-xs text-amber-400">
            <Flame className="h-3 w-3" />
            <span>{streak} día{streak !== 1 ? "s" : ""} racha</span>
          </div>
        )}
      </div>

      {/* Source legend */}
      <div className="flex gap-3 text-[10px] text-foreground/30">
        <span className="flex items-center gap-1"><div className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Manual</span>
        <span className="flex items-center gap-1"><div className="h-1.5 w-1.5 rounded-full bg-red-400" /> Apple Health</span>
        <span className="flex items-center gap-1"><div className="h-1.5 w-1.5 rounded-full bg-blue-400" /> Sheets</span>
      </div>
    </div>
  )
}
