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

function roundKcal(value: number): number {
  return Math.round(value)
}

function getBaseMealKcal(meal: Meal): number {
  return meal.adjustedKcal ?? meal.targetKcal ?? meal.kcal
}

function getMinimumMealKcal(meal: Meal): number {
  if (meal.fixedKcal != null) return meal.fixedKcal
  return getBaseMealKcal(meal)
}

function getDefaultCarbTargetKcal(meal: Meal): number {
  return meal.targetKcal ?? getBaseMealKcal(meal)
}

function getMealOverrideTarget(meal: Meal, override: MealOverride | undefined): number | null {
  if (!override?.selectedCarb || meal.fixedKcal == null) return null

  const grams =
    override.customGrams ??
    (meal.targetKcal != null
      ? Math.round(Math.max(meal.targetKcal - meal.fixedKcal, 0) / (override.selectedCarb.kcal / 100))
      : null)

  if (grams == null) return null

  return meal.fixedKcal + roundKcal((override.selectedCarb.kcal / 100) * grams)
}

function distributeRemainingKcal(
  meals: Meal[],
  lockedTargets: Record<string, number>,
  dailyTarget: number,
): Record<string, number> {
  const targets: Record<string, number> = { ...lockedTargets }
  const unlocked = meals.filter((meal) => lockedTargets[meal.id] == null)
  if (unlocked.length === 0) return targets

  let remainingKcal = dailyTarget - Object.values(lockedTargets).reduce((sum, value) => sum + value, 0)
  const minima = new Map(unlocked.map((meal) => [meal.id, getMinimumMealKcal(meal)]))
  const bases = new Map(unlocked.map((meal) => [meal.id, getBaseMealKcal(meal)]))
  const active = [...unlocked]

  while (active.length > 0) {
    const totalWeight = active.reduce((sum, meal) => sum + (bases.get(meal.id) ?? 0), 0) || active.length
    const forced: Meal[] = []

    for (const meal of active) {
      const weight = bases.get(meal.id) ?? 0
      const proposed = totalWeight > 0 ? (remainingKcal * weight) / totalWeight : remainingKcal / active.length
      const minimum = minima.get(meal.id) ?? 0

      if (proposed < minimum) {
        targets[meal.id] = minimum
        remainingKcal -= minimum
        forced.push(meal)
      }
    }

    if (forced.length === 0) break
    for (const meal of forced) {
      const idx = active.findIndex((candidate) => candidate.id === meal.id)
      if (idx >= 0) active.splice(idx, 1)
    }
  }

  const finalWeight = active.reduce((sum, meal) => sum + (bases.get(meal.id) ?? 0), 0) || active.length
  let assigned = 0
  active.forEach((meal, index) => {
    const weight = bases.get(meal.id) ?? 0
    const raw = finalWeight > 0 ? (remainingKcal * weight) / finalWeight : remainingKcal / active.length
    const value = index === active.length - 1 ? remainingKcal - assigned : roundKcal(raw)
    const minimum = minima.get(meal.id) ?? 0
    targets[meal.id] = Math.max(value, minimum)
    assigned += targets[meal.id]
  })

  return targets
}

function computeDerived(state: DietDayState): DietDayDerived {
  const lockedTargets: Record<string, number> = {}

  for (const meal of state.meals) {
    const overrideTarget = getMealOverrideTarget(meal, state.overrides[meal.id])
    if (overrideTarget != null) {
      lockedTargets[meal.id] = overrideTarget
    }
  }

  const rebalancedTargets = distributeRemainingKcal(state.meals, lockedTargets, state.dailyTarget)
  const effectiveKcalPerMeal: Record<string, number> = {}
  for (const meal of state.meals) {
    effectiveKcalPerMeal[meal.id] = rebalancedTargets[meal.id] ?? getBaseMealKcal(meal)
  }

  const totalEffective = Object.values(effectiveKcalPerMeal).reduce((s, v) => s + v, 0)
  const remaining = state.dailyTarget - totalEffective
  const exceeded = totalEffective > state.dailyTarget
  const overLimit = totalEffective > state.dailyTarget * 1.1

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
