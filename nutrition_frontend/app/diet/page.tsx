"use client"

import { useEffect, useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  RefreshCw,
  Shuffle,
  Coffee,
  Sun,
  Utensils,
  Cookie,
  Moon,
  Lightbulb,
  CheckCircle2,
} from "lucide-react"
import type { TodaysDiet, Meal } from "@/lib/api"
import { fetchTodaysDiet, swapMeal, regenerateDay, updateAdherence } from "@/lib/api"

const mockDietData: TodaysDiet = {
  meals: [
    {
      id: "1",
      type: "breakfast",
      name: "Desayuno",
      kcal: 380,
      description: "Yogur griego con frutos rojos, miel y copos de avena",
      tip: "Añade semillas de chía para más fibra y omega-3",
    },
    {
      id: "2",
      type: "mid-morning",
      name: "Media mañana",
      kcal: 220,
      description: "Manzana en rodajas con 2 cucharadas de crema de almendras",
      tip: "Elige manzanas de temporada",
    },
    {
      id: "3",
      type: "lunch",
      name: "Almuerzo",
      kcal: 520,
      description: "Pechuga de pollo a la plancha con ensalada mixta, aguacate y tomate cherry",
      tip: "Aliña con aceite de oliva virgen extra",
    },
    {
      id: "4",
      type: "snack",
      name: "Merienda",
      kcal: 280,
      description: "Batido de proteínas con plátano, espinacas y leche de almendras",
      tip: "Añade hielo para una textura más espesa",
    },
    {
      id: "5",
      type: "dinner",
      name: "Cena",
      kcal: 650,
      description: "Filete de salmón al horno con quinoa y verduras asadas",
      tip: "Sazona el salmón con limón y eneldo",
    },
  ],
  adherenceChecklist: [
    { id: "a1", label: "Bebí 8 vasos de agua", checked: false },
    { id: "a2", label: "Comí todas las comidas planificadas", checked: false },
    { id: "a3", label: "Sin picar entre horas", checked: false },
    { id: "a4", label: "Tomé vitaminas/suplementos", checked: false },
  ],
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

export default function DietPage() {
  const [data, setData] = useState<TodaysDiet | null>(null)
  const [loading, setLoading] = useState(true)
  const [swapping, setSwapping] = useState<string | null>(null)
  const [regenerating, setRegenerating] = useState(false)

  useEffect(() => {
    fetchTodaysDiet()
      .then(setData)
      .catch(() => setData(mockDietData))
      .finally(() => setLoading(false))
  }, [])

  const handleSwap = async (mealId: string) => {
    if (!data) return
    setSwapping(mealId)
    try {
      // swapMeal devuelve TodaysDiet completo; preservamos el estado del checklist
      const newData = await swapMeal(mealId)
      setData((prev) => prev ? { ...newData, adherenceChecklist: prev.adherenceChecklist } : newData)
    } catch {
      // Fallback en español cuando la API no está disponible
      const mealIndex = data.meals.findIndex((m) => m.id === mealId)
      if (mealIndex !== -1) {
        const alternatives: Record<string, Meal> = {
          breakfast: {
            id: mealId,
            type: "breakfast",
            name: "Tostada con aguacate y huevo",
            kcal: 370,
            description: "Pan integral tostado con aguacate machacado, huevo pochado y tomate",
            tip: "Añade semillas de cáñamo para más proteínas",
          },
          "mid-morning": {
            id: mealId,
            type: "mid-morning",
            name: "Plátano con mantequilla de almendras",
            kcal: 190,
            description: "Plátano mediano con una cucharada de crema de almendras",
            tip: "Aporta energía sostenida antes del almuerzo",
          },
          lunch: {
            id: mealId,
            type: "lunch",
            name: "Bowl de atún con quinoa",
            kcal: 490,
            description: "Quinoa con atún al natural, tomate cherry, pepino y aceite de oliva",
            tip: "Aliña con limón para potenciar el sabor",
          },
          snack: {
            id: mealId,
            type: "snack",
            name: "Yogur griego con nueces",
            kcal: 230,
            description: "Yogur griego natural con nueces y un chorrito de miel",
            tip: "Alto en proteínas, ideal para la recuperación muscular",
          },
          dinner: {
            id: mealId,
            type: "dinner",
            name: "Merluza al horno con verduras",
            kcal: 420,
            description: "Lomos de merluza al horno con pimiento, cebolla y tomate",
            tip: "Añade zumo de limón antes de servir",
          },
        }
        const meal = data.meals[mealIndex]
        const fallbackMeal = alternatives[meal.type] || meal
        setData({
          ...data,
          meals: data.meals.map((m, i) => (i === mealIndex ? fallbackMeal : m)),
        })
      }
    }
    setSwapping(null)
  }

  const handleRegenerate = async () => {
    setRegenerating(true)
    try {
      const newData = await regenerateDay()
      setData(newData)
    } catch {
      // Fallback: rotar las comidas del mock para simular regeneración
      setData((prev) => {
        if (!prev) return mockDietData
        const rotated = [...prev.meals.slice(1), prev.meals[0]]
        return { ...prev, meals: rotated }
      })
    }
    setRegenerating(false)
  }

  const handleAdherenceChange = async (itemId: string, checked: boolean) => {
    if (!data) return
    setData({
      ...data,
      adherenceChecklist: data.adherenceChecklist.map((item) =>
        item.id === itemId ? { ...item, checked } : item
      ),
    })
    try {
      await updateAdherence(itemId, checked)
    } catch {
      // Keep optimistic update
    }
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

  const diet = data || mockDietData
  const totalKcal = diet.meals.reduce((sum, meal) => sum + meal.kcal, 0)

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-3xl font-bold text-white">Dieta de hoy</h2>
              <p className="text-white/60">
                Total planificado: <span className="text-emerald-400 font-semibold">{totalKcal} kcal</span>
              </p>
            </div>
            <Button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/30 text-white transition-all duration-300"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${regenerating ? "animate-spin" : ""}`} />
              Regenerar dieta
            </Button>
          </div>
        </Card>

        {/* Meal Cards */}
        <div className="grid grid-cols-1 gap-4">
          {diet.meals.map((meal) => {
            const MealIcon = mealIcons[meal.type] || Utensils
            return (
              <Card
                key={meal.id}
                className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6 transition-all duration-300 hover:bg-white/15"
              >
                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    <div className="p-3 bg-emerald-500/20 rounded-xl border border-emerald-400/30">
                      <MealIcon className="h-6 w-6 text-emerald-400" />
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className="text-white/60 text-sm">{mealLabels[meal.type]}</p>
                        <h3 className="text-xl font-semibold text-white">{meal.name}</h3>
                      </div>
                      <p className="text-white/80">{meal.description}</p>
                      <div className="flex items-center gap-2 text-amber-400 text-sm">
                        <Lightbulb className="h-4 w-4" />
                        <span>{meal.tip}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-white">{meal.kcal}</p>
                      <p className="text-white/60 text-sm">kcal</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSwap(meal.id)}
                      disabled={swapping === meal.id}
                      className="bg-white/5 border-white/20 text-white hover:bg-white/10 hover:border-white/30"
                    >
                      <Shuffle className={`mr-2 h-4 w-4 ${swapping === meal.id ? "animate-spin" : ""}`} />
                      Cambiar plato
                    </Button>
                  </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            {diet.adherenceChecklist.map((item) => (
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
