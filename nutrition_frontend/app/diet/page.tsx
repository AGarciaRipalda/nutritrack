"use client"

import { useEffect, useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Shuffle, Coffee, Sun, Utensils, Cookie, Moon,
  Lightbulb, CheckCircle2, Wheat, Scale,
} from "lucide-react"
import type { PlanDay } from "@/lib/api"
import { fetchTodaysPlan, swapMeal, updateAdherence, fetchFavoriteCarbs } from "@/lib/api"
import { useDietDay } from "@/context/DietDayContext"

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

  const [planDay, setPlanDay]     = useState<(PlanDay & { stale?: boolean }) | null>(null)
  const [stale, setStale]         = useState(false)
  const [loading, setLoading]     = useState(true)
  const [swapping, setSwapping]   = useState<string | null>(null)
  const [checkedMeals, setCheckedMeals] = useState<Record<string, boolean>>({})

  useEffect(() => {
    Promise.all([fetchTodaysPlan(), fetchFavoriteCarbs()])
      .then(([d, carbs]) => {
        setStale(d.stale ?? false)
        setPlanDay(d)
        const target = d.exerciseAdj?.adjustedTotal ?? d.totalKcal
        init(d.date, target, d.meals, carbs)
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

  const handleAdherenceChange = async (itemId: string, checked: boolean) => {
    setCheckedMeals((prev) => ({ ...prev, [itemId]: checked }))
    try { await updateAdherence({ [itemId]: checked }) } catch {}
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
  const { totalEffective, remaining, exceeded, overLimit, rebalancedTargets, effectiveKcalPerMeal } = derived
  const dailyTarget = state.dailyTarget || day.totalKcal
  const pct = dailyTarget > 0 ? Math.min((totalEffective / dailyTarget) * 100, 110) : 0

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
            </div>
            <a href="/weekly-plan" className="text-emerald-400 text-sm font-semibold hover:underline">
              Ver plan completo →
            </a>
          </div>

          {/* Daily budget bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">Consumido</span>
              <span className={`font-semibold ${overLimit ? "text-red-400" : exceeded ? "text-amber-400" : "text-emerald-400"}`}>
                {state.initialized ? totalEffective : day.totalKcal} / {dailyTarget} kcal
              </span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  overLimit ? "bg-red-400" : exceeded ? "bg-amber-400" : "bg-emerald-400"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-white/40">
              <span>
                {state.initialized
                  ? remaining >= 0
                    ? `Restante: ${remaining} kcal`
                    : `Exceso: +${Math.abs(remaining)} kcal`
                  : ""}
              </span>
              {overLimit && (
                <span className="text-red-400 font-medium">⚠ Límite diario excedido</span>
              )}
            </div>
          </div>
        </Card>

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

            const isMealOverLimit = state.initialized && overLimit

            // Rebalance hint for this meal
            const rebalHint = rebalancedTargets[meal.id]

            return (
              <Card
                key={meal.id}
                className={`backdrop-blur-xl border rounded-2xl p-4 transition-all duration-300 ${
                  isMealOverLimit
                    ? "bg-red-500/10 border-red-400/30"
                    : "bg-white/10 border-white/20 hover:bg-white/15"
                }`}
              >
                {/* Header: icon + label + kcal */}
                <div className="flex items-center gap-2 border-b border-white/10 pb-3 mb-3">
                  <div className="p-2 bg-emerald-500/20 rounded-lg border border-emerald-400/30 shrink-0">
                    <MealIcon className="h-4 w-4 text-emerald-400" />
                  </div>
                  <span className="text-white/60 text-sm font-medium flex-1">{label}</span>
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

                {/* Swap button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSwap(meal.id)}
                  disabled={swapping === meal.id}
                  className="w-full bg-white/5 border-white/20 text-white hover:bg-white/10 hover:border-white/30"
                >
                  <Shuffle className={`mr-2 h-4 w-4 ${swapping === meal.id ? "animate-spin" : ""}`} />
                  Cambiar plato
                </Button>
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
            {adherenceItems.map((item) => (
              <label
                key={item.id}
                className="flex items-center gap-3 p-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
              >
                <Checkbox
                  checked={item.checked}
                  onCheckedChange={(checked) => handleAdherenceChange(item.id, checked as boolean)}
                  className="border-white/30 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                />
                <span className={`text-white ${item.checked ? "line-through opacity-60" : ""}`}>
                  {item.label}
                </span>
              </label>
            ))}
          </div>
        </Card>

      </div>
    </AppLayout>
  )
}
