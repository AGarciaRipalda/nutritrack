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
  Lightbulb, CheckCircle2, Wheat, Scale, Star, X, Ban, Plus, Search,
} from "lucide-react"
import type { PlanDay, FoodSearchResult } from "@/lib/api"
import { fetchTodaysPlan, swapMeal, updateAdherence, fetchFavoriteCarbs } from "@/lib/api"
import { searchFoodAction } from "@/app/actions/food"
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
  const searchTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const debouncedFoodSearch = useCallback((mealId: string, query: string) => {
    if (searchTimers.current[mealId]) clearTimeout(searchTimers.current[mealId])
    if (query.length < 2) {
      setFoodSuggestions((prev) => ({ ...prev, [mealId]: [] }))
      setSearchingFood((prev) => ({ ...prev, [mealId]: false }))
      return
    }
    searchTimers.current[mealId] = setTimeout(async () => {
      setSearchingFood((prev) => ({ ...prev, [mealId]: true }))
      try {
        const results = await searchFoodAction(query)
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
    Promise.all([fetchTodaysPlan(), fetchFavoriteCarbs()])
      .then(([d, carbs]) => {
        setStale(d.stale ?? false)
        setPlanDay(d)
        const target = d.exerciseAdj?.adjustedTotal ?? d.totalKcal
        init(d.date, target, d.meals, carbs)
        if (d.adherence) {
          if (Object.keys(d.adherence.meals).length > 0) {
            setCheckedMeals(d.adherence.meals)
          }
          if (Object.keys(d.adherence.skippedMeals).length > 0) {
            setSkippedMeals(d.adherence.skippedMeals)
          }
        }
      })
      .catch(() => setPlanDay(mockPlanDay))
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
      init(updated.date, target, updated.meals, carbs)
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
  const { totalEffective, remaining, exceeded, overLimit, rebalancedTargets, effectiveKcalPerMeal } = derived
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
      <div className="space-y-3 pb-6">

        {/* Stale banner */}
        {stale && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center justify-between shadow-sm">
            <span className="text-amber-800 text-xs font-medium">Plan desactualizado</span>
            <Link href="/weekly-plan" className="text-amber-600 text-xs font-bold hover:underline">Regenerar →</Link>
          </div>
        )}

        {/* Header - Compact */}
        <Card className="bg-white dark:bg-white/10 border-emerald-100 dark:border-white/10 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Dieta de hoy</h2>
              <p className="text-slate-500 dark:text-slate-300 text-[10px] font-bold uppercase tracking-wider">
                {day.dayName} · {new Date(day.date + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
              </p>
            </div>
            {day.exerciseAdj && day.exerciseAdj.extraKcal > 0 && (
              <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[10px] font-bold">
                ⚡ +{day.exerciseAdj.extraKcal} kcal
              </Badge>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-300 font-medium">Presupuesto calórico</span>
              <span className={`font-bold ${showOverLimit ? "text-rose-600" : "text-emerald-600"}`}>
                {consumedKcal} / {dailyTarget} kcal
              </span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  showOverLimit ? "bg-rose-500" : consumedExceeded ? "bg-amber-500" : "bg-emerald-500"
                }`}
                style={{ width: `${consumedPct}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-medium">
              <span className="text-slate-400 dark:text-slate-400">
                {consumedRemaining >= 0 ? `Quedan ${consumedRemaining} kcal` : `Exceso +${excessKcal} kcal`}
              </span>
              {cheatActive && <span className="text-amber-600 flex items-center gap-1"><Star className="h-2.5 w-2.5 fill-amber-500" /> Comodín</span>}
            </div>
          </div>
        </Card>

        {/* Compensation/Cheat Banners - Compact */}
        {cheatActive && excessKcal > 0 && !cheatRecord?.compensating && (
          <button
            onClick={() => { finalizeExcess(excessKcal); setShowCompModal(true) }}
            className="w-full bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-center justify-between gap-2 shadow-sm animate-pulse"
          >
            <div className="flex items-center gap-2">
              <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
              <span className="text-amber-800 text-[11px] font-bold">¿Compensar exceso de hoy?</span>
            </div>
            <span className="text-amber-600 text-[10px] font-black uppercase">Click aquí</span>
          </button>
        )}

        {/* Meal Cards - Tighter spacing, color-coded, background icons */}
        <div className="grid grid-cols-1 gap-3">
          {day.meals.map((meal) => {
            const MealIcon    = mealIdIcons[meal.id] ?? mealIcons[meal.type] ?? Utensils
            const label       = mealLabels[meal.type] ?? mealIdLabels[meal.id]
            const override    = state.overrides[meal.id]
            const selCarb     = override?.selectedCarb ?? null
            const customG     = override?.customGrams ?? null
            const effKcal     = state.initialized ? effectiveKcalPerMeal[meal.id] ?? (meal.adjustedKcal ?? meal.kcal) : (meal.adjustedKcal ?? meal.kcal)
            const isSkipped   = !!skippedMeals[meal.id]
            const isChecked   = checkedMeals[meal.id]
            const hasFoodDropdown =
              !!searchingFood[meal.id] ||
              (foodSuggestions[meal.id]?.length ?? 0) > 0 ||
              (!searchingFood[meal.id] && (foodInput[meal.id]?.name?.trim().length ?? 0) >= 2)

            const suggestedGrams = selCarb && meal.fixedKcal != null && meal.targetKcal != null
              ? Math.round(Math.max(meal.targetKcal - meal.fixedKcal, 0) / (selCarb.kcal / 100))
              : null

            return (
              <Card
                key={meal.id}
                className={`relative overflow-visible border transition-all duration-300 rounded-2xl ${
                  isSkipped ? "bg-slate-50 dark:bg-white/5 border-slate-200 opacity-80" : "bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10"
                } ${hasFoodDropdown ? "z-40" : "z-0"} shadow-sm`}
              >
                {/* Visual context icon */}
                <MealIcon className={`absolute -right-2 -bottom-2 h-16 w-16 opacity-[0.05] ${isSkipped ? 'text-slate-400 dark:text-slate-400' : 'text-emerald-400 dark:text-emerald-400'}`} />

                <div className="p-4 relative z-10">
                  <div className="flex items-center gap-2 border-b border-black/10 dark:border-white/10 pb-2 mb-2">
                    <MealIcon className={`h-4 w-4 shrink-0 ${isSkipped ? 'text-slate-400 dark:text-slate-400' : 'text-emerald-400 dark:text-emerald-400'}`} />
                    <div className="flex-1">
                      <h3 className={`text-sm font-semibold ${isSkipped ? 'text-slate-500 dark:text-slate-300 line-through' : 'text-foreground dark:text-foreground'}`}>{label}</h3>
                    </div>
                    <Badge className={`${isSkipped ? "bg-slate-200 border-slate-300 text-slate-500 dark:text-slate-300" : "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-400/30"} text-xs px-1.5 py-0 shrink-0`}>
                      {effKcal} kcal
                    </Badge>
                    <Checkbox
                      checked={isChecked && !isSkipped}
                      disabled={isSkipped}
                      onCheckedChange={(checked) => handleAdherenceChange(meal.id, checked as boolean)}
                      className={`h-5 w-5 rounded-lg border-2 ${isSkipped ? 'opacity-0' : 'border-slate-300'}`}
                    />
                  </div>

                  <p className={`text-xs leading-snug mb-3 ${isSkipped ? 'text-slate-400 dark:text-slate-400 italic' : 'text-slate-700 dark:text-foreground/80'}`}>
                    {meal.description}
                  </p>

                  {meal.note && !isSkipped && (
                    <div className="flex items-start gap-1 mt-0.5 mb-3">
                      <Lightbulb className="h-3 w-3 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                      <span className="text-amber-700 dark:text-amber-400/80 text-xs leading-snug">{meal.note}</span>
                    </div>
                  )}

                  {/* Dynamic Controls - Compact */}
                  {!isSkipped && (
                    <div className="space-y-3">
                      {/* Carb selector */}
                      {state.favoriteCarbs.length > 0 && meal.fixedKcal != null && (
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="relative flex-1 min-w-[120px]">
                            <Wheat className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 dark:text-slate-400" />
                            <select
                              value={selCarb?.key ?? ""}
                              onChange={(e) => {
                                const found = state.favoriteCarbs.find((c) => c.key === e.target.value) ?? null
                                setMealCarb(meal.id, found)
                              }}
                              className="w-full bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg pl-7 pr-2 py-1.5 text-[11px] font-bold text-slate-700 dark:text-foreground/80 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            >
                              <option value="">Ajustar carbohidratos...</option>
                              {state.favoriteCarbs.map((c) => (
                                <option key={c.key} value={c.key}>{c.name} ({c.kcal}k/100g)</option>
                              ))}
                            </select>
                          </div>
                          {selCarb && (
                             <div className="flex items-center gap-1.5">
                               <input
                                 type="number"
                                 placeholder={suggestedGrams ? String(suggestedGrams) : "g"}
                                 value={customG ?? ""}
                                 onChange={(e) => {
                                   const val = parseInt(e.target.value)
                                   setMealGrams(meal.id, isNaN(val) ? null : val)
                                 }}
                                 className="w-14 bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg py-1.5 text-center text-[11px] font-black text-emerald-600 dark:text-emerald-400 focus:outline-none"
                               />
                               <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase">Grams</span>
                             </div>
                          )}
                        </div>
                      )}

                      {/* Bottom actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSwap(meal.id)}
                          className="flex-1 bg-white dark:bg-white/10 hover:bg-white dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 rounded-xl py-1.5 text-[10px] font-bold text-slate-600 dark:text-foreground/60 dark:hover:text-foreground transition-colors flex items-center justify-center gap-1"
                        >
                          <Shuffle className={`h-3 w-3 ${swapping === meal.id ? 'animate-spin' : ''}`} /> Cambiar
                        </button>
                        <button
                          onClick={() => handleSkipMeal(meal.id)}
                          className="px-3 bg-white dark:bg-white/10 hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-slate-200 dark:border-white/10 hover:border-rose-100 dark:hover:border-rose-400/20 rounded-xl py-1.5 text-[10px] font-bold text-slate-500 dark:text-foreground/60 hover:text-rose-600 transition-colors"
                        >
                          <Ban className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Skipped Meal UI */}
                  {isSkipped && (
                    <div className="space-y-2">
                       <div className="flex gap-1.5">
                         <div className="relative flex-1">
                           <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 dark:text-slate-400" />
                           <input
                             type="text"
                             placeholder="¿Qué has comido?"
                             value={foodInput[meal.id]?.name ?? ""}
                             onChange={(e) => {
                               const val = e.target.value
                               setFoodInput(prev => ({ ...prev, [meal.id]: { name: val, grams: prev[meal.id]?.grams ?? "", kcalPer100g: prev[meal.id]?.kcalPer100g ?? null } }))
                               debouncedFoodSearch(meal.id, val)
                             }}
                             className="w-full bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg pl-7 pr-2 py-1.5 text-[11px] text-slate-700 dark:text-foreground/80"
                           />
                           {searchingFood[meal.id] && (
                             <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950 px-3 py-2 text-[10px] font-medium text-slate-500 dark:text-foreground/60 shadow-2xl">
                               Buscando alimentos...
                             </div>
                           )}
                           {foodSuggestions[meal.id]?.length > 0 && (
                              <div className="absolute z-50 left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto overscroll-contain rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950 shadow-2xl">
                                {foodSuggestions[meal.id].map((item, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => {
                                      setFoodInput(prev => ({ ...prev, [meal.id]: { name: item.name, grams: prev[meal.id]?.grams ?? "", kcalPer100g: item.kcal_100g } }))
                                      setFoodSuggestions(prev => ({ ...prev, [meal.id]: [] }))
                                    }}
                                    className="block w-full bg-white dark:bg-zinc-950 text-left px-3 py-2 text-[10px] hover:bg-slate-50 dark:hover:bg-white/5 border-b border-slate-100 dark:border-white/10 last:border-0"
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
                           className="w-12 bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg py-1.5 text-center text-[11px] dark:text-foreground/80"
                         />
                         <button
                           onClick={() => handleAddFood(meal.id)}
                           className="bg-emerald-500 text-white rounded-lg px-2"
                         >
                           <Plus className="h-3 w-3" />
                         </button>
                       </div>

                       <div className="flex flex-wrap gap-1">
                         {(skippedMeals[meal.id]?.foods ?? []).map((food, i) => (
                           <div key={i} className="bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-1 flex items-center gap-1.5">
                             <span className="text-[10px] font-bold text-emerald-800">{food.name} ({food.kcal}k)</span>
                             <button onClick={() => handleRemoveFood(meal.id, i)}><X className="h-2.5 w-2.5 text-emerald-400" /></button>
                           </div>
                         ))}
                       </div>

                       <button
                         onClick={() => handleSkipMeal(meal.id)}
                         className="w-full py-1 text-[10px] font-bold text-emerald-600 hover:underline"
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
