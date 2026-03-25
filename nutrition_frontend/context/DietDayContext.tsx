"use client"

import {
  createContext, useContext, useReducer, useEffect,
  useCallback, type ReactNode,
} from "react"
import type { Meal, FavoriteCarb } from "@/lib/api"

// ── Types ──────────────────────────────────────────────────────────────────

export interface MealOverride {
  selectedCarb: FavoriteCarb | null
  customGrams:  number | null
  effectiveKcal: number
}

interface DietDayState {
  date:         string
  dailyTarget:  number
  baseMeals:    Meal[]
  overrides:    Record<string, MealOverride>
  favoriteCarbs: FavoriteCarb[]
  initialized:  boolean
}

export interface DietDayDerived {
  effectiveKcalPerMeal: Record<string, number>
  totalEffective:       number
  remaining:            number
  exceeded:             boolean   // > dailyTarget
  overLimit:            boolean   // > dailyTarget × 1.1
  rebalancedTargets:    Record<string, number>
}

interface DietDayContextValue {
  state:       DietDayState
  derived:     DietDayDerived
  init:        (date: string, dailyTarget: number, meals: Meal[], carbs: FavoriteCarb[]) => void
  setMealCarb: (mealId: string, carb: FavoriteCarb | null) => void
  setMealGrams:(mealId: string, grams: number | null) => void
  resetMeal:   (mealId: string) => void
}

// ── Reducer ────────────────────────────────────────────────────────────────

type Action =
  | { type: "INIT"; date: string; dailyTarget: number; meals: Meal[]; carbs: FavoriteCarb[] }
  | { type: "SET_CARB";  mealId: string; carb: FavoriteCarb | null }
  | { type: "SET_GRAMS"; mealId: string; grams: number | null }
  | { type: "RESET_MEAL"; mealId: string }

const initial: DietDayState = {
  date: "", dailyTarget: 0, baseMeals: [], overrides: {}, favoriteCarbs: [], initialized: false,
}

function buildOverride(meal: Meal, carb: FavoriteCarb | null, grams: number | null): MealOverride {
  let effectiveKcal = meal.adjustedKcal ?? meal.kcal
  if (carb) {
    if (grams != null && meal.fixedKcal != null) {
      effectiveKcal = Math.round(meal.fixedKcal + grams * (carb.kcal / 100))
    } else if (meal.targetKcal != null) {
      effectiveKcal = meal.targetKcal
    }
  } else if (grams != null && meal.fixedKcal != null && meal.targetKcal != null) {
    // No carb selected but grams entered — approximate using original carb density
    const originalCarbKcal = meal.targetKcal - meal.fixedKcal
    const originalCarbG    = meal.carbG ?? 1
    const approxDensity    = originalCarbG > 0 ? originalCarbKcal / originalCarbG : 3.5
    effectiveKcal = Math.round(meal.fixedKcal + grams * approxDensity)
  }
  return { selectedCarb: carb, customGrams: grams, effectiveKcal }
}

function reducer(state: DietDayState, action: Action): DietDayState {
  switch (action.type) {
    case "INIT":
      if (state.initialized && state.date === action.date) return state
      return {
        ...initial,
        date: action.date, dailyTarget: action.dailyTarget,
        baseMeals: action.meals, favoriteCarbs: action.carbs, initialized: true,
      }

    case "SET_CARB": {
      const meal = state.baseMeals.find((m) => m.id === action.mealId)
      if (!meal) return state
      const existing = state.overrides[action.mealId]
      return {
        ...state,
        overrides: {
          ...state.overrides,
          [action.mealId]: buildOverride(meal, action.carb, existing?.customGrams ?? null),
        },
      }
    }

    case "SET_GRAMS": {
      const meal = state.baseMeals.find((m) => m.id === action.mealId)
      if (!meal) return state
      const existing = state.overrides[action.mealId]
      return {
        ...state,
        overrides: {
          ...state.overrides,
          [action.mealId]: buildOverride(meal, existing?.selectedCarb ?? null, action.grams),
        },
      }
    }

    case "RESET_MEAL": {
      const { [action.mealId]: _, ...rest } = state.overrides
      return { ...state, overrides: rest }
    }

    default:
      return state
  }
}

// ── Derived computation ────────────────────────────────────────────────────

const SNACK_IDS      = ["media_manana", "merienda"]
const MAIN_SPLIT: Record<string, number> = { desayuno: 0.28, almuerzo: 0.45, cena: 0.27 }

function computeDerived(state: DietDayState): DietDayDerived {
  const { baseMeals, overrides, dailyTarget } = state

  const effectiveKcalPerMeal: Record<string, number> = {}
  for (const m of baseMeals) {
    effectiveKcalPerMeal[m.id] = overrides[m.id]?.effectiveKcal ?? (m.adjustedKcal ?? m.kcal)
  }

  const totalEffective = Object.values(effectiveKcalPerMeal).reduce((a, b) => a + b, 0)
  const remaining  = dailyTarget - totalEffective
  const exceeded   = totalEffective > dailyTarget
  const overLimit  = totalEffective > dailyTarget * 1.1

  // Rebalance: redistribute remaining budget across unmodified non-snack meals
  const rebalancedTargets: Record<string, number> = {}
  const modifiedMain = baseMeals.filter((m) => !SNACK_IDS.includes(m.id) && overrides[m.id])

  if (modifiedMain.length > 0 && dailyTarget > 0) {
    const snackKcal = baseMeals
      .filter((m) => SNACK_IDS.includes(m.id))
      .reduce((s, m) => s + effectiveKcalPerMeal[m.id], 0)

    const modifiedKcal = modifiedMain.reduce((s, m) => s + effectiveKcalPerMeal[m.id], 0)
    const budget       = dailyTarget - snackKcal - modifiedKcal

    const free = baseMeals.filter((m) => !SNACK_IDS.includes(m.id) && !overrides[m.id])
    const totalSplit = free.reduce((s, m) => s + (MAIN_SPLIT[m.id] ?? 0.33), 0)

    for (const m of free) {
      const share = totalSplit > 0 ? (MAIN_SPLIT[m.id] ?? 0.33) / totalSplit : 1 / free.length
      rebalancedTargets[m.id] = Math.max(Math.round(budget * share), 0)
    }
  }

  return { effectiveKcalPerMeal, totalEffective, remaining, exceeded, overLimit, rebalancedTargets }
}

// ── LocalStorage helpers ───────────────────────────────────────────────────

const lsKey = (date: string) => `nutritrack_diet_${date}`

function saveDayToStorage(state: DietDayState, derived: DietDayDerived) {
  if (!state.date || !state.initialized || typeof window === "undefined") return
  try {
    localStorage.setItem(lsKey(state.date), JSON.stringify({
      date:         state.date,
      plannedKcal:  state.dailyTarget,
      actualKcal:   derived.totalEffective,
      exceeded:     derived.exceeded,
      excessKcal:   Math.max(derived.totalEffective - state.dailyTarget, 0),
      nonCompliant: derived.totalEffective > state.dailyTarget + 200,
      savedAt:      new Date().toISOString(),
    }))
  } catch {}
}

export function loadDayFromStorage(date: string): {
  plannedKcal: number; actualKcal: number; excessKcal: number; nonCompliant: boolean
} | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(lsKey(date))
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

// ── Context & Provider ─────────────────────────────────────────────────────

const DietDayContext = createContext<DietDayContextValue | null>(null)

export function DietDayProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial)
  const derived = computeDerived(state)

  useEffect(() => {
    if (state.initialized) saveDayToStorage(state, derived)
  }, [state]) // eslint-disable-line react-hooks/exhaustive-deps

  const init = useCallback(
    (date: string, dailyTarget: number, meals: Meal[], carbs: FavoriteCarb[]) =>
      dispatch({ type: "INIT", date, dailyTarget, meals, carbs }),
    [],
  )
  const setMealCarb  = useCallback((mealId: string, carb: FavoriteCarb | null) =>
    dispatch({ type: "SET_CARB", mealId, carb }), [])
  const setMealGrams = useCallback((mealId: string, grams: number | null) =>
    dispatch({ type: "SET_GRAMS", mealId, grams }), [])
  const resetMeal    = useCallback((mealId: string) =>
    dispatch({ type: "RESET_MEAL", mealId }), [])

  return (
    <DietDayContext.Provider value={{ state, derived, init, setMealCarb, setMealGrams, resetMeal }}>
      {children}
    </DietDayContext.Provider>
  )
}

export function useDietDay() {
  const ctx = useContext(DietDayContext)
  if (!ctx) throw new Error("useDietDay must be used within DietDayProvider")
  return ctx
}
