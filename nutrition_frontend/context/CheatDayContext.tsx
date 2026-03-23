"use client"

import {
  createContext, useContext, useState, useEffect,
  useCallback, type ReactNode,
} from "react"
import { saveCheatDay, getCheatDays, type CheatDayRecordAPI } from "@/lib/api"

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
  date:         string
  weekStart:    string
  active:       boolean
  excess:       number
  compensating: boolean
  compensation: CompensationEntry[]
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

function toAPIRecord(rec: CheatDayRecord): CheatDayRecordAPI {
  return {
    id:           rec.date,
    date:         rec.date,
    weekStart:    rec.weekStart,
    active:       rec.active,
    excess:       rec.excess,
    compensating: rec.compensating,
    compensation: rec.compensation.map(c => ({
      date:         c.date,
      extra_deficit: c.reduction,
    })),
  }
}

function fromAPIRecord(r: CheatDayRecordAPI): CheatDayRecord {
  return {
    date:         r.date,
    weekStart:    r.weekStart,
    active:       r.active,
    excess:       r.excess,
    compensating: r.compensating,
    compensation: r.compensation.map(c => ({
      date:      c.date,
      reduction: c.extra_deficit,
    })),
  }
}

function loadFromLocalStorage(): CheatDayRecord | null {
  if (typeof window === "undefined") return null
  const today     = new Date().toISOString().slice(0, 10)
  const weekStart = getMonday(today)
  try {
    const raw = localStorage.getItem(lsKey(weekStart))
    return raw ? (JSON.parse(raw) as CheatDayRecord) : null
  } catch { return null }
}

export function CheatDayProvider({ children }: { children: ReactNode }) {
  const [record, setRecord] = useState<CheatDayRecord | null>(loadFromLocalStorage)

  // Sync with backend on mount
  useEffect(() => {
    getCheatDays()
      .then((backendRecords) => {
        if (backendRecords.length > 0) {
          // Backend wins — find record for current week
          const today     = new Date().toISOString().slice(0, 10)
          const weekStart = getMonday(today)
          const thisWeek  = backendRecords.find(r => r.weekStart === weekStart)
          if (thisWeek) {
            const rec = fromAPIRecord(thisWeek)
            setRecord(rec)
            try { localStorage.setItem(lsKey(rec.weekStart), JSON.stringify(rec)) } catch {}
          }
        } else {
          // Backend empty — migrate localStorage data if present
          const lsRecord = loadFromLocalStorage()
          if (lsRecord) {
            saveCheatDay(toAPIRecord(lsRecord)).catch(console.error)
          }
        }
      })
      .catch(console.error)
  }, [])

  const persist = useCallback((rec: CheatDayRecord) => {
    setRecord(rec)
    try { localStorage.setItem(lsKey(rec.weekStart), JSON.stringify(rec)) } catch {}
    saveCheatDay(toAPIRecord(rec)).catch(console.error)
  }, [])

  const isWeeklyLimitReached = useCallback((date: string) => {
    if (typeof window === "undefined") return false
    try { return !!localStorage.getItem(lsKey(getMonday(date))) } catch { return false }
  }, [])

  const isCheatDay = useCallback(
    (date: string) => record?.date === date && record.active,
    [record],
  )

  const activateCheatDay = useCallback((date: string) => {
    persist({ date, weekStart: getMonday(date), active: true, excess: 0, compensating: false, compensation: [] })
  }, [persist])

  const finalizeExcess = useCallback((excess: number) => {
    if (!record) return
    persist({ ...record, excess })
  }, [record, persist])

  const setupCompensation = useCallback((fromDate: string) => {
    if (!record) return
    const perDay = Math.round(record.excess / 3)
    const entries: CompensationEntry[] = []
    const d = new Date(fromDate + "T00:00:00")
    for (let i = 0; i < 3; i++) {
      d.setDate(d.getDate() + 1)
      entries.push({ date: d.toISOString().slice(0, 10), reduction: perDay })
    }
    persist({ ...record, compensating: true, compensation: entries })
  }, [record, persist])

  const declineCompensation = useCallback(() => {
    if (!record) return
    persist({ ...record, compensating: false, compensation: [] })
  }, [record, persist])

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
