"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { AppLayout } from "@/components/app-layout"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Shuffle, Coffee, Sun, Utensils, Cookie, Moon,
  Lightbulb, CheckCircle2, Wheat, Scale, Star, X, Ban, Plus,
} from "lucide-react"
import type { PlanDay, FoodSearchResult } from "@/lib/api"
import { fetchTodaysPlan, swapMeal, updateAdherence, fetchFavoriteCarbs, searchFood, fetchTodayBonusKcal } from "@/lib/api"
import { useDietDay } from "@/context/DietDayContext"
import { useCheatDay } from "@/context/CheatDayContext"

const today = new Date().toISOString().slice(0, 10)
const mockPlanDay: PlanDay = {
  date: today,
  dayName: new Date().toLocaleDateString("es-ES", { weekday: "long" }),
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
  const [bonusKcal, setBonusKcal]     = useState(0)
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
    Promise.all([fetchTodaysPlan(), fetchFavoriteCarbs(), fetchTodayBonusKcal().catch(() => 0)])
      .then(([d, carbs, bonus]) => {
        setBonusKcal(bonus)
        setStale(d.stale ?? false)
        setPlanDay(d)
        const target = d.exerciseAdj?.adjustedTotal ?? d.totalKcal
        init(d.date, target, d.meals, carbs)
        // Restore persisted adherence state (skipped meals + checked meals)
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
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSwap = async (mealId: string) => {
    if (!planDay) return
    setSwapping(mealId)
    try {
      const updated = await swapMeal(mealId)
      setPlanDay((prev) => prev ? { ...updated, stale: prev.stale } : updated)
      // Re-init context with new meals
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
    try { await updateAdherence(newChecked, kcalMap, newSkipped) } catch {}
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
    if (!input?.name?.trim() || !input?.grams) return
    const grams = parseInt(input.grams)
    if (isNaN(grams) || grams <= 0) return
    const kcalPer100g = input.kcalPer100g ?? 100  // fallback: 100 kcal/100g
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
        <div className="flex items-center justify-center h-full">
          <div className="text-white/60">Cargando...</div>
        </div>
      </AppLayout>
    )
  }

  const day = planDay ?? mockPlanDay
  const cheatActive = isCheatDay(day.date)
  const { totalEffective, remaining, exceeded, overLimit, rebalancedTargets, effectiveKcalPerMeal } = derived
  const dailyTarget   = state.dailyTarget || day.totalKcal

  // Kcal realmente consumidas = comidas marcadas (no saltadas) + alimentos de reemplazo
  const replacementKcal = Object.values(skippedMeals)
    .flatMap((s) => s.foods)
    .reduce((sum, f) => sum + f.kcal, 0)
  const consumedKcal    = day.meals
    .filter((m) => checkedMeals[m.id] && !skippedMeals[m.id])
    .reduce((sum, m) => sum + (effectiveKcalPerMeal[m.id] ?? m.kcal), 0)
    + replacementKcal
  const consumedPct     = dailyTarget > 0 ? Math.min((consumedKcal / dailyTarget) * 100, cheatActive ? 130 : 110) : 0
  const consumedExceeded  = consumedKcal > dailyTarget
  const consumedOverLimit = consumedKcal > dailyTarget * 1.1
  const consumedRemaining = dailyTarget - consumedKcal

  // When comodín is active, suppress the over-limit red warning
  const showOverLimit = consumedOverLimit && !cheatActive
  const excessKcal = Math.max(consumedKcal - dailyTarget, 0)

  return (
    <AppLayout>
      <div className="space-y-4">

        {/* Stale banner */}
        {stale && (
          <div className="bg-amber-500/20 border border-amber-400/30 rounded-2xl p-4 flex items-center justify-between">
            <span className="text-amber-300 text-sm">Tu plan es de la semana pasada. ¿Regenerar ahora?</span>
            <a href="/weekly-plan" className="text-amber-400 text-sm font-semibold hover:underline ml-4">Ver plan →</a>
          </div>
        )}

        {/* Header */}
        <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div>
              <h2 className="text-3xl font-bold text-white">Dieta de hoy</h2>
              <p className="text-white/60 text-sm">
                {day.dayName}, semana del{" "}
                {new Date(day.date + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
              </p>
              {day.exerciseAdj && day.exerciseAdj.extraKcal > 0 && (
                <p className="text-yellow-300 text-sm mt-1">
                  ⚡ +{day.exerciseAdj.extraKcal} kcal · porciones ampliadas
                  <span className="text-white/40 ml-1">({day.exerciseAdj.source})</span>
                </p>
              )}
              {bonusKcal > 0 && (
                <p className="text-emerald-300 text-sm mt-1">
                  +{bonusKcal} kcal por entrenamiento de hoy
                </p>
              )}
            </div>
            <a href="/weekly-plan" className="text-emerald-400 text-sm font-semibold hover:underline">
              Ver plan completo →
            </a>
          </div>

          {/* Daily budget bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">Consumido</span>
              <span className={`font-semibold ${
                showOverLimit ? "text-red-400"
                : cheatActive && consumedExceeded ? "text-amber-300"
                : consumedExceeded ? "text-amber-400"
                : "text-emerald-400"
              }`}>
                {consumedKcal} / {dailyTarget} kcal
              </span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  showOverLimit ? "bg-red-400"
                  : cheatActive && consumedExceeded ? "bg-amber-400"
                  : consumedExceeded ? "bg-amber-400"
                  : "bg-emerald-400"
                }`}
                style={{ width: `${consumedPct}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-white/40">
              <span>
                {consumedRemaining >= 0
                  ? `Restante: ${consumedRemaining} kcal`
                  : `Exceso: +${Math.abs(consumedRemaining)} kcal`}
              </span>
              {showOverLimit && (
                <span className="text-red-400 font-medium">⚠ Límite diario excedido</span>
              )}
              {cheatActive && consumedExceeded && (
                <span className="text-amber-300 font-medium">⭐ Comodín activo</span>
              )}
            </div>
          </div>
        </Card>

        {/* Cheat day active banner */}
        {cheatActive && (
          <div className="bg-amber-500/10 border border-amber-400/20 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-400 fill-amber-400 shrink-0" />
              <span className="text-amber-300 text-sm">
                {excessKcal > 0
                  ? `Comodín activo · ${excessKcal} kcal de exceso registradas`
                  : "Comodín activo · sin límite estricto hoy"}
              </span>
            </div>
            {excessKcal > 0 && !cheatRecord?.compensating && (
              <button
                onClick={() => { finalizeExcess(excessKcal); setShowCompModal(true) }}
                className="text-amber-400 text-xs font-semibold hover:underline shrink-0"
              >
                Compensar →
              </button>
            )}
            {cheatRecord?.compensating && (
              <span className="text-emerald-400 text-xs font-medium shrink-0">✓ Compensando</span>
            )}
          </div>
        )}

        {/* Compensation banner */}
        {Object.keys(rebalancedTargets).length > 0 && (
          <div className="bg-blue-500/10 border border-blue-400/20 rounded-2xl px-4 py-3 flex items-start gap-2">
            <Scale className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-300">
              <span className="font-medium">Compensación sugerida · </span>
              {Object.entries(rebalancedTargets).map(([id, kcal], i) => (
                <span key={id}>
                  {i > 0 && " · "}
                  <span className="text-white">{mealIdLabels[id]}</span>
                  {" → "}
                  <span className="font-semibold">{kcal} kcal</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Meal Cards */}
        <div className="grid grid-cols-1 gap-3">
          {day.meals.map((meal) => {
            const MealIcon  = mealIdIcons[meal.id] ?? mealIcons[meal.type] ?? Utensils
            const label     = mealLabels[meal.type] ?? mealIdLabels[meal.id]
            const override  = state.overrides[meal.id]
            const selCarb   = override?.selectedCarb ?? null
            const customG   = override?.customGrams ?? null
            const effKcal   = state.initialized
              ? effectiveKcalPerMeal[meal.id] ?? (meal.adjustedKcal ?? meal.kcal)
              : (meal.adjustedKcal ?? meal.kcal)

            // Suggested grams when carb is selected but no custom input yet
            const suggestedGrams = selCarb && meal.fixedKcal != null && meal.targetKcal != null
              ? Math.round(Math.max(meal.targetKcal - meal.fixedKcal, 0) / (selCarb.kcal / 100))
              : null

            const isMealOverLimit = state.initialized && showOverLimit

            // Rebalance hint for this meal
            const rebalHint = rebalancedTargets[meal.id]

            const isSkipped = !!skippedMeals[meal.id]

            return (
              <Card
                key={meal.id}
                className={`backdrop-blur-xl border rounded-2xl p-4 transition-all duration-300 ${
                  isSkipped
                    ? "bg-amber-500/5 border-amber-400/20"
                    : isMealOverLimit
                    ? "bg-red-500/10 border-red-400/30"
                    : "bg-white/10 border-white/20 hover:bg-white/15"
                }`}
              >
                {/* Header: icon + label + kcal */}
                <div className="flex items-center gap-2 border-b border-white/10 pb-3 mb-3">
                  <div className={`p-2 rounded-lg border shrink-0 ${isSkipped ? "bg-amber-500/10 border-amber-400/20" : "bg-emerald-500/20 border-emerald-400/30"}`}>
                    <MealIcon className={`h-4 w-4 ${isSkipped ? "text-amber-400/60" : "text-emerald-400"}`} />
                  </div>
                  <span className={`text-sm font-medium flex-1 ${isSkipped ? "text-white/40 line-through" : "text-white/60"}`}>{label}</span>
                  {isSkipped && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 leading-none mr-1">Saltada</span>
                  )}
                  <div className="flex flex-col items-end shrink-0 gap-0.5">
                    <Badge
                      className={`text-sm px-2 py-0.5 border ${
                        override
                          ? "bg-blue-500/20 text-blue-300 border-blue-400/30"
                          : "bg-emerald-500/20 text-emerald-400 border-emerald-400/30"
                      }`}
                    >
                      {effKcal} kcal
                    </Badge>
                    {meal.portionScale && meal.portionScale > 1 && (
                      <span className="text-yellow-300 text-xs">×{meal.portionScale.toFixed(2)}</span>
                    )}
                  </div>
                </div>

                {/* Dish description */}
                <p className="text-white text-sm leading-snug mb-3">{meal.description}</p>

                {/* Rebalance hint */}
                {rebalHint != null && (
                  <p className="text-blue-300/70 text-xs mb-2">
                    💡 Objetivo sugerido: {rebalHint} kcal
                  </p>
                )}

                {/* Carb selector + gram input */}
                {state.favoriteCarbs.length > 0 && meal.fixedKcal != null && (
                  <div className="space-y-2 mb-3">
                    <div className="flex items-center gap-2">
                      <Wheat className="h-3.5 w-3.5 text-white/40 shrink-0" />
                      <select
                        value={selCarb?.key ?? ""}
                        onChange={(e) => {
                          const found = state.favoriteCarbs.find((c) => c.key === e.target.value) ?? null
                          setMealCarb(meal.id, found)
                        }}
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg text-white/60 text-xs px-2 py-1.5 focus:outline-none focus:border-emerald-400/40"
                      >
                        <option value="">Carbohidrato original</option>
                        {state.favoriteCarbs.map((c) => (
                          <option key={c.key} value={c.key}>{c.name} · {c.kcal} kcal/100g</option>
                        ))}
                      </select>
                    </div>

                    {/* Gram input — only when carb is selected */}
                    {selCarb && (
                      <div className="flex items-center gap-2 pl-5">
                        <input
                          type="number"
                          min="0"
                          max="999"
                          placeholder={suggestedGrams != null ? String(suggestedGrams) : "g"}
                          value={customG ?? ""}
                          onChange={(e) => {
                            const val = parseInt(e.target.value)
                            setMealGrams(meal.id, isNaN(val) ? null : val)
                          }}
                          className={`w-20 bg-white/5 border rounded-lg text-xs px-2 py-1.5 text-center focus:outline-none transition-colors ${
                            overLimit
                              ? "border-red-400/60 text-red-400 focus:border-red-400"
                              : "border-white/10 text-white/70 focus:border-emerald-400/40"
                          }`}
                        />
                        <span className="text-white/40 text-xs">g de {selCarb.name}</span>
                        {customG != null && (
                          <button
                            onClick={() => setMealGrams(meal.id, null)}
                            className="text-white/30 hover:text-white/60 text-xs"
                          >
                            ✕
                          </button>
                        )}
                        {overLimit && (
                          <span className="text-red-400 text-xs font-medium whitespace-nowrap">
                            Límite diario excedido
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Tip */}
                {meal.note && (
                  <div className="flex items-start gap-2 text-amber-400 text-sm mb-3">
                    <Lightbulb className="h-4 w-4 shrink-0 mt-0.5" />
                    <span className="leading-snug">{meal.note}</span>
                  </div>
                )}

                {/* Replacement food form — only when skipped */}
                {isSkipped && (
                  <div className="mb-3 space-y-2">
                    <p className="text-amber-300/60 text-xs">¿Qué comiste en su lugar?</p>
                    {/* Listed replacement foods */}
                    {(skippedMeals[meal.id]?.foods ?? []).map((food, i) => (
                      <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-1.5">
                        <span className="text-white/70 text-sm">{food.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-orange-400 text-xs font-medium">{food.kcal} kcal</span>
                          <button
                            onClick={() => handleRemoveFood(meal.id, i)}
                            className="text-white/30 hover:text-white/60 leading-none"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {/* Add food input with autocomplete */}
                    <div className="space-y-1">
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            placeholder="Buscar alimento..."
                            value={foodInput[meal.id]?.name ?? ""}
                            onChange={(e) => {
                              const val = e.target.value
                              setFoodInput((prev) => ({ ...prev, [meal.id]: { ...prev[meal.id], name: val, kcalPer100g: prev[meal.id]?.kcalPer100g ?? null } }))
                              debouncedFoodSearch(meal.id, val)
                            }}
                            onKeyDown={(e) => e.key === "Enter" && handleAddFood(meal.id)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg text-xs px-2 py-1.5 text-white/70 placeholder:text-white/30 focus:outline-none focus:border-amber-400/40"
                          />
                          {/* Autocomplete dropdown */}
                          {(foodSuggestions[meal.id]?.length ?? 0) > 0 && (
                            <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-zinc-900/95 border border-white/20 rounded-lg shadow-xl max-h-40 overflow-y-auto">
                              {foodSuggestions[meal.id].map((item, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => {
                                    setFoodInput((prev) => ({
                                      ...prev,
                                      [meal.id]: { name: item.name, grams: prev[meal.id]?.grams ?? "", kcalPer100g: item.kcal_100g },
                                    }))
                                    setFoodSuggestions((prev) => ({ ...prev, [meal.id]: [] }))
                                  }}
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-white/10 flex justify-between items-center gap-2 border-b border-white/5 last:border-0"
                                >
                                  <span className="text-white/80 truncate">{item.name}</span>
                                  <span className="text-amber-400 font-medium shrink-0">{item.kcal_100g} kcal/100g</span>
                                </button>
                              ))}
                            </div>
                          )}
                          {searchingFood[meal.id] && (
                            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                              <div className="h-3 w-3 border border-amber-400/60 border-t-transparent rounded-full animate-spin" />
                            </div>
                          )}
                        </div>
                        <input
                          type="number"
                          placeholder="g"
                          min="1"
                          value={foodInput[meal.id]?.grams ?? ""}
                          onChange={(e) => setFoodInput((prev) => ({ ...prev, [meal.id]: { ...prev[meal.id], grams: e.target.value, kcalPer100g: prev[meal.id]?.kcalPer100g ?? null } }))}
                          onKeyDown={(e) => e.key === "Enter" && handleAddFood(meal.id)}
                          className="w-14 bg-white/5 border border-white/10 rounded-lg text-xs px-2 py-1.5 text-white/70 text-center placeholder:text-white/30 focus:outline-none focus:border-amber-400/40"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleAddFood(meal.id)}
                          disabled={!foodInput[meal.id]?.name || !foodInput[meal.id]?.grams}
                          className="h-7 w-7 p-0 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/30"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      {/* Show calculated kcal preview */}
                      {foodInput[meal.id]?.kcalPer100g != null && foodInput[meal.id]?.grams && (
                        <p className="text-amber-400/60 text-[10px] pl-1">
                          ≈ {Math.round((foodInput[meal.id].kcalPer100g! * parseInt(foodInput[meal.id].grams || "0")) / 100)} kcal
                          ({foodInput[meal.id].kcalPer100g} kcal/100g)
                        </p>
                      )}
                      {!foodInput[meal.id]?.kcalPer100g && (
                        <p className="text-white/25 text-[10px] pl-1">Busca un alimento para autocompletar kcal</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Swap + Skip buttons */}
                <div className="flex gap-2">
                  {!isSkipped && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSwap(meal.id)}
                      disabled={swapping === meal.id}
                      className="flex-1 bg-white/5 border-white/20 text-white hover:bg-white/10 hover:border-white/30"
                    >
                      <Shuffle className={`mr-2 h-4 w-4 ${swapping === meal.id ? "animate-spin" : ""}`} />
                      Cambiar plato
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSkipMeal(meal.id)}
                    className={`${isSkipped ? "flex-1" : ""} border text-xs h-9 ${
                      isSkipped
                        ? "bg-white/5 border-white/20 text-white/60 hover:bg-white/10"
                        : "bg-amber-500/10 border-amber-400/20 text-amber-300/70 hover:bg-amber-500/20"
                    }`}
                  >
                    {isSkipped ? (
                      <><Shuffle className="mr-1.5 h-3.5 w-3.5" />Restaurar comida</>
                    ) : (
                      <><Ban className="mr-1.5 h-3.5 w-3.5" />Saltar</>
                    )}
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>

        {/* Adherence Checklist */}
        <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <h3 className="text-xl font-semibold text-white">Seguimiento de adherencia</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {adherenceItems.map((item) => {
              const isItemSkipped = !!skippedMeals[item.id]
              const replacementFoods = skippedMeals[item.id]?.foods ?? []
              const replacementTotal = replacementFoods.reduce((s, f) => s + f.kcal, 0)
              return (
                <label
                  key={item.id}
                  className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                    isItemSkipped
                      ? "bg-amber-500/5 border-amber-400/15 cursor-default"
                      : "bg-white/5 border-white/10 hover:bg-white/10 cursor-pointer"
                  }`}
                >
                  {isItemSkipped ? (
                    <Ban className="h-4 w-4 text-amber-400/50 shrink-0" />
                  ) : (
                    <Checkbox
                      checked={item.checked}
                      onCheckedChange={(checked) => handleAdherenceChange(item.id, checked as boolean)}
                      className="border-white/30 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm ${isItemSkipped ? "text-white/30 line-through" : item.checked ? "text-white line-through opacity-60" : "text-white"}`}>
                      {item.label}
                    </span>
                    {isItemSkipped && replacementTotal > 0 && (
                      <p className="text-amber-300/50 text-xs mt-0.5">{replacementFoods.map(f => f.name).join(", ")} · {replacementTotal} kcal</p>
                    )}
                    {isItemSkipped && replacementTotal === 0 && (
                      <p className="text-white/25 text-xs mt-0.5">Sin reemplazo registrado</p>
                    )}
                  </div>
                </label>
              )
            })}
          </div>
        </Card>

      </div>

      {/* Compensation modal */}
      {showCompModal && cheatRecord && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
                <h3 className="text-white font-bold text-lg">Comodín detectado</h3>
              </div>
              <button onClick={() => setShowCompModal(false)} className="text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-amber-500/10 border border-amber-400/20 rounded-xl p-4 mb-4">
              <p className="text-amber-300 text-sm font-medium mb-1">
                Exceso de {cheatRecord.excess} kcal registrado
              </p>
              <p className="text-white/60 text-xs">
                Distribuido en los próximos 3 días:
                <span className="text-white font-semibold ml-1">
                  -{Math.round(cheatRecord.excess / 3)} kcal/día
                </span>
              </p>
            </div>

            <p className="text-white/60 text-sm mb-5">
              ¿Quieres compensar este exceso en los próximos 3 días para mantener tu meta semanal intacta?
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => { declineCompensation(); setShowCompModal(false) }}
                className="flex-1 px-4 py-2 border border-white/20 rounded-xl text-white/60 text-sm hover:bg-white/5"
              >
                No, gracias
              </button>
              <button
                onClick={() => { setupCompensation(day.date); setShowCompModal(false) }}
                className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 rounded-xl text-white text-sm font-medium"
              >
                Compensar
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
