"use client"

import {
  createContext, useContext, useState, useCallback,
  useMemo, type ReactNode,
} from "react"
import type { Meal, FavoriteCarb } from "@/lib/api"

// ── Storage helpers ────────────────────────────────────────────────────────

const STORAGE_KEY = (date: string) => `nutritrack_dietday_${date}`

interface StoredDayLog {
  date: string
  dailyTarget: number
  overrides: Record<string, MealOverride>
  nonCompliant?: boolean
  excessKcal?: number
}

export function loadDayFromStorage(date: string): StoredDayLog | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY(date))
    return raw ? (JSON.parse(raw) as StoredDayLog) : null
  } catch {
    return null
  }
}

function saveDayToStorage(log: StoredDayLog) {
  try {
    localStorage.setItem(STORAGE_KEY(log.date), JSON.stringify(log))
  } catch {}
}

// ── Types ──────────────────────────────────────────────────────────────────

interface MealOverride {
  selectedCarb: FavoriteCarb | null
  customGrams: number | null
}

interface DietDayState {
  initialized: boolean
  date: string
  dailyTarget: number
  meals: Meal[]
  favoriteCarbs: FavoriteCarb[]
  overrides: Record<string, MealOverride>
}

interface DietDayDerived {
  totalEffective: number
  remaining: number
  exceeded: boolean
  overLimit: boolean
  rebalancedTargets: Record<string, number>
  effectiveKcalPerMeal: Record<string, number>
}

interface DietDayContextValue {
  state: DietDayState
  derived: DietDayDerived
  init: (date: string, dailyTarget: number, meals: Meal[], favoriteCarbs: FavoriteCarb[]) => void
  setMealCarb: (mealId: string, carb: FavoriteCarb | null) => void
  setMealGrams: (mealId: string, grams: number | null) => void
}

// ── Context ────────────────────────────────────────────────────────────────

const Ctx = createContext<DietDayContextValue | null>(null)

const EMPTY_STATE: DietDayState = {
  initialized: false,
  date: "",
  dailyTarget: 0,
  meals: [],
  favoriteCarbs: [],
  overrides: {},
}

function computeDerived(state: DietDayState): DietDayDerived {
  const effectiveKcalPerMeal: Record<string, number> = {}

  for (const meal of state.meals) {
    const override = state.overrides[meal.id]
    if (override?.selectedCarb && meal.fixedKcal != null) {
      const carb = override.selectedCarb
      const grams =
        override.customGrams ??
        (meal.targetKcal != null
          ? Math.round(Math.max(meal.targetKcal - meal.fixedKcal, 0) / (carb.kcal / 100))
          : null)
      if (grams != null) {
        effectiveKcalPerMeal[meal.id] = meal.fixedKcal + Math.round((carb.kcal / 100) * grams)
      } else {
        effectiveKcalPerMeal[meal.id] = meal.adjustedKcal ?? meal.kcal
      }
    } else {
      effectiveKcalPerMeal[meal.id] = meal.adjustedKcal ?? meal.kcal
    }
  }

  const totalEffective = Object.values(effectiveKcalPerMeal).reduce((s, v) => s + v, 0)
  const remaining = state.dailyTarget - totalEffective
  const exceeded = totalEffective > state.dailyTarget
  const overLimit = totalEffective > state.dailyTarget * 1.1

  // Simple rebalanced targets: each meal gets its proportional share
  const rebalancedTargets: Record<string, number> = {}
  const mealCount = state.meals.length || 1
  for (const meal of state.meals) {
    rebalancedTargets[meal.id] = Math.round(state.dailyTarget / mealCount)
  }

  return { totalEffective, remaining, exceeded, overLimit, rebalancedTargets, effectiveKcalPerMeal }
}

export function DietDayProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DietDayState>(EMPTY_STATE)

  const init = useCallback(
    (date: string, dailyTarget: number, meals: Meal[], favoriteCarbs: FavoriteCarb[]) => {
      const stored = loadDayFromStorage(date)
      const overrides = stored?.overrides ?? {}
      setState({ initialized: true, date, dailyTarget, meals, favoriteCarbs, overrides })
    },
    [],
  )

  const setMealCarb = useCallback((mealId: string, carb: FavoriteCarb | null) => {
    setState((prev) => {
      const overrides = {
        ...prev.overrides,
        [mealId]: { ...prev.overrides[mealId], selectedCarb: carb, customGrams: null },
      }
      const next = { ...prev, overrides }
      saveDayToStorage({ date: next.date, dailyTarget: next.dailyTarget, overrides })
      return next
    })
  }, [])

  const setMealGrams = useCallback((mealId: string, grams: number | null) => {
    setState((prev) => {
      const overrides = {
        ...prev.overrides,
        [mealId]: { ...prev.overrides[mealId], customGrams: grams },
      }
      const next = { ...prev, overrides }
      saveDayToStorage({ date: next.date, dailyTarget: next.dailyTarget, overrides })
      return next
    })
  }, [])

  const derived = useMemo(() => computeDerived(state), [state])

  return (
    <Ctx.Provider value={{ state, derived, init, setMealCarb, setMealGrams }}>
      {children}
    </Ctx.Provider>
  )
}

export function useDietDay() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useDietDay must be used within DietDayProvider")
  return ctx
}
