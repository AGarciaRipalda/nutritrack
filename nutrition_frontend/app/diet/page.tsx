"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import Link from "next/link"
import { AppLayout } from "@/components/app-layout"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Shuffle, Coffee, Sun, Utensils, Cookie, Moon,
  Lightbulb, CheckCircle2, Wheat, Scale, Star, X, Ban, Plus, Search, Zap,
} from "lucide-react"
import type { PlanDay, FoodSearchResult } from "@/lib/api"
import { fetchTodaysPlan, swapMeal, updateAdherence, fetchFavoriteCarbs, fetchTodayTraining, searchFood } from "@/lib/api"
import { useDietDay } from "@/context/DietDayContext"
import { useCheatDay } from "@/context/CheatDayContext"

const today = typeof window !== "undefined" ? new Date().toISOString().slice(0, 10) : ""
const mockPlanDay: PlanDay = {
  date: today,
  dayName: typeof window !== "undefined" ? new Date().toLocaleDateString("es-ES", { weekday: "long" }) : "",
  meals: [
    { id: "desayuno",     type: "breakfast",   name: "Desayuno",     kcal: 380, description: "Yogur griego con frutos rojos, miel y copos de avena",                       note: "Añade semillas de chía para más fibra y omega-3" },
    { id: "media_manana", type: "mid-morning",  name: "Media mañana", kcal: 220, description: "Manzana en rodajas con 2 cucharadas de crema de almendras",                  note: "Elige manzanas de temporada" },
    { id: "almuerzo",     type: "lunch",        name: "Almuerzo",     kcal: 520, description: "Pechuga de pollo a la plancha con ensalada mixta, aguacate y tomate cherry",  note: "Aliña con aceite de oliva virgen extra" },
    { id: "merienda",     type: "snack",        name: "Merienda",     kcal: 280, description: "Batido de proteínas con plátano, espinacas y leche de almendras",             note: "Añade hielo para una textura más espesa" },
    { id: "cena",         type: "dinner",       name: "Cena",         kcal: 650, description: "Filete de salmón al horno con quinoa y verduras asadas",                     note: "Sazona el salmón con limón y eneldo" },
  ],
  totalKcal: 2050,
}

const mealIcons: Record<string, typeof Coffee> = {
  breakfast: Coffee, "mid-morning": Sun, lunch: Utensils, snack: Cookie, dinner: Moon,
}
const mealLabels: Record<string, string> = {
  breakfast: "Desayuno", "mid-morning": "Media mañana", lunch: "Almuerzo", snack: "Merienda", dinner: "Cena",
}
const mealIdLabels: Record<string, string> = {
  desayuno: "Desayuno", media_manana: "Media mañana", almuerzo: "Almuerzo", merienda: "Merienda", cena: "Cena",
}
const mealIdIcons: Record<string, typeof Coffee> = {
  desayuno: Coffee, media_manana: Sun, almuerzo: Utensils, merienda: Cookie, cena: Moon,
}

const trainingBlockLabels = {
  morning: "por la mañana",
  midday: "a mediodía",
  afternoon: "por la tarde",
  evening: "por la noche",
} as const

function deriveMealCarbKcalPer100g(meal: PlanDay["meals"][0]): number | null {
  if (meal.fixedKcal == null || meal.carbG == null || meal.carbG <= 0) return null
  const target = meal.targetKcal ?? meal.adjustedKcal ?? meal.kcal
  const carbKcal = target - meal.fixedKcal
  if (carbKcal <= 0) return null
  return (carbKcal / meal.carbG) * 100
}

function computeDisplayedCarbGrams(
  meal: PlanDay["meals"][0],
  effectiveKcal: number,
  selectedCarbKcalPer100g: number | null,
): number | null {
  if (meal.fixedKcal == null) return null
  const kcalPer100g = selectedCarbKcalPer100g ?? deriveMealCarbKcalPer100g(meal)
  if (!kcalPer100g || kcalPer100g <= 0) return null
  return Math.max(Math.round(((effectiveKcal - meal.fixedKcal) / kcalPer100g) * 100), 0)
}

function renderAdjustedDescription(
  meal: PlanDay["meals"][0],
  effectiveKcal: number,
  selectedCarbName: string | null,
  selectedCarbKcalPer100g: number | null,
): string {
  const adjustedCarbG = computeDisplayedCarbGrams(meal, effectiveKcal, selectedCarbKcalPer100g)
  if (adjustedCarbG == null || meal.carbG == null || meal.carbG <= 0) return meal.description

  let description = meal.description
  const gramsPattern = new RegExp(`\\b${meal.carbG}g\\b`)
  description = description.replace(gramsPattern, `${adjustedCarbG}g`)

  if (selectedCarbName) {
    const afterOriginalCarb = new RegExp(`\\b${adjustedCarbG}g de [^,;+()]+`, "i")
    if (afterOriginalCarb.test(description)) {
      description = description.replace(afterOriginalCarb, `${adjustedCarbG}g de ${selectedCarbName}`)
    }
  }

  return description
}

export default function DietPage() {
  const { state, derived, init, setMealCarb, setMealGrams } = useDietDay()
  const { isCheatDay, finalizeExcess, setupCompensation, declineCompensation, record: cheatRecord } = useCheatDay()

  const [planDay, setPlanDay]         = useState<(PlanDay & { stale?: boolean }) | null>(null)
  const [stale, setStale]             = useState(false)
  const [loading, setLoading]         = useState(true)
  const [swapping, setSwapping]       = useState<string | null>(null)
  const [checkedMeals, setCheckedMeals] = useState<Record<string, boolean>>({})
  const [skippedMeals, setSkippedMeals] = useState<Record<string, { foods: { name: string; kcal: number }[] }>>({})
  const [foodInput, setFoodInput] = useState<Record<string, { name: string; grams: string; kcalPer100g: number | null }>>({})
  const [showCompModal, setShowCompModal] = useState(false)
  const [foodSuggestions, setFoodSuggestions] = useState<Record<string, FoodSearchResult[]>>({})
  const [searchingFood, setSearchingFood] = useState<Record<string, boolean>>({})
  const [activeFoodMealId, setActiveFoodMealId] = useState<string | null>(null)
  const searchTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const activeFoodContainerRef = useRef<HTMLDivElement | null>(null)

  const closeFoodDropdown = useCallback(() => {
    setFoodSuggestions({})
    setSearchingFood({})
    setActiveFoodMealId(null)
  }, [])

  const debouncedFoodSearch = useCallback((mealId: string, query: string) => {
    setActiveFoodMealId(mealId)
    if (searchTimers.current[mealId]) clearTimeout(searchTimers.current[mealId])
    if (query.length < 2) {
      setFoodSuggestions((prev) => ({ ...prev, [mealId]: [] }))
      setSearchingFood((prev) => ({ ...prev, [mealId]: false }))
      return
    }
    searchTimers.current[mealId] = setTimeout(async () => {
      setSearchingFood((prev) => ({ ...prev, [mealId]: true }))
      try {
        const results = await searchFood(query)
        setFoodSuggestions((prev) => ({ ...prev, [mealId]: results }))
      } catch {
        setFoodSuggestions((prev) => ({ ...prev, [mealId]: [] }))
      }
      setSearchingFood((prev) => ({ ...prev, [mealId]: false }))
    }, 400)
  }, [])

  useEffect(() => {
    return () => {
      Object.values(searchTimers.current).forEach(clearTimeout)
    }
  }, [])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!activeFoodContainerRef.current) return
      const target = event.target
      if (target instanceof Node && !activeFoodContainerRef.current.contains(target)) {
        closeFoodDropdown()
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("touchstart", handlePointerDown)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("touchstart", handlePointerDown)
    }
  }, [closeFoodDropdown])

  useEffect(() => {
    Promise.all([fetchTodaysPlan(), fetchFavoriteCarbs(), fetchTodayTraining()])
      .then(([d, carbs, todayTraining]) => {
        setStale(d.stale ?? false)
        setPlanDay(d)
        const target = d.exerciseAdj?.adjustedTotal ?? d.totalKcal
        init(d.date, target, d.meals, carbs, todayTraining)
        if (d.adherence) {
          if (Object.keys(d.adherence.meals).length > 0) {
            setCheckedMeals(d.adherence.meals)
          }
          if (Object.keys(d.adherence.skippedMeals).length > 0) {
            setSkippedMeals(d.adherence.skippedMeals)
          }
        }
      })
      .catch(() => {
        setPlanDay(mockPlanDay)
        init(mockPlanDay.date, mockPlanDay.totalKcal, mockPlanDay.meals, [], null)
      })
      .finally(() => setLoading(false))
  // `init` comes from DietDayContext and is stable (wrapped in useCallback there),
  // so this effect intentionally runs only once on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [init])

  const handleSwap = async (mealId: string) => {
    if (!planDay) return
    setSwapping(mealId)
    try {
      const updated = await swapMeal(mealId)
      setPlanDay((prev) => prev ? { ...updated, stale: prev.stale } : updated)
      const carbs = state.favoriteCarbs
      const target = updated.exerciseAdj?.adjustedTotal ?? updated.totalKcal
      init(updated.date, target, updated.meals, carbs, state.todayTraining)
    } catch {}
    setSwapping(null)
  }

  const adherenceItems = (planDay?.meals ?? []).map((m) => ({
    id: m.id,
    label: mealLabels[m.type] ?? mealIdLabels[m.id],
    checked: checkedMeals[m.id] ?? false,
  }))

  const syncAdherence = async (
    newChecked: Record<string, boolean>,
    newSkipped: Record<string, { foods: { name: string; kcal: number }[] }>,
  ) => {
    const kcalMap: Record<string, number> = {}
    ;(planDay?.meals ?? []).forEach((m) => { kcalMap[m.id] = m.kcal })
    try { await updateAdherence(newChecked, kcalMap, newSkipped) } catch (err) { console.error("Failed to update adherence:", err) }
  }

  const handleAdherenceChange = async (itemId: string, checked: boolean) => {
    const newChecked = { ...checkedMeals, [itemId]: checked }
    setCheckedMeals(newChecked)
    await syncAdherence(newChecked, skippedMeals)
  }

  const handleSkipMeal = async (mealId: string) => {
    if (skippedMeals[mealId]) {
      const { [mealId]: _, ...rest } = skippedMeals
      setSkippedMeals(rest)
      await syncAdherence(checkedMeals, rest)
    } else {
      const newChecked = { ...checkedMeals, [mealId]: false }
      setCheckedMeals(newChecked)
      const newSkipped = { ...skippedMeals, [mealId]: { foods: [] } }
      setSkippedMeals(newSkipped)
      await syncAdherence(newChecked, newSkipped)
    }
  }

  const handleAddFood = async (mealId: string) => {
    const input = foodInput[mealId]
    if (!input?.name?.trim() || !input?.grams?.trim()) return
    const grams = parseInt(input.grams)
    if (isNaN(grams) || grams <= 0) return
    const kcalPer100g = input.kcalPer100g ?? 100
    const kcal = Math.round((kcalPer100g * grams) / 100)
    const newSkipped = {
      ...skippedMeals,
      [mealId]: { foods: [...(skippedMeals[mealId]?.foods ?? []), { name: input.name.trim(), kcal }] },
    }
    setSkippedMeals(newSkipped)
    setFoodInput((prev) => ({ ...prev, [mealId]: { name: "", grams: "", kcalPer100g: null } }))
    await syncAdherence(checkedMeals, newSkipped)
  }

  const handleRemoveFood = async (mealId: string, index: number) => {
    const foods = [...(skippedMeals[mealId]?.foods ?? [])]
    foods.splice(index, 1)
    const newSkipped = { ...skippedMeals, [mealId]: { foods } }
    setSkippedMeals(newSkipped)
    await syncAdherence(checkedMeals, newSkipped)
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-screen -mt-20">
          <div className="text-emerald-600/60 font-medium">Cargando dieta...</div>
        </div>
      </AppLayout>
    )
  }

  const day = planDay ?? mockPlanDay
  const cheatActive = isCheatDay(day.date)
  const {
    totalEffective, remaining, exceeded, overLimit,
    rebalancedTargets, effectiveKcalPerMeal, trainingAutoAllocation,
  } = derived
  const dailyTarget   = state.dailyTarget || day.totalKcal

  const replacementKcal = Object.values(skippedMeals)
    .flatMap((s) => s.foods)
    .reduce((sum, f) => sum + f.kcal, 0)
  const consumedKcal    = day.meals
    .filter((m) => checkedMeals[m.id] && !skippedMeals[m.id])
    .reduce((sum, m) => sum + (effectiveKcalPerMeal[m.id] ?? m.kcal), 0)
    + replacementKcal
  const consumedPct     = dailyTarget > 0 ? Math.min((consumedKcal / dailyTarget) * 100, 100) : 0
  const consumedExceeded  = consumedKcal > dailyTarget
  const consumedOverLimit = consumedKcal > dailyTarget * 1.1
  const consumedRemaining = dailyTarget - consumedKcal

  const showOverLimit = consumedOverLimit && !cheatActive
  const excessKcal = Math.max(consumedKcal - dailyTarget, 0)

  return (
    <AppLayout>
      <div className="space-y-6 pb-8">

        {/* Stale banner */}
        {stale && (
          <div className="flex items-center justify-between rounded-3xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <span className="text-sm font-medium text-amber-800">Plan desactualizado</span>
            <Link href="/weekly-plan" className="text-sm font-bold text-amber-600 hover:underline">Regenerar →</Link>
          </div>
        )}

        <Card className="rounded-3xl border-emerald-100 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/10 md:p-7">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white md:text-4xl">Dieta de hoy</h2>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-300">
                {day.dayName} · {new Date(day.date + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
              </p>
            </div>
            {day.exerciseAdj && day.exerciseAdj.extraKcal > 0 && (
              <Badge className="border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-600">
                ⚡ +{day.exerciseAdj.extraKcal} kcal
              </Badge>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-500 dark:text-slate-300">Presupuesto calórico</span>
              <span className={`font-bold ${showOverLimit ? "text-rose-600" : "text-emerald-600"}`}>
                {consumedKcal} / {dailyTarget} kcal
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  showOverLimit ? "bg-rose-500" : consumedExceeded ? "bg-amber-500" : "bg-emerald-500"
                }`}
                style={{ width: `${consumedPct}%` }}
              />
            </div>
            <div className="flex justify-between text-xs font-medium">
              <span className="text-slate-400 dark:text-slate-400">
                {consumedRemaining >= 0 ? `Quedan ${consumedRemaining} kcal` : `Exceso +${excessKcal} kcal`}
              </span>
              {cheatActive && <span className="flex items-center gap-1 text-amber-600"><Star className="h-3 w-3 fill-amber-500" /> Comodín</span>}
            </div>
          </div>
        </Card>

        {trainingAutoAllocation && (
          <Card className="rounded-3xl border-emerald-100 bg-emerald-50 p-5 shadow-sm dark:border-emerald-400/20 dark:bg-emerald-500/10">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-emerald-500/15 p-2.5">
                <Zap className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-semibold text-emerald-800 dark:text-emerald-200">
                  Ajuste automático por entreno {trainingBlockLabels[trainingAutoAllocation.trainingBlock]}
                </p>
                <p className="text-sm leading-6 text-emerald-700 dark:text-emerald-300/90">
                  +{trainingAutoAllocation.bonusKcal} kcal repartidas en
                  {trainingAutoAllocation.preMealId ? ` ${mealIdLabels[trainingAutoAllocation.preMealId]}` : ""}
                  {trainingAutoAllocation.preMealId ? ` (+${trainingAutoAllocation.preExtraKcal})` : ""}
                  {trainingAutoAllocation.postMealId
                    ? ` y ${mealIdLabels[trainingAutoAllocation.postMealId]} (+${trainingAutoAllocation.postExtraKcal})`
                    : ""}
                  .
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Compensation/Cheat Banners - Compact */}
        {cheatActive && excessKcal > 0 && !cheatRecord?.compensating && (
          <button
            onClick={() => { finalizeExcess(excessKcal); setShowCompModal(true) }}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm animate-pulse"
          >
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
              <span className="text-sm font-bold text-amber-800">¿Compensar exceso de hoy?</span>
            </div>
            <span className="text-xs font-black uppercase text-amber-600">Click aquí</span>
          </button>
        )}

        <div className="grid grid-cols-1 gap-4">
          {day.meals.map((meal) => {
            const MealIcon    = mealIdIcons[meal.id] ?? mealIcons[meal.type] ?? Utensils
            const label       = mealLabels[meal.type] ?? mealIdLabels[meal.id]
            const override    = state.overrides[meal.id]
            const selCarb     = override?.selectedCarb ?? null
            const customG     = override?.customGrams ?? null
            const effKcal     = state.initialized ? effectiveKcalPerMeal[meal.id] ?? (meal.adjustedKcal ?? meal.kcal) : (meal.adjustedKcal ?? meal.kcal)
            const baseKcal    = meal.adjustedKcal ?? meal.targetKcal ?? meal.kcal
            const kcalDelta   = effKcal - baseKcal
            const hasKcalDelta = Math.abs(kcalDelta) >= 5
            const displayedDescription = renderAdjustedDescription(meal, effKcal, selCarb?.name ?? null, selCarb?.kcal ?? null)
            const trainingRole =
              trainingAutoAllocation?.preMealId === meal.id
                ? "pre"
                : trainingAutoAllocation?.postMealId === meal.id
                  ? "post"
                  : null
            const trainingRoleKcal =
              trainingRole === "pre"
                ? trainingAutoAllocation?.preExtraKcal ?? 0
                : trainingRole === "post"
                  ? trainingAutoAllocation?.postExtraKcal ?? 0
                  : 0
            const isSkipped   = !!skippedMeals[meal.id]
            const isChecked   = checkedMeals[meal.id]
            const hasFoodDropdown =
              !!searchingFood[meal.id] ||
              (foodSuggestions[meal.id]?.length ?? 0) > 0 ||
              (!searchingFood[meal.id] && (foodInput[meal.id]?.name?.trim().length ?? 0) >= 2)

            const mealTargetForCarbs = rebalancedTargets[meal.id] ?? meal.targetKcal ?? meal.adjustedKcal ?? meal.kcal
            const suggestedGrams = selCarb && meal.fixedKcal != null
              ? Math.round(Math.max(mealTargetForCarbs - meal.fixedKcal, 0) / (selCarb.kcal / 100))
              : null

            return (
              <Card
                key={meal.id}
                className={`relative overflow-visible border transition-all duration-300 rounded-2xl ${
                  isSkipped ? "bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-white/10" : "bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10"
                } ${hasFoodDropdown ? "z-40" : "z-0"} shadow-sm md:rounded-3xl`}
              >
                {/* Visual context icon */}
                <MealIcon className={`absolute -bottom-3 -right-3 h-20 w-20 opacity-[0.05] ${isSkipped ? 'text-slate-400 dark:text-slate-400' : 'text-emerald-400 dark:text-emerald-400'}`} />

                <div className="relative z-10 p-5 md:p-6">
                  <div className="mb-4 flex items-start gap-3 border-b border-black/10 pb-3 dark:border-white/10">
                    <div className={`mt-0.5 rounded-xl p-2 ${isSkipped ? "bg-slate-200 dark:bg-white/10" : "bg-emerald-500/10"}`}>
                      <MealIcon className={`h-4 w-4 shrink-0 ${isSkipped ? 'text-slate-400 dark:text-slate-400' : 'text-emerald-400 dark:text-emerald-400'}`} />
                    </div>
                    <div className="flex-1">
                      <h3 className={`text-lg font-semibold ${isSkipped ? 'text-slate-500 dark:text-slate-300 line-through' : 'text-foreground dark:text-foreground'}`}>{label}</h3>
                      {!isSkipped && trainingRole && trainingRoleKcal > 0 && (
                        <p className="mt-1 text-xs font-bold text-sky-700 dark:text-sky-300">
                          {trainingRole === "pre" ? "Pre-entreno" : "Post-entreno"} +{trainingRoleKcal} kcal
                        </p>
                      )}
                      {!isSkipped && hasKcalDelta && (
                        <p className={`mt-1 text-xs font-bold ${
                          kcalDelta > 0
                            ? "text-emerald-600 dark:text-emerald-300"
                            : "text-amber-600 dark:text-amber-300"
                        }`}>
                          {kcalDelta > 0 ? `+${kcalDelta}` : kcalDelta} kcal reajustadas
                        </p>
                      )}
                    </div>
                    <Badge className={`${isSkipped ? "bg-slate-200 border-slate-300 text-slate-500 dark:text-slate-300" : "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-400/30"} shrink-0 px-2 py-0.5 text-sm`}>
                      {effKcal} kcal
                    </Badge>
                    <Checkbox
                      checked={isChecked && !isSkipped}
                      disabled={isSkipped}
                      onCheckedChange={(checked) => handleAdherenceChange(meal.id, checked as boolean)}
                      className={`h-5 w-5 rounded-lg border-2 ${isSkipped ? 'opacity-0' : 'border-slate-300'}`}
                    />
                  </div>

                  <p className={`mb-4 text-sm leading-6 ${isSkipped ? 'text-slate-400 dark:text-slate-400 italic' : 'text-slate-700 dark:text-foreground/80'}`}>
                    {displayedDescription}
                  </p>

                  {!isSkipped && hasKcalDelta && (
                    <div className={`mb-4 rounded-xl border px-3 py-2 text-xs font-medium ${
                      kcalDelta > 0
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300"
                        : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-300"
                    }`}>
                      {kcalDelta > 0
                        ? "Se han subido los carbohidratos de esta comida para compensar el entreno."
                        : "Esta comida ha bajado para compensar el ajuste de carbohidratos en otra franja del día."}
                    </div>
                  )}

                  {meal.note && !isSkipped && (
                    <div className="mb-4 mt-0.5 flex items-start gap-2">
                      <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-400" />
                      <span className="text-xs leading-5 text-amber-700 dark:text-amber-400/80">{meal.note}</span>
                    </div>
                  )}

                  {!isSkipped && (
                    <div className="space-y-4">
                      {state.favoriteCarbs.length > 0 && meal.fixedKcal != null && (
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="relative min-w-[170px] flex-1">
                            <Wheat className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 dark:text-slate-400" />
                            <select
                              value={selCarb?.key ?? ""}
                              onChange={(e) => {
                                const found = state.favoriteCarbs.find((c) => c.key === e.target.value) ?? null
                                setMealCarb(meal.id, found)
                              }}
                              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-7 pr-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-white/10 dark:bg-white/10 dark:text-foreground/80"
                            >
                              <option value="">Ajustar carbohidratos...</option>
                              {state.favoriteCarbs.map((c) => (
                                <option key={c.key} value={c.key}>{c.name} ({c.kcal}k/100g)</option>
                              ))}
                            </select>
                          </div>
                          {selCarb && (
                             <div className="flex items-center gap-2">
                               <input
                                 type="number"
                                 placeholder={suggestedGrams ? String(suggestedGrams) : "g"}
                                 value={customG ?? ""}
                                 onChange={(e) => {
                                   const val = parseInt(e.target.value)
                                   setMealGrams(meal.id, isNaN(val) ? null : val)
                                 }}
                                 className="w-16 rounded-xl border border-slate-200 bg-white py-2 text-center text-xs font-black text-emerald-600 focus:outline-none dark:border-white/10 dark:bg-white/10 dark:text-emerald-400"
                               />
                               <span className="text-[11px] font-bold uppercase text-slate-400 dark:text-slate-400">Grams</span>
                             </div>
                          )}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSwap(meal.id)}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-600 transition-colors hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-foreground/60 dark:hover:bg-white/10 dark:hover:text-foreground"
                        >
                          <Shuffle className={`h-3 w-3 ${swapping === meal.id ? 'animate-spin' : ''}`} /> Cambiar
                        </button>
                        <button
                          onClick={() => handleSkipMeal(meal.id)}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-500 transition-colors hover:border-rose-100 hover:bg-rose-50 hover:text-rose-600 dark:border-white/10 dark:bg-white/10 dark:text-foreground/60 dark:hover:border-rose-400/20 dark:hover:bg-rose-500/10"
                        >
                          <Ban className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Skipped Meal UI */}
                  {isSkipped && (
                    <div className="space-y-3">
                       <div className="flex gap-2">
                         <div
                           ref={activeFoodMealId === meal.id ? activeFoodContainerRef : undefined}
                           className="relative flex-1"
                         >
                           <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 dark:text-slate-400" />
                           <input
                             type="text"
                             placeholder="¿Qué has comido?"
                             value={foodInput[meal.id]?.name ?? ""}
                             onFocus={() => setActiveFoodMealId(meal.id)}
                             onChange={(e) => {
                               const val = e.target.value
                               setFoodInput(prev => ({ ...prev, [meal.id]: { name: val, grams: prev[meal.id]?.grams ?? "", kcalPer100g: prev[meal.id]?.kcalPer100g ?? null } }))
                               debouncedFoodSearch(meal.id, val)
                             }}
                             className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-7 pr-2 text-xs text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-foreground/80"
                           />
                           {searchingFood[meal.id] && (
                             <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950 px-3 py-2 text-[10px] font-medium text-slate-500 dark:text-foreground/60 shadow-2xl">
                               Buscando alimentos...
                             </div>
                           )}
                           {foodSuggestions[meal.id]?.length > 0 && (
                              <div className="absolute z-50 left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto overscroll-contain rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950 shadow-2xl ring-1 ring-slate-950/5 dark:ring-black">
                                {foodSuggestions[meal.id].map((item, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => {
                                      setFoodInput(prev => ({ ...prev, [meal.id]: { name: item.name, grams: prev[meal.id]?.grams ?? "", kcalPer100g: item.kcal_100g } }))
                                      setFoodSuggestions(prev => ({ ...prev, [meal.id]: [] }))
                                      setActiveFoodMealId(null)
                                    }}
                                    className="block w-full bg-white dark:bg-zinc-950 text-left px-3 py-2 text-[10px] hover:bg-slate-50 dark:hover:bg-zinc-900 border-b border-slate-100 dark:border-white/10 last:border-0"
                                  >
                                    <span className="font-bold text-slate-700 dark:text-foreground/90">{item.name}</span>
                                    <span className="ml-2 text-slate-400 dark:text-foreground/50">{item.kcal_100g}k/100g</span>
                                  </button>
                                ))}
                              </div>
                           )}
                           {!searchingFood[meal.id] && (foodInput[meal.id]?.name?.trim().length ?? 0) >= 2 && (foodSuggestions[meal.id]?.length ?? 0) === 0 && (
                             <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950 px-3 py-2 text-[10px] font-medium text-slate-500 dark:text-foreground/60 shadow-2xl">
                               Sin resultados en OpenFoodFacts. Puedes añadirlo manualmente.
                             </div>
                           )}
                         </div>
                         <input
                           type="number"
                           placeholder="g"
                           value={foodInput[meal.id]?.grams ?? ""}
                           onChange={(e) => setFoodInput(prev => ({ ...prev, [meal.id]: { name: prev[meal.id]?.name ?? "", grams: e.target.value, kcalPer100g: prev[meal.id]?.kcalPer100g ?? null } }))}
                           className="w-14 rounded-xl border border-slate-200 bg-white py-2 text-center text-xs dark:border-white/10 dark:bg-white/10 dark:text-foreground/80"
                         />
                         <button
                           onClick={() => {
                             closeFoodDropdown()
                             handleAddFood(meal.id)
                           }}
                           className="rounded-xl bg-emerald-500 px-3 text-white"
                         >
                           <Plus className="h-3 w-3" />
                         </button>
                       </div>

                       <div className="flex flex-wrap gap-2">
                         {(skippedMeals[meal.id]?.foods ?? []).map((food, i) => (
                           <div key={i} className="flex items-center gap-1.5 rounded-xl border border-emerald-100 bg-emerald-50 px-2.5 py-1.5">
                             <span className="text-xs font-bold text-emerald-800">{food.name} ({food.kcal}k)</span>
                             <button onClick={() => handleRemoveFood(meal.id, i)}><X className="h-2.5 w-2.5 text-emerald-400" /></button>
                           </div>
                         ))}
                       </div>

                       <button
                         onClick={() => handleSkipMeal(meal.id)}
                         className="w-full py-1 text-xs font-bold text-emerald-600 hover:underline"
                       >
                         Restaurar comida original
                       </button>
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Compensation Modal - Light Theme */}
      {showCompModal && cheatRecord && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-white/10 border border-emerald-100 dark:border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
                <h3 className="text-slate-800 dark:text-white font-bold text-lg">Compensar Exceso</h3>
              </div>
              <button onClick={() => setShowCompModal(false)} className="text-slate-400 dark:text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-slate-600 text-sm mb-4">
              Has consumido <span className="font-bold text-amber-600">{cheatRecord.excess} kcal</span> extra.
              Podemos repartirlas en los próximos 3 días (-{Math.round(cheatRecord.excess / 3)} kcal/día) para no afectar tu progreso semanal.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { declineCompensation(); setShowCompModal(false) }}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-slate-500 dark:text-slate-300 text-sm font-semibold"
              >
                No
              </button>
              <button
                onClick={() => { setupCompensation(day.date); setShowCompModal(false) }}
                className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-white text-sm font-bold shadow-md shadow-emerald-100"
              >
                Sí, compensar
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
