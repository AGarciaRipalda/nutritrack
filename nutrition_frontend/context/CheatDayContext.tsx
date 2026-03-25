"use client"

import {
  createContext, useContext, useState,
  useCallback, type ReactNode,
} from "react"

// ── Helpers ────────────────────────────────────────────────────────────────

function getMonday(dateStr: string): string {
  const d   = new Date(dateStr + "T00:00:00")
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return d.toISOString().slice(0, 10)
}

const lsKey = (weekStart: string) => `nutritrack_cheatday_${weekStart}`

// ── Types ──────────────────────────────────────────────────────────────────

export interface CompensationEntry { date: string; reduction: number }

export interface CheatDayRecord {
  date:         string               // "2026-03-20"
  weekStart:    string               // "2026-03-16"
  active:       boolean
  excess:       number               // kcal over target (filled after the day)
  compensating: boolean
  compensation: CompensationEntry[]  // next 3 days' reductions
}

interface CheatDayContextValue {
  record:                  CheatDayRecord | null
  isCheatDay:              (date: string) => boolean
  isWeeklyLimitReached:    (date: string) => boolean
  activateCheatDay:        (date: string) => void
  finalizeExcess:          (excess: number) => void
  setupCompensation:       (fromDate: string) => void
  declineCompensation:     () => void
  getCompensationReduction:(date: string) => number
}

// ── Provider ───────────────────────────────────────────────────────────────

const Ctx = createContext<CheatDayContextValue | null>(null)

function loadRecord(): CheatDayRecord | null {
  if (typeof window === "undefined") return null
  const today     = new Date().toISOString().slice(0, 10)
  const weekStart = getMonday(today)
  try {
    const raw = localStorage.getItem(lsKey(weekStart))
    return raw ? (JSON.parse(raw) as CheatDayRecord) : null
  } catch { return null }
}

export function CheatDayProvider({ children }: { children: ReactNode }) {
  const [record, setRecord] = useState<CheatDayRecord | null>(loadRecord)

  const persist = useCallback((rec: CheatDayRecord) => {
    setRecord(rec)
    try { localStorage.setItem(lsKey(rec.weekStart), JSON.stringify(rec)) } catch {}
  }, [])

  /** True if there is any cheat day record for this week (regardless of date). */
  const isWeeklyLimitReached = useCallback((date: string) => {
    if (typeof window === "undefined") return false
    try { return !!localStorage.getItem(lsKey(getMonday(date))) } catch { return false }
  }, [])

  const isCheatDay = useCallback(
    (date: string) => record?.date === date && record.active,
    [record],
  )

  /** Activate comodín for today. One per week — caller must check limit first. */
  const activateCheatDay = useCallback((date: string) => {
    persist({ date, weekStart: getMonday(date), active: true, excess: 0, compensating: false, compensation: [] })
  }, [persist])

  /** Called from diet page when we know the final excess. */
  const finalizeExcess = useCallback((excess: number) => {
    if (!record) return
    persist({ ...record, excess })
  }, [record, persist])

  /** Build compensation plan: distribute excess over next 3 days. */
  const setupCompensation = useCallback((fromDate: string) => {
    if (!record) return
    const perDay = Math.round(record.excess / 3)
    const entries: CompensationEntry[] = []
    const base = new Date(fromDate + "T00:00:00").getTime()
    for (let i = 1; i <= 3; i++) {
      const nextDate = new Date(base + i * 86400000)
      entries.push({ date: nextDate.toISOString().slice(0, 10), reduction: perDay })
    }
    persist({ ...record, compensating: true, compensation: entries })
  }, [record, persist])

  const declineCompensation = useCallback(() => {
    if (!record) return
    persist({ ...record, compensating: false, compensation: [] })
  }, [record, persist])

  /** Returns the kcal reduction for a given date (0 if not in plan). */
  const getCompensationReduction = useCallback((date: string) => {
    if (!record?.compensating) return 0
    return record.compensation.find((c) => c.date === date)?.reduction ?? 0
  }, [record])

  return (
    <Ctx.Provider value={{
      record, isCheatDay, isWeeklyLimitReached,
      activateCheatDay, finalizeExcess, setupCompensation,
      declineCompensation, getCompensationReduction,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export function useCheatDay() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useCheatDay must be used within CheatDayProvider")
  return ctx
}
