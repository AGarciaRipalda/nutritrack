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
  Cookie, Moon, FileDown, Lightbulb,
} from "lucide-react"
import type { WeeklyPlan, WeeklyMeal } from "@/lib/api"
import { fetchWeeklyPlan } from "@/lib/api"

const mockWeeklyPlan: WeeklyPlan = {
  days: [
    {
      day: "Lunes",
      meals: {
        breakfast:  { text: "80g de pan thins con 40g de jamón serrano y tomate + café", kcal: 386, note: "4 rebanadas de pan thins. Tomate natural en rodajas." },
        midMorning: { text: "Yogurt proteínas (200g) + 13g de frutos secos", kcal: 175, note: "Frutos secos de la bolsa de Aldi." },
        lunch:      { text: "105g de espaguetis con 120g de carne picada de ternera, tomate frito sin azúcar y orégano", kcal: 645, note: "Sofríe la carne con ajo y añade tomate al final." },
        snack:      { text: "2 tortitas de arroz con 50g de pavo y guacamole", kcal: 175, note: "Crema de cacahuete opcional." },
        dinner:     { text: "2 huevos a la plancha con medio calabacín y tomate frito sin azúcar", kcal: 344, note: "Espolvorea orégano sobre los huevos." },
      },
    },
    {
      day: "Martes",
      meals: {
        breakfast:  { text: "60g de cereales crunchy Mercadona con leche semidesnatada", kcal: 325, note: "Corn flakes, espelta o crunchy Mercadona." },
        midMorning: { text: "1 fruta de temporada + 3-4 nueces", kcal: 175, note: "Manzana, pera o naranja." },
        lunch:      { text: "107g de arroz basmati con 140g de pechuga de pollo y brócoli al vapor", kcal: 570, note: "Aliña el brócoli con limón y ajo." },
        snack:      { text: "Medio kefir con sandía + 13g de frutos secos", kcal: 175, note: "Puedes cambiar kefir por yogurt proteínas." },
        dinner:     { text: "170g de merluza al horno con verduras al gusto", kcal: 375, note: "Con limón, perejil y un hilo de aceite." },
      },
    },
    {
      day: "Miércoles",
      meals: {
        breakfast:  { text: "80g de pan centeno con 30g de jamón serrano y tomate + café", kcal: 362, note: "Pan recomendado: Thins, Rustik, centeno." },
        midMorning: { text: "Batido de proteínas con agua o leche vegetal", kcal: 175, note: "Aporta ~25g de proteína." },
        lunch:      { text: "200g de ñoquis con 180g de gambas, cebollino y salsa de soja", kcal: 460, note: "Salta los ñoquis hasta que doren." },
        snack:      { text: "Bowl: 40g de harina de avena + 1 huevo + leche + oncita de chocolate (45s micro)", kcal: 175, note: "45 segundos al microondas." },
        dinner:     { text: "Ensalada de canónigos con 2 latas de atún, queso fresco y tomate", kcal: 360, note: "Aliñar con aceite de oliva y vinagre." },
      },
    },
    {
      day: "Jueves",
      meals: {
        breakfast:  { text: "Tortita de avena: 30g de avena + 2 huevos + leche + 1 cdta cacahuete + onza chocolate negro", kcal: 410, note: "Sartén antiadherente sin aceite." },
        midMorning: { text: "50g de caña de lomo de pavo + 13g de frutos secos", kcal: 175, note: "Opción fácil de llevar al trabajo." },
        lunch:      { text: "Papas aliñás: 250g de patata cocida con 2 latas de atún, 1 huevo, cebolla y perejil", kcal: 488, note: "Sirve templado. La patata aliñada gana sabor al reposar." },
        snack:      { text: "Yogurt proteínas con 1 cda crema de cacahuete en polvo + fresas", kcal: 175, note: "Endulza con stevia si lo necesitas." },
        dinner:     { text: "Fajita de pan thins con 130g de pollo, cebolla, pimiento y salsa de yogurt", kcal: 449, note: "Salsa yogurt: yogurt griego + ajo + limón." },
      },
    },
    {
      day: "Viernes",
      meals: {
        breakfast:  { text: "80g de pan thins con 1 lata de atún y 4 rodajas de tomate + café", kcal: 366, note: "Aliña el atún con limón." },
        midMorning: { text: "70g de pechuga de pavo/pollo + 13g de frutos secos", kcal: 175, note: "Frutos secos de Aldi." },
        lunch:      { text: "160g de salmón a la plancha con 107g de arroz basmati y brócoli", kcal: 700, note: "Sin aceite extra — el salmón ya tiene grasa." },
        snack:      { text: "1 lata de piña al natural + 4 nueces", kcal: 175, note: "Piña sin almíbar." },
        dinner:     { text: "2 hamburguesas de ternera (180g) con calabacín a la plancha", kcal: 390, note: "Sin pan. Calabacín con ajo y sal." },
      },
    },
    {
      day: "Sábado",
      meals: {
        breakfast:  { text: "60g de cereales crunchy con leche semidesnatada", kcal: 325, note: "Cereales crunchy Mercadona." },
        midMorning: { text: "Bizcocho en taza: 30g de avena + levadura + 1 huevo + 2 onzas chocolate (4 min micro)", kcal: 175, note: "4 minutos al microondas." },
        lunch:      { text: "Lentejas: 200g de lentejas cocidas con verduras y 120g de pollo troceado", kcal: 432, note: "Sofrito base: cebolla, pimiento, zanahoria." },
        snack:      { text: "2 tajas de sandía + 13g de frutos secos", kcal: 175, note: "Los frutos secos son muy saciantes." },
        dinner:     { text: "140g de salmón a la plancha con espárragos verdes", kcal: 300, note: "El salmón no necesita aceite extra." },
      },
    },
    {
      day: "Domingo",
      meals: {
        breakfast:  { text: "Tortita de avena: 30g de avena + 2 huevos + leche + 1 cdta cacahuete + onza chocolate negro", kcal: 410, note: "Desayuno especial del domingo." },
        midMorning: { text: "Yogurt proteínas (200g) + 13g de frutos secos", kcal: 175, note: "" },
        lunch:      { text: "Pechuga de pollo (160g) en salsa de curry con 107g de arroz basmati", kcal: 590, note: "Salsa curry: yogurt griego, curry, limón, cebolla." },
        snack:      { text: "Helado casero de yogurt proteínas con crema de cacahuete y chocolate negro", kcal: 175, note: "Congela el yogurt 2-3 horas." },
        dinner:     { text: "Salmorejo cordobés con 1 huevo cocido, 1 lata de atún y picatostes", kcal: 370, note: "Salmorejo casero: tomates, pan, ajo, aceite." },
      },
    },
  ],
  shoppingList: [
    { category: "Proteínas", items: ["Pechuga de pollo (1 kg)", "Filetes de salmón (4)", "Carne picada de ternera (500 g)", "Huevos (2 docenas)", "Gambas (500 g)", "Filetes de merluza (4)", "Latas de atún (12)", "Lonchas de pavo (200 g)"] },
    { category: "Cereales e hidratos", items: ["Pan thins (2 paquetes)", "Pan de centeno", "Harina de avena (500 g)", "Arroz basmati (1 kg)", "Espaguetis (500 g)", "Ñoquis (2 bolsas)", "Cereales crunchy Mercadona", "Crackers"] },
    { category: "Frutas y verduras", items: ["Fruta de temporada variada", "Espinacas (2 bolsas)", "Brócoli (2 cabezas)", "Calabacín (4)", "Tomates (6)", "Zanahorias (1 bolsa)", "Espárragos (1 manojo)", "Pimientos variados"] },
    { category: "Lácteos y alternativas", items: ["Leche semidesnatada (2 L)", "Yogurt proteínas (4 uds)", "Kefir (2 uds)", "Queso fresco 0% (2 uds)"] },
    { category: "Despensa", items: ["Jamón serrano (150 g)", "Caña de lomo (150 g)", "Crema de cacahuete", "Aceite de oliva virgen extra", "Tomate frito sin azúcar (2 botes)", "Frutos secos variados (Aldi)", "Chocolate negro 70%", "Salsa de soja"] },
  ],
}

const mealTypeIcons: Record<string, typeof Coffee> = {
  breakfast: Coffee,
  midMorning: Sun,
  lunch: Utensils,
  snack: Cookie,
  dinner: Moon,
}

const mealTypeLabels: Record<string, string> = {
  breakfast: "Desayuno",
  midMorning: "Media mañana",
  lunch: "Almuerzo",
  snack: "Merienda",
  dinner: "Cena",
}

const mealTypeEmoji: Record<string, string> = {
  breakfast: "☕",
  midMorning: "🌅",
  lunch: "🍽️",
  snack: "🍎",
  dinner: "🌙",
}

const mealTypeColor: Record<string, { bg: string; text: string; border: string }> = {
  breakfast:  { bg: "#fef3c7", text: "#92400e", border: "#fde68a" },
  midMorning: { bg: "#ffe4e6", text: "#9f1239", border: "#fecdd3" },
  lunch:      { bg: "#dcfce7", text: "#14532d", border: "#bbf7d0" },
  snack:      { bg: "#ede9fe", text: "#4c1d95", border: "#ddd6fe" },
  dinner:     { bg: "#e0f2fe", text: "#0c4a6e", border: "#bae6fd" },
}

// ── Screen meal card ────────────────────────────────────────────────────────
function MealCard({ mealType, meal }: { mealType: string; meal: WeeklyMeal }) {
  const MealIcon = mealTypeIcons[mealType] || Utensils
  return (
    <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <MealIcon className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
        <span className="text-white/60 text-xs font-semibold uppercase tracking-wide">
          {mealTypeLabels[mealType]}
        </span>
        {meal.kcal > 0 && (
          <Badge className="ml-auto bg-emerald-500/20 text-emerald-400 border-emerald-400/30 text-xs px-1.5 py-0">
            {meal.kcal} kcal
          </Badge>
        )}
      </div>
      <p className="text-white text-xs leading-snug">{meal.text}</p>
      {meal.note && (
        <div className="flex items-start gap-1 mt-0.5">
          <Lightbulb className="h-3 w-3 text-amber-400 shrink-0 mt-0.5" />
          <span className="text-amber-400/80 text-xs leading-snug">{meal.note}</span>
        </div>
      )}
    </div>
  )
}

// ── Print day card ──────────────────────────────────────────────────────────
function PrintDayCard({ dayPlan }: { dayPlan: WeeklyPlan["days"][0] }) {
  const mealKeys = Object.keys(dayPlan.meals) as Array<keyof typeof dayPlan.meals>
  const totalKcal = Object.values(dayPlan.meals).reduce((sum, m) => sum + m.kcal, 0)

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
          {dayPlan.day}
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
        {mealKeys.map((mealType, idx) => {
          const meal = dayPlan.meals[mealType]
          const color = mealTypeColor[mealType]
          return (
            <div
              key={mealType}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: "4pt",
                padding: "7pt 7pt",
                borderRight: idx < 4 ? "1px solid #e5e7eb" : "none",
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
                  <span style={{ fontSize: "11pt" }}>{mealTypeEmoji[mealType]}</span>
                  <span
                    style={{
                      fontSize: "6.5pt",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "#6b7280",
                    }}
                  >
                    {mealTypeLabels[mealType]}
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
                {meal.text}
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
function PrintShoppingList({ shoppingList }: { shoppingList: WeeklyPlan["shoppingList"] }) {
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
  const [data, setData] = useState<WeeklyPlan | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchWeeklyPlan()
      .then(setData)
      .catch(() => setData(mockWeeklyPlan))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-white/60">Cargando...</div>
        </div>
      </AppLayout>
    )
  }

  const plan = data || mockWeeklyPlan
  const totalWeekKcal = plan.days.reduce(
    (sum, day) => sum + Object.values(day.meals).reduce((s, m) => s + m.kcal, 0),
    0
  )
  const dateStr = new Date().toLocaleDateString("es-ES", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  })

  return (
    <AppLayout>
      {/* Print page settings */}
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 1.2cm 1.5cm; }
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="space-y-6">

        {/* ── Screen header ── */}
        <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6 print:hidden">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-7 w-7 text-emerald-400" />
              <div>
                <h2 className="text-3xl font-bold text-white">Plan semanal</h2>
                <p className="text-white/60">Tus comidas planificadas para toda la semana</p>
              </div>
            </div>
            <Button
              onClick={() => window.print()}
              className="bg-white/10 hover:bg-white/20 border border-white/20 text-white"
            >
              <FileDown className="mr-2 h-4 w-4" />
              Exportar PDF
            </Button>
          </div>
        </Card>

        {/* ── Screen accordion view ── */}
        <div className="print:hidden">
          <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6">
            <Accordion type="single" collapsible className="space-y-2">
              {plan.days.map((dayPlan) => {
                const totalKcal = Object.values(dayPlan.meals).reduce((sum, m) => sum + m.kcal, 0)
                return (
                  <AccordionItem
                    key={dayPlan.day}
                    value={dayPlan.day}
                    className="bg-white/5 rounded-xl border border-white/10 px-4 data-[state=open]:bg-white/10"
                  >
                    <AccordionTrigger className="hover:no-underline py-4">
                      <div className="flex items-center justify-between w-full pr-4">
                        <span className="text-lg font-semibold text-white">{dayPlan.day}</span>
                        {totalKcal > 0 && (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-400/30">
                            {totalKcal} kcal
                          </Badge>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        {(Object.keys(dayPlan.meals) as Array<keyof typeof dayPlan.meals>).map((mealType) => (
                          <MealCard key={mealType} mealType={mealType} meal={dayPlan.meals[mealType]} />
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
        <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6 print:hidden">
          <div className="flex items-center gap-2 mb-6">
            <ShoppingCart className="h-5 w-5 text-emerald-400" />
            <h3 className="text-xl font-semibold text-white">Lista de la compra</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            {plan.shoppingList.map((category) => (
              <div key={category.category} className="space-y-3">
                <h4 className="text-white font-semibold border-b border-white/10 pb-2">
                  {category.category}
                </h4>
                <ul className="space-y-2">
                  {category.items.map((item, index) => (
                    <li key={index} className="text-white/80 text-sm flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>

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
                🥗 Plan Semanal — NutriTrack
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
          {plan.days.map((dayPlan) => (
            <PrintDayCard key={dayPlan.day} dayPlan={dayPlan} />
          ))}

          {/* Shopping list on new page */}
          <PrintShoppingList shoppingList={plan.shoppingList} />
        </div>

      </div>
    </AppLayout>
  )
}
