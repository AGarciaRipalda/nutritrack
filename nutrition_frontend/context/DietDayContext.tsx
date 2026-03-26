"use client"

import {
  createContext, useContext, useState, useCallback,
  useMemo, type ReactNode,
} from "react"
import type { Meal, FavoriteCarb, TodayTrainingData, TrainingBlock } from "@/lib/api"

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
  todayTraining: TodayTrainingData | null
}

interface TrainingAutoAllocation {
  bonusKcal: number
  trainingType: string | null
  trainingBlock: TrainingBlock
  preMealId: string | null
  postMealId: string | null
  preExtraKcal: number
  postExtraKcal: number
}

interface DietDayDerived {
  totalEffective: number
  remaining: number
  exceeded: boolean
  overLimit: boolean
  rebalancedTargets: Record<string, number>
  effectiveKcalPerMeal: Record<string, number>
  trainingAutoAllocation: TrainingAutoAllocation | null
}

interface DietDayContextValue {
  state: DietDayState
  derived: DietDayDerived
  init: (date: string, dailyTarget: number, meals: Meal[], favoriteCarbs: FavoriteCarb[], todayTraining?: TodayTrainingData | null) => void
  setMealCarb: (mealId: string, carb: FavoriteCarb | null) => void
  setMealGrams: (mealId: string, grams: number | null) => void
  setTodayTraining: (todayTraining: TodayTrainingData | null) => void
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
  todayTraining: null,
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

function getTrainingMealAllocation(block: TrainingBlock): { preMealId: string | null; postMealId: string | null } {
  switch (block) {
    case "morning":
      return { preMealId: "desayuno", postMealId: "media_manana" }
    case "midday":
      return { preMealId: "almuerzo", postMealId: "merienda" }
    case "afternoon":
      return { preMealId: "merienda", postMealId: "cena" }
    case "evening":
      return { preMealId: "cena", postMealId: null }
    default:
      return { preMealId: null, postMealId: null }
  }
}

function buildAutoTrainingTargets(
  meals: Meal[],
  todayTraining: TodayTrainingData | null,
): { lockedTargets: Record<string, number>; allocation: TrainingAutoAllocation | null } {
  if (!todayTraining?.training_block || todayTraining.bonus_kcal <= 0) {
    return { lockedTargets: {}, allocation: null }
  }

  const byId = new Map(meals.map((meal) => [meal.id, meal]))
  const { preMealId, postMealId } = getTrainingMealAllocation(todayTraining.training_block)
  const preMeal = preMealId ? byId.get(preMealId) : null
  const postMeal = postMealId ? byId.get(postMealId) : null
  const preShare = todayTraining.training_block === "evening"
    ? 1
    : todayTraining.training_type === "cardio"
      ? 0.55
      : 0.65

  let preExtraKcal = todayTraining.bonus_kcal
  let postExtraKcal = 0

  if (preMeal && postMeal) {
    preExtraKcal = roundKcal(todayTraining.bonus_kcal * preShare)
    postExtraKcal = todayTraining.bonus_kcal - preExtraKcal
  }

  const lockedTargets: Record<string, number> = {}
  if (preMeal) lockedTargets[preMeal.id] = getBaseMealKcal(preMeal) + preExtraKcal
  if (postMeal && postExtraKcal > 0) lockedTargets[postMeal.id] = getBaseMealKcal(postMeal) + postExtraKcal

  return {
    lockedTargets,
    allocation: {
      bonusKcal: todayTraining.bonus_kcal,
      trainingType: todayTraining.training_type ?? null,
      trainingBlock: todayTraining.training_block,
      preMealId: preMeal?.id ?? null,
      postMealId: postMeal?.id ?? null,
      preExtraKcal: preMeal ? preExtraKcal : 0,
      postExtraKcal: postMeal ? postExtraKcal : 0,
    },
  }
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
  const { lockedTargets, allocation } = buildAutoTrainingTargets(state.meals, state.todayTraining)

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

  return {
    totalEffective,
    remaining,
    exceeded,
    overLimit,
    rebalancedTargets,
    effectiveKcalPerMeal,
    trainingAutoAllocation: allocation,
  }
}

export function DietDayProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DietDayState>(EMPTY_STATE)

  const init = useCallback(
    (date: string, dailyTarget: number, meals: Meal[], favoriteCarbs: FavoriteCarb[], todayTraining: TodayTrainingData | null = null) => {
      const stored = loadDayFromStorage(date)
      const overrides = stored?.overrides ?? {}
      setState({ initialized: true, date, dailyTarget, meals, favoriteCarbs, overrides, todayTraining })
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

  const setTodayTraining = useCallback((todayTraining: TodayTrainingData | null) => {
    setState((prev) => ({ ...prev, todayTraining }))
  }, [])

  const derived = useMemo(() => computeDerived(state), [state])

  return (
    <Ctx.Provider value={{ state, derived, init, setMealCarb, setMealGrams, setTodayTraining }}>
      {children}
    </Ctx.Provider>
  )
}

export function useDietDay() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useDietDay must be used within DietDayProvider")
  return ctx
}
