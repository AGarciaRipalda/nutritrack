"use client"

import { useEffect, useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Shuffle,
  Coffee,
  Sun,
  Utensils,
  Cookie,
  Moon,
  Lightbulb,
  CheckCircle2,
} from "lucide-react"
import type { PlanDay, Meal } from "@/lib/api"
import { fetchTodaysPlan, swapMeal, updateAdherence } from "@/lib/api"

const today = new Date().toISOString().slice(0, 10)
const mockPlanDay: PlanDay = {
  date: today,
  dayName: new Date().toLocaleDateString("es-ES", { weekday: "long" }),
  meals: [
    {
      id: "desayuno",
      type: "breakfast",
      name: "Desayuno",
      kcal: 380,
      description: "Yogur griego con frutos rojos, miel y copos de avena",
      note: "Añade semillas de chía para más fibra y omega-3",
    },
    {
      id: "media_manana",
      type: "mid-morning",
      name: "Media mañana",
      kcal: 220,
      description: "Manzana en rodajas con 2 cucharadas de crema de almendras",
      note: "Elige manzanas de temporada",
    },
    {
      id: "almuerzo",
      type: "lunch",
      name: "Almuerzo",
      kcal: 520,
      description: "Pechuga de pollo a la plancha con ensalada mixta, aguacate y tomate cherry",
      note: "Aliña con aceite de oliva virgen extra",
    },
    {
      id: "merienda",
      type: "snack",
      name: "Merienda",
      kcal: 280,
      description: "Batido de proteínas con plátano, espinacas y leche de almendras",
      note: "Añade hielo para una textura más espesa",
    },
    {
      id: "cena",
      type: "dinner",
      name: "Cena",
      kcal: 650,
      description: "Filete de salmón al horno con quinoa y verduras asadas",
      note: "Sazona el salmón con limón y eneldo",
    },
  ],
  totalKcal: 2050,
}

const mealIcons: Record<string, typeof Coffee> = {
  breakfast: Coffee,
  "mid-morning": Sun,
  lunch: Utensils,
  snack: Cookie,
  dinner: Moon,
}

const mealLabels: Record<string, string> = {
  breakfast: "Desayuno",
  "mid-morning": "Media mañana",
  lunch: "Almuerzo",
  snack: "Merienda",
  dinner: "Cena",
}

const mealIdLabels: Record<string, string> = {
  desayuno:     "Desayuno",
  media_manana: "Media mañana",
  almuerzo:     "Almuerzo",
  merienda:     "Merienda",
  cena:         "Cena",
}

export default function DietPage() {
  const [data, setData] = useState<(PlanDay & { stale?: boolean }) | null>(null)
  const [stale, setStale] = useState(false)
  const [loading, setLoading] = useState(true)
  const [swapping, setSwapping] = useState<string | null>(null)
  const [checkedMeals, setCheckedMeals] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetchTodaysPlan()
      .then((d) => {
        setStale(d.stale ?? false)
        setData(d)
      })
      .catch(() => setData(mockPlanDay))
      .finally(() => setLoading(false))
  }, [])

  const handleSwap = async (mealId: string) => {
    if (!data) return
    setSwapping(mealId)
    try {
      const updatedDay = await swapMeal(mealId)
      // Merge: preserve local stale flag
      setData((prev) => prev ? { ...updatedDay, stale: prev.stale } : updatedDay)
    } catch {
      // Keep existing data on error (graceful degradation)
    }
    setSwapping(null)
  }

  const adherenceItems = (data?.meals ?? []).map((m) => ({
    id: m.id,
    label: mealLabels[m.type] ?? m.name,
    checked: checkedMeals[m.id] ?? false,
  }))

  const handleAdherenceChange = async (itemId: string, checked: boolean) => {
    setCheckedMeals((prev) => ({ ...prev, [itemId]: checked }))
    try {
      await updateAdherence({ [itemId]: checked })
    } catch { /* keep optimistic update */ }
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

  const planDay = data ?? mockPlanDay

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Stale banner */}
        {stale && (
          <div className="bg-amber-500/20 border border-amber-400/30 rounded-2xl p-4 flex items-center justify-between">
            <span className="text-amber-300 text-sm">
              Tu plan es de la semana pasada. ¿Regenerar ahora?
            </span>
            <a href="/weekly-plan" className="text-amber-400 text-sm font-semibold hover:underline ml-4">
              Ver plan →
            </a>
          </div>
        )}

        {/* Header */}
        <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-3xl font-bold text-white">Dieta de hoy</h2>
              <p className="text-white/60 text-sm">
                {planDay.dayName}, semana del{" "}
                {new Date(planDay.date + "T00:00:00").toLocaleDateString("es-ES", {
                  day: "numeric", month: "short"
                })}
              </p>
              <p className="text-white/60 mt-1">
                Total planificado:{" "}
                <span className="text-emerald-400 font-semibold">
                  {planDay.exerciseAdj
                    ? planDay.exerciseAdj.adjustedTotal
                    : planDay.totalKcal}{" "}
                  kcal
                </span>
              </p>
              {planDay.exerciseAdj && planDay.exerciseAdj.extraKcal > 0 && (
                <p className="text-yellow-300 text-sm mt-1">
                  ⚡ +{planDay.exerciseAdj.extraKcal} kcal · porciones ampliadas
                  <span className="text-white/40 ml-1">({planDay.exerciseAdj.source})</span>
                </p>
              )}
            </div>
            <a
              href="/weekly-plan"
              className="text-emerald-400 text-sm font-semibold hover:underline flex items-center gap-1"
            >
              Ver plan completo →
            </a>
          </div>
        </Card>

        {/* Meal Cards */}
        <div className="grid grid-cols-1 gap-3">
          {planDay.meals.map((meal) => {
            const MealIcon = mealIcons[meal.type] || Utensils
            const label = mealLabels[meal.type] ?? mealIdLabels[meal.id]
            return (
              <Card
                key={meal.id}
                className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-4 transition-all duration-300 hover:bg-white/15"
              >
                {/* Header: icon + label + kcal */}
                <div className="flex items-center gap-2 border-b border-white/10 pb-3 mb-3">
                  <div className="p-2 bg-emerald-500/20 rounded-lg border border-emerald-400/30 shrink-0">
                    <MealIcon className="h-4 w-4 text-emerald-400" />
                  </div>
                  <span className="text-white/60 text-sm font-medium flex-1">{label}</span>
                  <div className="text-right shrink-0">
                    <span className="text-white font-bold text-lg leading-none">
                      {meal.adjustedKcal ?? meal.kcal}
                    </span>
                    <span className="text-white/60 text-sm ml-1">kcal</span>
                    {meal.portionScale && meal.portionScale > 1 && (
                      <p className="text-yellow-300 text-xs mt-0.5">×{meal.portionScale.toFixed(2)}</p>
                    )}
                  </div>
                </div>

                {/* Dish description */}
                <p className="text-white text-sm leading-snug mb-3">{meal.description}</p>

                {/* Tip */}
                {meal.note && (
                  <div className="flex items-start gap-2 text-amber-400 text-sm mb-3">
                    <Lightbulb className="h-4 w-4 shrink-0 mt-0.5" />
                    <span className="leading-snug">{meal.note}</span>
                  </div>
                )}

                {/* Swap button — full width on mobile */}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            {adherenceItems.map((item) => (
              <label
                key={item.id}
                className="flex items-center gap-3 p-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-all duration-300 cursor-pointer"
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
