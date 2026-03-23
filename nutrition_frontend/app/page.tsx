"use client"

import { useEffect, useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Flame, Dumbbell, Bell, Scale, ClipboardList,
  Calendar, TrendingUp, Beef, Wheat, Droplet, Star, X,
  Footprints, Heart, Target, ArrowDown, ArrowUp, Minus,
  Lightbulb,
} from "lucide-react"
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts"
import type { DashboardData, GamificationStatus } from "@/lib/api"
import { fetchDashboard, fetchGamification } from "@/lib/api"
import { LevelBadge } from "@/components/level-badge"
import { useCheatDay } from "@/context/CheatDayContext"

const todayISO = new Date().toISOString().slice(0, 10)

type TipVariant = "steps" | "protein" | "good"

interface CoachTip {
  variant: TipVariant
  message: string
  Icon: React.ElementType
}

function deriveCoachTip(
  steps: number | null,
  proteinCurrent: number,
  proteinTarget: number
): CoachTip {
  if (steps !== null && steps < 5000) {
    return {
      variant: "steps",
      message: "Hoy toca moverse un poco más para mantener el déficit",
      Icon: Footprints,
    }
  }
  if (proteinTarget > 0 && proteinCurrent / proteinTarget < 0.5) {
    return {
      variant: "protein",
      message: "Añade una fuente de proteína en tu próxima comida para proteger tu masa muscular",
      Icon: Beef,
    }
  }
  return {
    variant: "good",
    message: "Ritmo perfecto. La clave de estas 8 semanas es la consistencia",
    Icon: TrendingUp,
  }
}

export default function DashboardPage() {
  const [data, setData]         = useState<DashboardData | null>(null)
  const [loading, setLoading]   = useState(true)
  const [showConfirm, setShowConfirm] = useState(false)
  const [gamification, setGamification] = useState<GamificationStatus | null>(null)

  const { record, isCheatDay, isWeeklyLimitReached, activateCheatDay } = useCheatDay()

  const cheatActive  = isCheatDay(todayISO)
  const weeklyUsed   = isWeeklyLimitReached(todayISO) && !cheatActive

  useEffect(() => {
    fetchDashboard()
      .then(setData)
      .catch((err) => console.error("Dashboard fetch failed:", err))
      .finally(() => setLoading(false))
    fetchGamification().then(setGamification).catch(() => null)
  }, [])

  if (loading || !data) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-white/60">{loading ? "Cargando..." : "Error al cargar el dashboard"}</div>
        </div>
      </AppLayout>
    )
  }

  const dashboard = data
  const calorieProgress = Math.round((dashboard.caloriesConsumed / dashboard.dailyCalorieTarget) * 100)

  const coachTip = deriveCoachTip(
    dashboard.steps,
    dashboard.macros.protein.current,
    dashboard.macros.protein.target
  )

  const macroData = [
    { name: "Proteínas", value: dashboard.macros.protein.current, color: "#f87171" },
    { name: "Carbohidratos", value: dashboard.macros.carbs.current, color: "#fbbf24" },
    { name: "Grasas", value: dashboard.macros.fat.current, color: "#60a5fa" },
  ]

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "weigh-in":
        return Scale
      case "survey":
        return ClipboardList
      case "event":
        return Calendar
      default:
        return Bell
    }
  }

  const getAlertColor = (type: string) => {
    switch (type) {
      case "weigh-in":
        return "bg-blue-500/20 text-blue-400 border-blue-400/30"
      case "survey":
        return "bg-amber-500/20 text-amber-400 border-amber-400/30"
      case "event":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-400/30"
      default:
        return "bg-white/20 text-white border-white/30"
    }
  }

  const TipIcon = coachTip.Icon

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-3xl font-bold text-white">Panel</h2>
              <p className="text-white/60">Sigue tu nutrición y objetivos de fitness</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Comodín button */}
              {cheatActive ? (
                <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 border border-amber-400/30 rounded-xl">
                  <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                  <span className="text-amber-300 text-sm font-medium">Comodín activo hoy</span>
                </div>
              ) : weeklyUsed ? (
                <div
                  title="Tu metabolismo necesita estabilidad. ¡Reserva tu próximo comodín para la semana que viene!"
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl cursor-not-allowed opacity-60"
                >
                  <Star className="h-4 w-4 text-white/40" />
                  <span className="text-white/40 text-sm">Comodín usado</span>
                </div>
              ) : (
                <button
                  onClick={() => setShowConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-400/20 hover:border-amber-400/40 rounded-xl text-amber-300 text-sm font-medium transition-colors"
                >
                  <Star className="h-4 w-4" />
                  Activar Comodín
                </button>
              )}
              <div className="text-right">
                <p className="text-white/60 text-sm">Hoy</p>
                <p className="text-white font-medium">
                  {new Date().toLocaleDateString("es-ES", { weekday: "long", month: "short", day: "numeric" })}
                </p>
              </div>
            </div>
          </div>

          {/* Weekly limit tooltip shown inline when hovered */}
          {weeklyUsed && (
            <p className="mt-3 text-white/40 text-xs">
              ⚠ Tu metabolismo necesita estabilidad. ¡Reserva tu próximo comodín para la semana que viene!
            </p>
          )}
        </Card>

        {/* Comodín confirmation modal */}
        {showConfirm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6 w-full max-w-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
                  <h3 className="text-white font-bold text-lg">Activar Comodín</h3>
                </div>
                <button onClick={() => setShowConfirm(false)} className="text-white/50 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-white/70 text-sm mb-2">
                El límite calórico de hoy se vuelve <span className="text-amber-300 font-medium">flexible</span>.
                Los avisos en rojo desaparecen.
              </p>
              <p className="text-white/50 text-xs mb-5">
                Al final del día podrás repartir el exceso en los próximos 3 días para mantener tu meta semanal intacta.
                Solo puedes usar un comodín por semana.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 px-4 py-2 border border-white/20 rounded-xl text-white/60 text-sm hover:bg-white/5"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => { activateCheatDay(todayISO); setShowConfirm(false) }}
                  className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 rounded-xl text-white text-sm font-medium"
                >
                  Activar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Gamification card */}
        {gamification && (
          <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-5">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-48">
                <LevelBadge status={gamification} />
              </div>
              <div className="flex gap-3 text-center flex-wrap justify-end">
                {[
                  { label: "Entrenos",   value: gamification.breakdown.training,  color: "text-emerald-300" },
                  { label: "Dieta",      value: gamification.breakdown.diet,      color: "text-amber-300"   },
                  { label: "Combos",     value: gamification.breakdown.combo,     color: "text-violet-300"  },
                  { label: "Rachas",     value: gamification.breakdown.streak,    color: "text-red-300"     },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-white/5 rounded-xl px-3 py-2 min-w-16">
                    <p className={`text-sm font-bold ${color}`}>+{value}</p>
                    <p className="text-white/40 text-[10px]">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* Goal Balance Card */}
        {(() => {
          const gb = dashboard.goalBalance
          const goalLabels: Record<string, string> = {
            lose: "Perder peso", maintain: "Mantener peso", gain: "Ganar músculo",
          }
          const goalColors: Record<string, string> = {
            lose: "text-blue-400", maintain: "text-emerald-400", gain: "text-amber-400",
          }
          const GoalIcon = gb.goal === "lose" ? ArrowDown : gb.goal === "gain" ? ArrowUp : Minus

          // For "lose": target is a deficit → consumed should be LESS than (active + base metabolism)
          // We compare consumed vs daily target: if consumed < target → on track for deficit
          // For "gain": consumed should be MORE than maintenance → consumed > target means surplus achieved
          const consumed = gb.consumedKcal
          const target = dashboard.dailyCalorieTarget
          const active = gb.activeKcal
          const diff = consumed - target  // negative = under target, positive = over target

          let onTrack = false
          let statusText = ""
          let statusColor = ""

          if (gb.goal === "lose") {
            onTrack = diff <= 0
            statusText = onTrack
              ? `${Math.abs(diff)} kcal por debajo del objetivo`
              : `${diff} kcal por encima del objetivo`
            statusColor = onTrack ? "text-emerald-400" : "text-red-400"
          } else if (gb.goal === "gain") {
            onTrack = diff >= 0
            statusText = onTrack
              ? `+${diff} kcal por encima del objetivo`
              : `${Math.abs(diff)} kcal por debajo del objetivo`
            statusColor = onTrack ? "text-emerald-400" : "text-amber-400"
          } else {
            onTrack = Math.abs(diff) <= 150
            statusText = onTrack
              ? "Dentro del rango de mantenimiento"
              : `${diff > 0 ? "+" : ""}${diff} kcal vs objetivo`
            statusColor = onTrack ? "text-emerald-400" : "text-amber-400"
          }

          const targetAdj = Math.abs(gb.targetAdjustment)
          const adjLabel = gb.goal === "lose"
            ? `Déficit objetivo: ${targetAdj} kcal/día`
            : gb.goal === "gain"
              ? `Superávit objetivo: ${targetAdj} kcal/día`
              : "Sin ajuste calórico"

          // Progress: how much of the day's intake vs target
          const pct = target > 0 ? Math.min(Math.round((consumed / target) * 100), 150) : 0
          const barColor = onTrack
            ? "from-emerald-400 to-emerald-600"
            : "from-red-400 to-red-500"

          return (
            <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl bg-white/10 ${goalColors[gb.goal]}`}>
                    <Target className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{goalLabels[gb.goal]}</h3>
                    <p className="text-white/50 text-sm">{adjLabel}</p>
                  </div>
                </div>
                <GoalIcon className={`h-6 w-6 ${goalColors[gb.goal]}`} />
              </div>

              {/* Balance bars */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/60">Ingesta</span>
                  <span className="text-white font-medium">{consumed.toLocaleString()} kcal</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2.5">
                  <div
                    className={`bg-gradient-to-r ${barColor} h-2.5 rounded-full transition-all duration-500`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/60">Objetivo diario</span>
                  <span className="text-white/60">{target.toLocaleString()} kcal</span>
                </div>

                {active > 0 && (
                  <div className="flex items-center justify-between text-sm pt-1 border-t border-white/10">
                    <span className="text-white/60">Cal. activas hoy</span>
                    <span className="text-orange-400 font-medium">{active.toLocaleString()} kcal</span>
                  </div>
                )}

                {/* Status */}
                <div className={`flex items-center gap-2 pt-2 ${statusColor}`}>
                  <div className={`w-2 h-2 rounded-full ${onTrack ? "bg-emerald-400" : "bg-red-400"}`} />
                  <span className="text-sm font-medium">{statusText}</span>
                </div>
              </div>
            </Card>
          )
        })()}

        {/* Calorie and Macro Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Daily Calories */}
          <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6 transition-all duration-300 hover:bg-white/15">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-white/60 text-sm">Calorías del día</p>
                <p className="text-3xl font-bold text-white">
                  {dashboard.caloriesConsumed.toLocaleString()}
                </p>
                <p className="text-white/60 text-sm">
                  de {dashboard.dailyCalorieTarget.toLocaleString()} kcal
                </p>
              </div>
              <Flame className="h-8 w-8 text-orange-400" />
            </div>
            <div className="space-y-2">
              <div className="w-full bg-white/10 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-orange-400 to-red-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(calorieProgress, 100)}%` }}
                />
              </div>
              <p className="text-right text-sm text-white/60">{calorieProgress}%</p>
            </div>
          </Card>

          {/* Macros Donut Chart */}
          <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6 transition-all duration-300 hover:bg-white/15">
            <p className="text-white/60 text-sm mb-2">Distribución de macros</p>
            <div className="flex items-center gap-4">
              <div className="w-32 h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={macroData}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={55}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {macroData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Beef className="h-4 w-4 text-red-400" />
                  <span className="text-white/80 text-sm">
                    Proteínas: {dashboard.macros.protein.current}g / {dashboard.macros.protein.target}g
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Wheat className="h-4 w-4 text-amber-400" />
                  <span className="text-white/80 text-sm">
                    Carbohidratos: {dashboard.macros.carbs.current}g / {dashboard.macros.carbs.target}g
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Droplet className="h-4 w-4 text-blue-400" />
                  <span className="text-white/80 text-sm">
                    Grasas: {dashboard.macros.fat.current}g / {dashboard.macros.fat.target}g
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Activity & Exercise */}
          <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6 transition-all duration-300 hover:bg-white/15">
            {/* Today's health data from Apple Health */}
            {(dashboard.steps != null || dashboard.activeCalories != null || dashboard.heartRateAvg != null) && (
              <div className="mb-4">
                <p className="text-white/60 text-sm mb-2">Actividad de hoy</p>
                <div className="grid grid-cols-3 gap-2">
                  {dashboard.steps != null && (
                    <div className="flex flex-col items-center bg-white/5 rounded-xl p-3">
                      <Footprints className="h-5 w-5 text-blue-400 mb-1" />
                      <span className="text-white font-bold text-lg">{Math.round(dashboard.steps!).toLocaleString()}</span>
                      <span className="text-white/40 text-xs">pasos</span>
                    </div>
                  )}
                  {dashboard.activeCalories != null && (
                    <div className="flex flex-col items-center bg-white/5 rounded-xl p-3">
                      <Flame className="h-5 w-5 text-orange-400 mb-1" />
                      <span className="text-white font-bold text-lg">{Math.round(dashboard.activeCalories!)}</span>
                      <span className="text-white/40 text-xs">kcal activas</span>
                    </div>
                  )}
                  {dashboard.heartRateAvg != null && (
                    <div className="flex flex-col items-center bg-white/5 rounded-xl p-3">
                      <Heart className="h-5 w-5 text-red-400 mb-1" />
                      <span className="text-white font-bold text-lg">{Math.round(dashboard.heartRateAvg!)}</span>
                      <span className="text-white/40 text-xs">bpm</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Yesterday's exercise */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-white/60 text-sm">Ejercicio de ayer</p>
                {dashboard.exerciseYesterday ? (
                  <>
                    <p className="text-2xl font-bold text-white">
                      {dashboard.exerciseYesterday.type}
                    </p>
                    <p className="text-emerald-400 font-medium">
                      {dashboard.exerciseYesterday.minutes} min
                    </p>
                  </>
                ) : (
                  <p className="text-xl font-medium text-white/60">Sin ejercicio registrado</p>
                )}
              </div>
              <Dumbbell className="h-8 w-8 text-emerald-400" />
            </div>
            {dashboard.exerciseYesterday && (
              <div className="flex items-center gap-2 bg-white/5 rounded-xl p-3">
                <TrendingUp className="h-5 w-5 text-orange-400" />
                <span className="text-white/80">
                  {dashboard.exerciseYesterday.caloriesBurned} kcal quemadas
                </span>
              </div>
            )}

            {/* No data at all */}
            {!dashboard.exerciseYesterday && dashboard.steps == null && dashboard.activeCalories == null && (
              <p className="text-white/30 text-sm">Sincroniza Apple Health para ver tu actividad aquí</p>
            )}
          </Card>
        </div>

        {/* Alerts */}
        <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="h-5 w-5 text-white" />
            <h3 className="text-xl font-semibold text-white">Alertas y recordatorios</h3>
          </div>
          <div className="space-y-3">
            {dashboard.alerts.map((alert) => {
              const AlertIcon = getAlertIcon(alert.type)
              return (
                <div
                  key={alert.id}
                  className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-all duration-300"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${getAlertColor(alert.type)}`}>
                      <AlertIcon className="h-5 w-5" />
                    </div>
                    <span className="text-white">{alert.message}</span>
                  </div>
                  {alert.dueDate && (
                    <Badge className="bg-white/10 text-white/80 border-white/20">
                      {new Date(alert.dueDate).toLocaleDateString()}
                    </Badge>
                  )}
                </div>
              )
            })}
          </div>
        </Card>

        {/* Smart Coach Tips Card */}
        <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6 transition-all duration-300 hover:bg-white/15">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="h-5 w-5 text-yellow-400" />
            <h3 className="text-white font-semibold text-sm tracking-wide uppercase">
              Consejo de tu Coach IA
            </h3>
          </div>
          <div className="flex items-start gap-3">
            <TipIcon className="h-6 w-6 text-white/60 mt-0.5 shrink-0" />
            <p className="text-white/80 text-sm leading-relaxed">{coachTip.message}</p>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
