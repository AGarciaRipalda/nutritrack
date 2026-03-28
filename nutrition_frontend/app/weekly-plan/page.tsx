"use client"

import { useEffect, useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import {
  ShoppingCart, CalendarDays, Coffee, Sun, Utensils,
  Cookie, Moon, FileDown, Lightbulb, RefreshCw, X, Star, Shuffle, AlertTriangle,
} from "lucide-react"
import type { WeeklyPlanResponse, PlanDay, WeeklyHistorySummary } from "@/lib/api"
import {
  fetchWeeklyPlan,
  regenerateWeeklyPlan,
  repeatWeeklyPlan,
  swapWeeklyMeal,
} from "@/lib/api"
import { loadDayFromStorage } from "@/context/DietDayContext"
import { useCheatDay } from "@/context/CheatDayContext"

const todayISO = typeof window !== "undefined" ? new Date().toISOString().slice(0, 10) : ""

const mockWeeklyPlanResponse: WeeklyPlanResponse = {
  stale: false,
  summary: null,
  days: [
    {
      date: "2026-03-16", dayName: "Lunes", totalKcal: 1725,
      meals: [
        { id: "desayuno",     type: "breakfast",   name: "Desayuno",     kcal: 386, description: "80g de pan thins con 40g de jamón serrano y tomate + café", note: "4 rebanadas de pan thins. Tomate natural en rodajas." },
        { id: "media_manana", type: "mid-morning",  name: "Media mañana", kcal: 175, description: "Yogurt proteínas (200g) + 13g de frutos secos", note: "Frutos secos de la bolsa de Aldi." },
        { id: "almuerzo",     type: "lunch",        name: "Almuerzo",     kcal: 645, description: "105g de espaguetis con 120g de carne picada de ternera, tomate frito sin azúcar y orégano", note: "Sofríe la carne con ajo y añade tomate al final." },
        { id: "merienda",     type: "snack",        name: "Merienda",     kcal: 175, description: "2 tortitas de arroz con 50g de pavo y guacamole", note: "Crema de cacahuete opcional." },
        { id: "cena",         type: "dinner",       name: "Cena",         kcal: 344, description: "2 huevos a la plancha con medio calabacín y tomate frito sin azúcar", note: "Espolvorea orégano sobre los huevos." },
      ],
    },
    {
      date: "2026-03-17", dayName: "Martes", totalKcal: 1620,
      meals: [
        { id: "desayuno",     type: "breakfast",   name: "Desayuno",     kcal: 325, description: "60g de cereales crunchy Mercadona con leche semidesnatada", note: "Corn flakes, espelta o crunchy Mercadona." },
        { id: "media_manana", type: "mid-morning",  name: "Media mañana", kcal: 175, description: "1 fruta de temporada + 3-4 nueces", note: "Manzana, pera o naranja." },
        { id: "almuerzo",     type: "lunch",        name: "Almuerzo",     kcal: 570, description: "107g de arroz basmati con 140g de pechuga de pollo y brócoli al vapor", note: "Aliña el brócoli con limón y ajo." },
        { id: "merienda",     type: "snack",        name: "Merienda",     kcal: 175, description: "Medio kefir con sandía + 13g de frutos secos", note: "Puedes cambiar kefir por yogurt proteínas." },
        { id: "cena",         type: "dinner",       name: "Cena",         kcal: 375, description: "170g de merluza al horno con verduras al gusto", note: "Con limón, perejil y un hilo de aceite." },
      ],
    },
    {
      date: "2026-03-18", dayName: "Miércoles", totalKcal: 1532,
      meals: [
        { id: "desayuno",     type: "breakfast",   name: "Desayuno",     kcal: 362, description: "80g de pan centeno con 30g de jamón serrano y tomate + café", note: "Pan recomendado: Thins, Rustik, centeno." },
        { id: "media_manana", type: "mid-morning",  name: "Media mañana", kcal: 175, description: "Batido de proteínas con agua o leche vegetal", note: "Aporta ~25g de proteína." },
        { id: "almuerzo",     type: "lunch",        name: "Almuerzo",     kcal: 460, description: "200g de ñoquis con 180g de gambas, cebollino y salsa de soja", note: "Salta los ñoquis hasta que doren." },
        { id: "merienda",     type: "snack",        name: "Merienda",     kcal: 175, description: "Bowl: 40g de harina de avena + 1 huevo + leche + oncita de chocolate (45s micro)", note: "45 segundos al microondas." },
        { id: "cena",         type: "dinner",       name: "Cena",         kcal: 360, description: "Ensalada de canónigos con 2 latas de atún, queso fresco y tomate", note: "Aliñar con aceite de oliva y vinagre." },
      ],
    },
    {
      date: "2026-03-19", dayName: "Jueves", totalKcal: 1697,
      meals: [
        { id: "desayuno",     type: "breakfast",   name: "Desayuno",     kcal: 410, description: "Tortita de avena: 30g de avena + 2 huevos + leche + 1 cdta cacahuete + onza chocolate negro", note: "Sartén antiadherente sin aceite." },
        { id: "media_manana", type: "mid-morning",  name: "Media mañana", kcal: 175, description: "50g de caña de lomo de pavo + 13g de frutos secos", note: "Opción fácil de llevar al trabajo." },
        { id: "almuerzo",     type: "lunch",        name: "Almuerzo",     kcal: 488, description: "Papas aliñás: 250g de patata cocida con 2 latas de atún, 1 huevo, cebolla y perejil", note: "Sirve templado. La patata aliñada gana sabor al reposar." },
        { id: "merienda",     type: "snack",        name: "Merienda",     kcal: 175, description: "Yogurt proteínas con 1 cda crema de cacahuete en polvo + fresas", note: "Endulza con stevia si lo necesitas." },
        { id: "cena",         type: "dinner",       name: "Cena",         kcal: 449, description: "Fajita de pan thins con 130g de pollo, cebolla, pimiento y salsa de yogurt", note: "Salsa yogurt: yogurt griego + ajo + limón." },
      ],
    },
    {
      date: "2026-03-20", dayName: "Viernes", totalKcal: 1806,
      meals: [
        { id: "desayuno",     type: "breakfast",   name: "Desayuno",     kcal: 366, description: "80g de pan thins con 1 lata de atún y 4 rodajas de tomate + café", note: "Aliña el atún con limón." },
        { id: "media_manana", type: "mid-morning",  name: "Media mañana", kcal: 175, description: "70g de pechuga de pavo/pollo + 13g de frutos secos", note: "Frutos secos de Aldi." },
        { id: "almuerzo",     type: "lunch",        name: "Almuerzo",     kcal: 700, description: "160g de salmón a la plancha con 107g de arroz basmati y brócoli", note: "Sin aceite extra — el salmón ya tiene grasa." },
        { id: "merienda",     type: "snack",        name: "Merienda",     kcal: 175, description: "1 lata de piña al natural + 4 nueces", note: "Piña sin almíbar." },
        { id: "cena",         type: "dinner",       name: "Cena",         kcal: 390, description: "2 hamburguesas de ternera (180g) con calabacín a la plancha", note: "Sin pan. Calabacín con ajo y sal." },
      ],
    },
    {
      date: "2026-03-21", dayName: "Sábado", totalKcal: 1407,
      meals: [
        { id: "desayuno",     type: "breakfast",   name: "Desayuno",     kcal: 325, description: "60g de cereales crunchy con leche semidesnatada", note: "Cereales crunchy Mercadona." },
        { id: "media_manana", type: "mid-morning",  name: "Media mañana", kcal: 175, description: "Bizcocho en taza: 30g de avena + levadura + 1 huevo + 2 onzas chocolate (4 min micro)", note: "4 minutos al microondas." },
        { id: "almuerzo",     type: "lunch",        name: "Almuerzo",     kcal: 432, description: "Lentejas: 200g de lentejas cocidas con verduras y 120g de pollo troceado", note: "Sofrito base: cebolla, pimiento, zanahoria." },
        { id: "merienda",     type: "snack",        name: "Merienda",     kcal: 175, description: "2 tajas de sandía + 13g de frutos secos", note: "Los frutos secos son muy saciantes." },
        { id: "cena",         type: "dinner",       name: "Cena",         kcal: 300, description: "140g de salmón a la plancha con espárragos verdes", note: "El salmón no necesita aceite extra." },
      ],
    },
    {
      date: "2026-03-22", dayName: "Domingo", totalKcal: 1720,
      meals: [
        { id: "desayuno",     type: "breakfast",   name: "Desayuno",     kcal: 410, description: "Tortita de avena: 30g de avena + 2 huevos + leche + 1 cdta cacahuete + onza chocolate negro", note: "Desayuno especial del domingo." },
        { id: "media_manana", type: "mid-morning",  name: "Media mañana", kcal: 175, description: "Yogurt proteínas (200g) + 1 pieza de fruta", note: "Cualquier fruta de temporada." },
        { id: "almuerzo",     type: "lunch",        name: "Almuerzo",     kcal: 600, description: "Paella de verduras: 120g de arroz con pimiento, judías verdes, zanahoria y tomate", note: "Caldo de verduras en lugar de agua." },
        { id: "merienda",     type: "snack",        name: "Merienda",     kcal: 175, description: "Fruta de temporada + 13g de frutos secos", note: "Naranja, kiwi o fresas." },
        { id: "cena",         type: "dinner",       name: "Cena",         kcal: 360, description: "Ensalada mixta con 100g de pavo, aguacate y tomate cherry", note: "Con aceite de oliva y vinagre balsámico." },
      ],
    },
  ],
}

const mealTypeIcons: Record<string, typeof Coffee> = {
  breakfast: Coffee,
  "mid-morning": Sun,
  lunch: Utensils,
  snack: Cookie,
  dinner: Moon,
}

const mealIdIcons: Record<string, typeof Coffee> = {
  desayuno:     Coffee,
  media_manana: Sun,
  almuerzo:     Utensils,
  merienda:     Cookie,
  cena:         Moon,
}

const mealDisplayName: Record<string, string> = {
  desayuno:     "Desayuno",
  media_manana: "Media mañana",
  almuerzo:     "Almuerzo",
  merienda:     "Merienda",
  cena:         "Cena",
}

const mealIdEmoji: Record<string, string> = {
  desayuno:     "☕",
  media_manana: "🌅",
  almuerzo:     "🍽️",
  merienda:     "🍎",
  cena:         "🌙",
}

const mealTypeEmoji: Record<string, string> = {
  breakfast: "☕",
  "mid-morning": "🌅",
  lunch: "🍽️",
  snack: "🍎",
  dinner: "🌙",
}

const mealTypeColor: Record<string, { bg: string; text: string; border: string }> = {
  breakfast:    { bg: "#fef3c7", text: "#92400e", border: "#fde68a" },
  "mid-morning": { bg: "#ffe4e6", text: "#9f1239", border: "#fecdd3" },
  lunch:        { bg: "#dcfce7", text: "#14532d", border: "#bbf7d0" },
  snack:        { bg: "#ede9fe", text: "#4c1d95", border: "#ddd6fe" },
  dinner:       { bg: "#e0f2fe", text: "#0c4a6e", border: "#bae6fd" },
}

const mealCardTone: Record<string, { card: string; icon: string; iconText: string; badge: string }> = {
  breakfast: {
    card: "bg-amber-50/90 dark:bg-amber-500/10 border-amber-200/80 dark:border-amber-400/15",
    icon: "bg-amber-100 dark:bg-amber-500/15",
    iconText: "text-amber-700 dark:text-amber-300",
    badge: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-400/20",
  },
  "mid-morning": {
    card: "bg-rose-50/85 dark:bg-rose-500/10 border-rose-200/75 dark:border-rose-400/15",
    icon: "bg-rose-100 dark:bg-rose-500/15",
    iconText: "text-rose-700 dark:text-rose-300",
    badge: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-400/20",
  },
  lunch: {
    card: "bg-emerald-50/85 dark:bg-emerald-500/10 border-emerald-200/75 dark:border-emerald-400/15",
    icon: "bg-emerald-100 dark:bg-emerald-500/15",
    iconText: "text-emerald-700 dark:text-emerald-300",
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-400/20",
  },
  snack: {
    card: "bg-violet-50/85 dark:bg-violet-500/10 border-violet-200/75 dark:border-violet-400/15",
    icon: "bg-violet-100 dark:bg-violet-500/15",
    iconText: "text-violet-700 dark:text-violet-300",
    badge: "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-400/20",
  },
  dinner: {
    card: "bg-sky-50/90 dark:bg-sky-500/10 border-sky-200/80 dark:border-sky-400/15",
    icon: "bg-sky-100 dark:bg-sky-500/15",
    iconText: "text-sky-700 dark:text-sky-300",
    badge: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-400/20",
  },
}

// ── Screen meal card ────────────────────────────────────────────────────────
function MealCard({
  meal,
  onSwap,
  swapping = false,
}: {
  meal: PlanDay["meals"][0]
  onSwap?: () => void
  swapping?: boolean
}) {
  const MealIcon = mealIdIcons[meal.id] ?? mealTypeIcons[meal.type] ?? Utensils
  const tone = mealCardTone[meal.type] ?? mealCardTone.lunch
  return (
    <div className={`flex h-full min-h-[220px] flex-col gap-3 rounded-2xl border p-4 shadow-sm md:min-h-[240px] md:p-5 ${tone.card}`}>
      {/* Title row: icon + meal name + kcal */}
      <div className="flex items-center gap-3 border-b border-black/5 pb-3 dark:border-white/10">
        <div className={`shrink-0 rounded-xl p-2 ${tone.icon}`}>
          <MealIcon className={`h-4 w-4 md:h-5 md:w-5 ${tone.iconText}`} />
        </div>
        <span className="flex-1 text-base font-semibold text-foreground">
          {mealDisplayName[meal.id] ?? meal.name}
        </span>
        {meal.kcal > 0 && (
          <Badge className={`shrink-0 px-2 py-0.5 text-xs md:text-[13px] ${tone.badge}`}>
            {meal.kcal} kcal
          </Badge>
        )}
      </div>
      {/* Description */}
      <p className="flex-1 text-sm leading-6 text-foreground/80 md:text-[15px]">{meal.description}</p>
      {/* Note */}
      {meal.note && (
        <div className="mt-1 flex items-start gap-2">
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-400" />
          <span className="text-xs leading-5 text-amber-700 dark:text-amber-400/80 md:text-[13px]">{meal.note}</span>
        </div>
      )}
      {/* Swap button */}
      {onSwap && (
        <button
          onClick={onSwap}
          disabled={swapping}
          className="mt-2 flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-xl border border-black/10 py-2 text-sm font-medium text-foreground/55 transition-colors hover:border-black/20 hover:bg-black/10 hover:text-foreground disabled:opacity-40 dark:border-white/10 dark:hover:border-white/20 dark:hover:bg-white/10"
        >
          <Shuffle className={`h-3.5 w-3.5 ${swapping ? "animate-spin" : ""}`} />
          {swapping ? "Cambiando..." : "Cambiar plato"}
        </button>
      )}
    </div>
  )
}

// ── Print day card ──────────────────────────────────────────────────────────
function PrintDayCard({ dayPlan }: { dayPlan: PlanDay }) {
  const totalKcal = dayPlan.totalKcal

  return (
    <div
      style={{
        breakInside: "avoid",
        marginBottom: "14pt",
        border: "1px solid #d1d5db",
        borderRadius: "8px",
        overflow: "hidden",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Day header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "#064e3b",
          color: "white",
          padding: "6pt 10pt",
        }}
      >
        <span style={{ fontWeight: 700, fontSize: "12pt", letterSpacing: "0.02em" }}>
          {dayPlan.dayName}
        </span>
        {totalKcal > 0 && (
          <span
            style={{
              fontSize: "9pt",
              backgroundColor: "rgba(255,255,255,0.15)",
              padding: "2pt 8pt",
              borderRadius: "20pt",
              fontWeight: 600,
            }}
          >
            {totalKcal} kcal totales
          </span>
        )}
      </div>

      {/* Meals row */}
      <div style={{ display: "flex" }}>
        {dayPlan.meals.map((meal, idx) => {
          const color = mealTypeColor[meal.type] ?? { bg: "#f9fafb", text: "#374151", border: "#e5e7eb" }
          return (
            <div
              key={meal.id}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: "4pt",
                padding: "7pt 7pt",
                borderRight: idx < dayPlan.meals.length - 1 ? "1px solid #e5e7eb" : "none",
                backgroundColor: "white",
              }}
            >
              {/* Meal type badge */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "3pt",
                  paddingBottom: "5pt",
                  borderBottom: "1px solid #f3f4f6",
                  marginBottom: "2pt",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "4pt" }}>
                  <span style={{ fontSize: "11pt" }}>{mealIdEmoji[meal.id] ?? mealTypeEmoji[meal.type] ?? "🍽️"}</span>
                  <span
                    style={{
                      fontSize: "6.5pt",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "#6b7280",
                    }}
                  >
                    {mealDisplayName[meal.id] ?? meal.name}
                  </span>
                </div>
                {meal.kcal > 0 && (
                  <span
                    style={{
                      fontSize: "7pt",
                      fontWeight: 700,
                      color: color.text,
                      backgroundColor: color.bg,
                      border: `1px solid ${color.border}`,
                      padding: "1pt 5pt",
                      borderRadius: "20pt",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {meal.kcal} kcal
                  </span>
                )}
              </div>

              {/* Meal description */}
              <p
                style={{
                  fontSize: "8pt",
                  color: "#1f2937",
                  lineHeight: 1.45,
                  margin: 0,
                  flex: 1,
                }}
              >
                {meal.description}
              </p>

              {/* Tip */}
              {meal.note && (
                <div
                  style={{
                    marginTop: "4pt",
                    paddingTop: "4pt",
                    borderTop: "1px solid #f3f4f6",
                    fontSize: "7pt",
                    color: "#92400e",
                    backgroundColor: "#fffbeb",
                    padding: "4pt 5pt",
                    borderRadius: "4pt",
                    lineHeight: 1.4,
                  }}
                >
                  💡 {meal.note}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Print shopping list ─────────────────────────────────────────────────────
function PrintShoppingList({ shoppingList }: { shoppingList: { category: string; items: string[] }[] }) {
  const categoryEmoji: Record<string, string> = {
    "Proteínas": "🥩",
    "Cereales e hidratos": "🌾",
    "Frutas y verduras": "🥦",
    "Lácteos y alternativas": "🥛",
    "Despensa": "🫙",
  }

  return (
    <div
      style={{
        breakBefore: "page",
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: "0",
      }}
    >
      {/* Shopping list header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8pt",
          marginBottom: "12pt",
          paddingBottom: "8pt",
          borderBottom: "2px solid #064e3b",
        }}
      >
        <span style={{ fontSize: "18pt" }}>🛒</span>
        <div>
          <h2 style={{ margin: 0, fontSize: "14pt", fontWeight: 700, color: "#064e3b" }}>
            Lista de la compra
          </h2>
          <p style={{ margin: 0, fontSize: "8pt", color: "#6b7280" }}>
            Ingredientes para toda la semana
          </p>
        </div>
      </div>

      {/* Categories grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "10pt",
        }}
      >
        {shoppingList.map((category) => (
          <div
            key={category.category}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: "8pt",
              overflow: "hidden",
              breakInside: "avoid",
            }}
          >
            <div
              style={{
                backgroundColor: "#f0fdf4",
                borderBottom: "1px solid #bbf7d0",
                padding: "5pt 8pt",
                display: "flex",
                alignItems: "center",
                gap: "5pt",
              }}
            >
              <span style={{ fontSize: "11pt" }}>
                {categoryEmoji[category.category] ?? "📦"}
              </span>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: "8.5pt",
                  color: "#14532d",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {category.category}
              </span>
            </div>
            <ul style={{ margin: 0, padding: "6pt 8pt", listStyle: "none" }}>
              {category.items.map((item, i) => (
                <li
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "5pt",
                    padding: "2.5pt 0",
                    borderBottom: i < category.items.length - 1 ? "1px solid #f3f4f6" : "none",
                    fontSize: "8pt",
                    color: "#374151",
                  }}
                >
                  <span
                    style={{
                      width: "7pt",
                      height: "7pt",
                      borderRadius: "50%",
                      border: "1.5px solid #16a34a",
                      display: "inline-block",
                      flexShrink: 0,
                      marginTop: "1pt",
                    }}
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function WeeklyPlanPage() {
  const { isCheatDay } = useCheatDay()
  const [data, setData] = useState<WeeklyPlanResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [stale, setStale] = useState(false)
  const [showRegenModal, setShowRegenModal] = useState(false)
  const [regenApplyFrom, setRegenApplyFrom] = useState<"today" | "tomorrow" | "all">("tomorrow")
  const [regenerating, setRegenerating] = useState(false)
  const [repeating, setRepeating] = useState(false)
  const [regenError, setRegenError] = useState<string | null>(null)
  const [shoppingList, setShoppingList] = useState<{ category: string; items: string[] }[]>([])
  const [swapping, setSwapping] = useState<{ date: string; mealId: string } | null>(null)

  const handleSwapMeal = async (date: string, mealId: string) => {
    setSwapping({ date, mealId })
    try {
      const updatedDay = await swapWeeklyMeal(date, mealId)
      setData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          days: prev.days.map((d) => d.date === date ? updatedDay : d),
        }
      })
    } catch {}
    setSwapping(null)
  }

  useEffect(() => {
    fetchWeeklyPlan()
      .then((d) => {
        setStale(d.stale)
        setData(d)
        if (d.stale) {
          setShowRegenModal(true)
        }
      })
      .catch(() => setData(mockWeeklyPlanResponse))
      .finally(() => setLoading(false))
  }, [])

  const handleRegenerate = async () => {
    setRegenerating(true)
    setRegenError(null)
    try {
      const result = await regenerateWeeklyPlan(regenApplyFrom)
      setData({
        days: result.days,
        summary: result.summary ?? data?.summary ?? null,
        stale: false,
      })
      setStale(false)
      setShowRegenModal(false)
    } catch {
      setRegenError("Error al regenerar el plan. Inténtalo de nuevo.")
    } finally {
      setRegenerating(false)
    }
  }

  const handleRepeatMenu = async () => {
    setRepeating(true)
    setRegenError(null)
    try {
      const result = await repeatWeeklyPlan()
      setData({
        days: result.days,
        summary: result.summary ?? data?.summary ?? null,
        stale: false,
      })
      setStale(false)
      setShowRegenModal(false)
    } catch {
      setRegenError("Error al repetir el menú. Inténtalo de nuevo.")
    } finally {
      setRepeating(false)
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-muted-foreground">Cargando...</div>
        </div>
      </AppLayout>
    )
  }

  const weeklyPlan = data ?? mockWeeklyPlanResponse
  const totalWeekKcal = weeklyPlan.days.reduce((sum, day) => sum + day.totalKcal, 0)
  const dateStr = typeof window !== "undefined" ? new Date().toLocaleDateString("es-ES", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  }) : ""

  return (
    <AppLayout>
      {/* Print page settings */}
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 1.2cm 1.5cm; }
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="space-y-8">

        {/* ── Stale banner ── */}
        {stale && (
          <div className="bg-amber-500/20 border border-amber-400/30 rounded-2xl p-4 flex items-center justify-between mb-4">
            <span className="text-amber-300 text-sm">
              Tu plan es de la semana pasada. Elige si quieres repetirlo o regenerarlo.
            </span>
            <button
              onClick={() => setShowRegenModal(true)}
              className="text-amber-400 text-sm font-semibold hover:underline ml-4"
            >
              Regenerar ahora →
            </button>
          </div>
        )}

        {/* ── Adaptive summary card ── */}
        {data?.summary && (
          <div className="mb-4 rounded-3xl border border-black/10 bg-black/5 p-5 backdrop-blur-xl dark:border-white/10 dark:bg-white/5 md:p-6">
            <p className="text-sm leading-6 text-muted-foreground md:text-base">
              Plan ajustado por:{" "}
              {data.summary.weight_delta !== null && (
                <span className="text-foreground font-medium">
                  {data.summary.weight_delta > 0 ? "+" : ""}{data.summary.weight_delta}kg semana anterior
                </span>
              )}
              {data.summary.total_exercise_kcal > 0 && (
                <span className="text-foreground font-medium ml-2">
                  · {data.summary.total_exercise_kcal.toLocaleString()} kcal ejercicio
                </span>
              )}
              {" · "}
              <span className="text-foreground font-medium">
                {Math.round(data.summary.avg_adherence * 100)}% adherencia
              </span>
            </p>
          </div>
        )}

        {/* ── Screen header ── */}
        <Card className="backdrop-blur-xl bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/20 rounded-3xl p-7 md:p-8 print:hidden">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-7 w-7 text-emerald-400" />
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Plan semanal</h2>
                <p className="mt-1 text-sm text-muted-foreground md:text-base">Tus comidas planificadas para toda la semana con más espacio entre bloques y mejor lectura de cada plato.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                onClick={() => window.print()}
                className="bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 border border-black/20 dark:border-white/20 text-foreground"
              >
                <FileDown className="mr-2 h-4 w-4" />
                Exportar PDF
              </Button>
            </div>
          </div>
        </Card>

        {/* ── Screen accordion view ── */}
        <div className="print:hidden">
          <Card className="backdrop-blur-xl bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/20 rounded-3xl p-5 md:p-7">
            <Accordion type="single" collapsible className="space-y-4">
              {weeklyPlan.days.map((dayPlan) => {
                const isToday      = dayPlan.date === todayISO
                const displayKcal  = dayPlan.exerciseAdj?.adjustedTotal ?? dayPlan.totalKcal
                const dayLog       = loadDayFromStorage(dayPlan.date)
                const cheatDay     = isCheatDay(dayPlan.date)
                const nonCompliant = dayLog?.nonCompliant === true && !cheatDay
                return (
                  <AccordionItem
                    key={dayPlan.date}
                    value={dayPlan.date}
                    className={`rounded-2xl border bg-background px-5 shadow-sm ${
                      isToday       ? "border-emerald-400/50"
                      : cheatDay    ? "border-amber-400/30"
                      : nonCompliant ? "border-red-400/30"
                      : "border-black/10 dark:border-white/10"
                    }`}
                  >
                    <AccordionTrigger className="py-5 hover:no-underline">
                      <div className="flex w-full flex-col gap-4 pr-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="text-xl font-semibold tracking-tight text-foreground">{dayPlan.dayName}</span>
                          {isToday && (
                            <span className="rounded-full bg-emerald-500 px-2.5 py-1 text-xs font-medium text-white">
                              HOY
                            </span>
                          )}
                          {cheatDay && (
                            <span className="flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/20 px-2.5 py-1 text-xs text-amber-300">
                              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                              Comodín
                            </span>
                          )}
                          {nonCompliant && (
                            <span className="rounded-full border border-red-400/30 bg-red-500/20 px-2.5 py-1 text-xs text-red-400">
                              No cumplido +{dayLog!.excessKcal} kcal
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {dayPlan.exerciseAdj && (
                            <span className="text-xs text-yellow-300 md:text-sm">
                              ⚡ +{dayPlan.exerciseAdj.extraKcal}kcal
                            </span>
                          )}
                          {displayKcal > 0 && (
                            <Badge className="border-emerald-400/30 bg-emerald-500/20 px-2.5 py-1 text-sm text-emerald-700 dark:text-emerald-400">
                              {displayKcal} kcal
                            </Badge>
                          )}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-5">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-5">
                        {dayPlan.meals.map((meal) => (
                          <MealCard
                            key={meal.id}
                            meal={meal}
                            onSwap={
                              stale ? undefined : () => handleSwapMeal(dayPlan.date, meal.id)
                            }
                            swapping={swapping?.date === dayPlan.date && swapping?.mealId === meal.id}
                          />
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
          </Card>
        </div>

        {/* ── Screen shopping list ── */}
        {shoppingList.length > 0 && (
          <Card className="backdrop-blur-xl bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/20 rounded-3xl p-7 print:hidden">
            <div className="flex items-center gap-2 mb-6">
              <ShoppingCart className="h-5 w-5 text-emerald-400" />
              <h3 className="text-xl font-semibold text-foreground">Lista de la compra</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
              {shoppingList.map((category) => (
                <div key={category.category} className="space-y-3">
                  <h4 className="text-foreground font-semibold border-b border-black/10 dark:border-white/10 pb-2">
                    {category.category}
                  </h4>
                  <ul className="space-y-2">
                    {category.items.map((item, index) => (
                      <li key={index} className="text-foreground/80 text-sm flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            PRINT-ONLY TEMPLATE
            ══════════════════════════════════════════════════════════════════ */}
        <div className="hidden print:block">

          {/* Print header */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              marginBottom: "14pt",
              paddingBottom: "10pt",
              borderBottom: "3px solid #064e3b",
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
          >
            <div>
              <h1 style={{ margin: 0, fontSize: "18pt", fontWeight: 800, color: "#064e3b" }}>
                🥗 Plan Semanal — METABOLIC
              </h1>
              <p style={{ margin: "3pt 0 0", fontSize: "9pt", color: "#6b7280", textTransform: "capitalize" }}>
                {dateStr}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontSize: "11pt",
                  fontWeight: 700,
                  color: "white",
                  backgroundColor: "#064e3b",
                  padding: "5pt 12pt",
                  borderRadius: "20pt",
                  display: "inline-block",
                }}
              >
                {totalWeekKcal.toLocaleString("es-ES")} kcal / semana
              </div>
              <p style={{ margin: "3pt 0 0", fontSize: "7.5pt", color: "#9ca3af" }}>
                Media: {Math.round(totalWeekKcal / 7).toLocaleString("es-ES")} kcal/día
              </p>
            </div>
          </div>

          {/* Day cards */}
          {weeklyPlan.days.map((dayPlan) => (
            <PrintDayCard key={dayPlan.date} dayPlan={dayPlan} />
          ))}

          {/* Shopping list on new page (only if available) */}
          {shoppingList.length > 0 && (
            <PrintShoppingList shoppingList={shoppingList} />
          )}
        </div>

        {/* ── Regenerar plan completo (acción avanzada) ── */}
        <div className="print:hidden">
          <div className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl p-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-foreground/30 shrink-0 mt-0.5" />
              <div>
                <p className="text-muted-foreground text-sm font-medium">Regenerar todo el menú semanal</p>
                <p className="text-foreground/30 text-xs mt-0.5">Sustituye todos los platos de la semana. Usa "Cambiar plato" para ajustes individuales.</p>
              </div>
            </div>
            <button
              onClick={() => setShowRegenModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-black/15 dark:border-white/15 rounded-xl text-foreground/40 hover:text-foreground/60 text-xs font-medium transition-colors shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Regenerar semana completa
            </button>
          </div>
        </div>

        {/* Regeneration modal */}
        {showRegenModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="backdrop-blur-xl bg-white dark:bg-white/10 border border-black/10 dark:border-white/20 rounded-3xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-foreground font-bold text-lg">
                  {stale ? "Elegir menú para esta semana" : "Regenerar plan semanal"}
                </h3>
                <button onClick={() => setShowRegenModal(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {data?.summary ? (
                <div className="bg-black/5 dark:bg-white/5 rounded-xl p-4 mb-4 text-sm text-foreground/70 space-y-1">
                  <p>Basado en tu semana anterior:</p>
                  <p>· Adherencia: <span className="text-foreground">{Math.round(data.summary.avg_adherence * 100)}%</span></p>
                  <p>· Ejercicio acumulado: <span className="text-foreground">{data.summary.total_exercise_kcal.toLocaleString()} kcal</span></p>
                  {data.summary.weight_delta !== null && (
                    <p>· Peso: <span className="text-foreground">{data.summary.weight_delta > 0 ? "+" : ""}{data.summary.weight_delta} kg</span></p>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm mb-4">No hay historial de la semana anterior disponible.</p>
              )}

              <p className="text-foreground/70 text-sm mb-3">¿Desde cuándo aplicar el nuevo plan?</p>
              <div className="space-y-2 mb-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="applyFrom"
                    value="today"
                    checked={regenApplyFrom === "today"}
                    onChange={() => setRegenApplyFrom("today")}
                    className="accent-emerald-400"
                  />
                  <span className="text-foreground text-sm">Desde hoy (reemplaza el menú de hoy)</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="applyFrom"
                    value="tomorrow"
                    checked={regenApplyFrom === "tomorrow"}
                    onChange={() => setRegenApplyFrom("tomorrow")}
                    className="accent-emerald-400"
                  />
                  <span className="text-foreground text-sm">Desde mañana (mantiene el menú de hoy)</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="applyFrom"
                    value="all"
                    checked={regenApplyFrom === "all"}
                    onChange={() => setRegenApplyFrom("all")}
                    className="accent-emerald-400"
                  />
                  <span className="text-foreground text-sm">Toda la semana (regenera todos los días)</span>
                </label>
              </div>

              {regenError && (
                <p className="text-red-400 text-sm mb-3">{regenError}</p>
              )}

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => setShowRegenModal(false)}
                  className="flex-1 px-4 py-2 border border-black/20 dark:border-white/20 rounded-xl text-foreground/70 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  Cancelar
                </button>
                {stale && (
                  <button
                    onClick={handleRepeatMenu}
                    disabled={repeating || regenerating}
                    className="flex-1 px-4 py-2 border border-amber-400/30 bg-amber-500/20 rounded-xl text-amber-200 text-sm font-medium hover:bg-amber-500/30 disabled:opacity-50 transition-colors"
                  >
                    {repeating ? "Repitiendo menú..." : "Repetir menú"}
                  </button>
                )}
                <button
                  onClick={handleRegenerate}
                  disabled={regenerating || repeating}
                  className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 rounded-xl text-white text-sm font-medium transition-colors"
                >
                  {regenerating ? "Regenerando..." : "Regenerar"}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  )
}
