"use client"

import { useEffect, useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Flame, Dumbbell, Bell, Scale, ClipboardList,
  Calendar, TrendingUp, Beef, Wheat, Droplet, Star, X,
  Footprints, Heart, Target, ArrowDown, ArrowUp, Minus,
  Trophy, Activity, Zap
} from "lucide-react"
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts"
import type { DashboardData, GamificationStatus } from "@/lib/api"
import { fetchDashboard, fetchGamification } from "@/lib/api"
import { LevelBadge } from "@/components/level-badge"
import { useCheatDay } from "@/context/CheatDayContext"

const todayISO = typeof window !== "undefined" ? new Date().toISOString().slice(0, 10) : ""

export default function DashboardPage() {
  const [data, setData]         = useState<DashboardData | null>(null)
  const [loading, setLoading]   = useState(true)
  const [showConfirm, setShowConfirm] = useState(false)
  const [gamification, setGamification] = useState<GamificationStatus | null>(null)

  const { record, isCheatDay, isWeeklyLimitReached, activateCheatDay } = useCheatDay()

  const cheatActive  = isCheatDay(todayISO)
  const weeklyUsed   = isWeeklyLimitReached(todayISO) && !cheatActive

  useEffect(() => {
    let isActive = true
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort("dashboard-timeout"), 15000)

    fetchDashboard(controller.signal)
      .then((result) => {
        if (!isActive) return
        setData(result)
      })
      .catch((err) => {
        if (!isActive) return
        const message = err instanceof Error ? err.message : String(err)
        if (message.toLowerCase().includes("aborted")) {
          console.warn("Dashboard fetch timed out after 15s")
          return
        }
        console.error("Dashboard fetch failed:", message)
      })
      .finally(() => {
        clearTimeout(timeout)
        if (isActive) setLoading(false)
      })

    fetchGamification().then(setGamification).catch(() => null)

    return () => {
      isActive = false
      clearTimeout(timeout)
      controller.abort("dashboard-unmount")
    }
  }, [])

  if (loading || !data) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-screen -mt-20">
          <div className="text-emerald-600/60 font-medium">{loading ? "Cargando..." : "Error al cargar el dashboard"}</div>
        </div>
      </AppLayout>
    )
  }

  const dashboard = data
  const calorieProgress = Math.round((dashboard.caloriesConsumed / dashboard.dailyCalorieTarget) * 100)
  const activeCaloriesToday = dashboard.activeCalories ?? dashboard.goalBalance.activeKcal ?? 0
  const activeCaloriesReference = Math.max(dashboard.exerciseYesterday?.caloriesBurned ?? 400, 400)
  const activeCaloriesProgress = Math.min(Math.round((activeCaloriesToday / activeCaloriesReference) * 100), 100)

  const macroSummary = [
    { label: "Pro", name: "Proteínas", current: dashboard.macros.protein.current, target: dashboard.macros.protein.target, color: "bg-red-500", chartColor: "#ef4444" },
    { label: "Car", name: "Carbohidratos", current: dashboard.macros.carbs.current, target: dashboard.macros.carbs.target, color: "bg-amber-500", chartColor: "#f59e0b" },
    { label: "Fat", name: "Grasas", current: dashboard.macros.fat.current, target: dashboard.macros.fat.target, color: "bg-blue-500", chartColor: "#3b82f6" },
  ]

  const macroData = macroSummary.map((macro) => ({
    name: macro.name,
    value: Math.max(macro.current, macro.target, 0),
    color: macro.chartColor,
  }))
  const macroTotalGrams = macroSummary.reduce((sum, macro) => sum + Math.max(macro.current, macro.target, 0), 0)
  const hasMacroCurrentData = macroSummary.some((macro) => macro.current > 0)

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "weigh-in": return Scale
      case "survey": return ClipboardList
      case "event": return Calendar
      default: return Bell
    }
  }

  const getAlertColor = (type: string) => {
    switch (type) {
      case "weigh-in": return "bg-blue-100 text-blue-600 border-blue-200"
      case "survey": return "bg-amber-100 text-amber-600 border-amber-200"
      case "event": return "bg-emerald-100 text-emerald-600 border-emerald-200"
      default: return "bg-slate-100 text-slate-600 dark:text-slate-300 border-slate-200"
    }
  }

  return (
    <AppLayout>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-4 md:gap-5 max-h-full auto-rows-[minmax(220px,auto)]">

        {/* Header - Compact */}
        <Card className="relative overflow-hidden bg-white dark:bg-white/[0.05] border-emerald-100 dark:border-white/[0.08] rounded-3xl p-5 md:p-6 shadow-sm md:col-span-2 xl:col-span-12 min-h-[140px]">
          <Activity className="absolute -right-4 -top-4 h-28 w-28 text-emerald-500/5 rotate-12" />
          <div className="flex items-center justify-between gap-3 relative z-10">
            <div>
              <h2 className="text-3xl md:text-4xl font-black text-slate-800 dark:text-white leading-tight">Panel</h2>
              <p className="text-slate-500 dark:text-slate-300 text-sm md:text-base mt-1">
                {typeof window !== "undefined" ? new Date().toLocaleDateString("es-ES", { weekday: "long", month: "short", day: "numeric" }) : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {cheatActive ? (
                <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-100 rounded-xl">
                  <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                  <span className="text-amber-700 text-sm font-semibold">Comodín activo</span>
                </div>
              ) : weeklyUsed ? (
                <div className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl opacity-60">
                  <span className="text-slate-400 dark:text-slate-400 text-sm">Comodín usado</span>
                </div>
              ) : (
                <button
                  onClick={() => setShowConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl text-amber-700 text-sm font-semibold transition-colors shadow-sm"
                >
                  <Star className="h-4 w-4" />
                  Activar Comodín
                </button>
              )}
            </div>
          </div>
        </Card>

        {/* Gamification card - Indigo */}
        {gamification && (
          <Card className="relative overflow-hidden bg-white dark:bg-white/[0.05] border-indigo-50 dark:border-white/[0.08] rounded-3xl p-5 md:p-6 shadow-sm xl:col-span-4 min-h-[260px]">
            <Trophy className="absolute -right-3 -bottom-3 h-20 w-20 text-indigo-500/10 -rotate-12" />
            <div className="relative z-10 space-y-4 h-full">
              <LevelBadge status={gamification} />
              <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4 gap-2.5">
                {[
                  { label: "Entrenos",   value: gamification.breakdown.training,  color: "text-emerald-600 dark:text-emerald-300", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
                  { label: "Dieta",      value: gamification.breakdown.diet,      color: "text-amber-600 dark:text-amber-300",   bg: "bg-amber-50 dark:bg-amber-500/10"   },
                  { label: "Combos",     value: gamification.breakdown.combo,     color: "text-violet-600 dark:text-violet-300",  bg: "bg-violet-50 dark:bg-violet-500/10"  },
                  { label: "Rachas",     value: gamification.breakdown.streak,    color: "text-rose-600 dark:text-rose-300",    bg: "bg-rose-50 dark:bg-rose-500/10"     },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} className={`${bg} rounded-xl py-2.5 px-2 text-center border border-black/5 dark:border-white/[0.06]`}>
                    <p className={`text-sm font-black ${color}`}>+{value}</p>
                    <p className="text-slate-400 dark:text-slate-400 text-[10px] uppercase tracking-wide">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* Goal Balance Card - Blue */}
        {(() => {
          const gb = dashboard.goalBalance
          const goalLabels: Record<string, string> = { lose: "Perder peso", maintain: "Mantenimiento", gain: "Ganar músculo" }
          const goalColors: Record<string, string> = { lose: "text-blue-600", maintain: "text-emerald-600", gain: "text-amber-600" }
          const GoalIcon = gb.goal === "lose" ? ArrowDown : gb.goal === "gain" ? ArrowUp : Minus

          const consumed = gb.consumedKcal
          const target = dashboard.dailyCalorieTarget
          const active = gb.activeKcal
          const diff = consumed - target

          let onTrack = false
          let statusText = ""
          let statusColor = ""

          if (gb.goal === "lose") {
            onTrack = diff <= 0
            statusText = onTrack ? `${Math.abs(diff)} kcal debajo` : `${diff} kcal encima`
            statusColor = onTrack ? "text-emerald-600" : "text-rose-600"
          } else if (gb.goal === "gain") {
            onTrack = diff >= 0
            statusText = onTrack ? `+${diff} kcal superávit` : `${Math.abs(diff)} kcal debajo`
            statusColor = onTrack ? "text-emerald-600" : "text-amber-600"
          } else {
            onTrack = Math.abs(diff) <= 150
            statusText = onTrack ? "En rango" : `${diff > 0 ? "+" : ""}${diff} kcal`
            statusColor = onTrack ? "text-emerald-600" : "text-amber-600"
          }

          const pct = target > 0 ? Math.min(Math.round((consumed / target) * 100), 100) : 0

          return (
            <Card className="relative overflow-hidden bg-white dark:bg-white/[0.05] border-blue-50 dark:border-white/[0.08] rounded-3xl p-5 md:p-6 shadow-sm xl:col-span-5 min-h-[260px]">
              <Target className="absolute -right-3 -bottom-3 h-20 w-20 text-blue-500/10" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4 gap-3">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 ${goalColors[gb.goal]}`}>
                      <GoalIcon className="h-5 w-5" />
                    </div>
                    <span className="font-bold text-slate-800 dark:text-white text-base md:text-lg">{goalLabels[gb.goal]}</span>
                  </div>
                  <span className={`text-xs md:text-sm font-bold ${statusColor}`}>{statusText}</span>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-xs md:text-sm text-slate-500 dark:text-slate-300">
                    <span>Ingesta: {consumed} kcal</span>
                    <span>Meta: {target}</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-white/[0.08] rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all duration-500 ${onTrack ? 'bg-blue-500' : 'bg-rose-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {active > 0 && (
                    <div className="flex items-center justify-between text-xs md:text-sm text-orange-600 font-medium">
                      <span className="flex items-center gap-1.5"><Zap className="h-4 w-4" /> Activas</span>
                      <span>+{active} kcal</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )
        })()}

        {/* Active Calories - Orange */}
        <Card className="relative overflow-hidden bg-white dark:bg-white/[0.05] border-orange-50 dark:border-white/[0.08] rounded-3xl p-5 md:p-6 shadow-sm xl:col-span-3 min-h-[260px]">
          <Flame className="absolute -right-2 -top-2 h-20 w-20 text-orange-500/10 rotate-12" />
          <div className="relative z-10 flex flex-col justify-between h-full">
            <div>
              <p className="text-slate-500 dark:text-slate-300 text-xs uppercase font-bold tracking-wider mb-2">Gasto Activo Hoy</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl md:text-4xl font-black text-slate-800 dark:text-white">{Math.round(activeCaloriesToday).toLocaleString()}</span>
                <span className="text-slate-400 dark:text-slate-400 text-sm">kcal</span>
              </div>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                {dashboard.exerciseYesterday
                  ? `Referencia ayer: ${dashboard.exerciseYesterday.caloriesBurned} kcal`
                  : "Calorías activas de movimiento y ejercicio"}
              </p>
            </div>
            <div className="mt-3">
              <div className="flex justify-between items-center mb-2">
                 <div className="w-full bg-slate-100 dark:bg-white/[0.08] rounded-full h-2.5 flex-1 mr-3">
                    <div
                      className="bg-orange-500 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${activeCaloriesProgress}%` }}
                    />
                  </div>
                  <span className="text-orange-600 dark:text-orange-300 font-bold text-sm">{activeCaloriesProgress}%</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Macros - Red/Amber/Blue */}
        <Card className="relative overflow-hidden bg-white dark:bg-white/[0.05] border-slate-100 dark:border-white/[0.08] rounded-3xl p-5 md:p-6 shadow-sm md:col-span-1 xl:col-span-5 min-h-[280px]">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-slate-500 dark:text-slate-300 text-xs uppercase font-bold tracking-wider">Macros</p>
              <p className="text-3xl md:text-4xl font-black text-slate-800 dark:text-white">{macroTotalGrams}g</p>
            </div>
            <span className="text-xs font-medium text-slate-400 dark:text-slate-400 text-right">
              {hasMacroCurrentData ? "Consumido hoy" : "Objetivo diario"}
            </span>
          </div>
          <div className="flex items-center gap-5">
            <div className="w-28 h-28 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={macroData} cx="50%" cy="50%" innerRadius={32} outerRadius={50} paddingAngle={2} dataKey="value">
                    {macroData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-3">
              {macroSummary.map((m) => (
                <div key={m.label} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${m.color}`} />
                    <span className="text-slate-600 dark:text-slate-300 font-semibold">{m.name}</span>
                  </div>
                  <span className="text-slate-800 dark:text-white font-bold text-base">{m.current > 0 ? `${m.current}g` : `${m.target}g`}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Activity & Exercise - Emerald */}
        <Card className="relative overflow-hidden bg-white dark:bg-white/[0.05] border-emerald-50 dark:border-white/[0.08] rounded-3xl p-5 md:p-6 shadow-sm md:col-span-1 xl:col-span-3 min-h-[280px]">
          <Dumbbell className="absolute -right-3 -top-3 h-20 w-20 text-emerald-500/10" />
          <div className="relative z-10">
            <p className="text-slate-500 dark:text-slate-300 text-xs uppercase font-bold tracking-wider mb-4">Actividad</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3 gap-3">
              <div className="text-center rounded-2xl bg-slate-50/80 dark:bg-white/[0.04] p-4">
                <Footprints className="h-5 w-5 text-blue-500 mx-auto mb-2" />
                <p className="text-lg font-black text-slate-800 dark:text-white">{Math.round(dashboard.steps || 0)}</p>
                <p className="text-xs text-slate-400 dark:text-slate-400">pasos</p>
              </div>
              <div className="text-center rounded-2xl bg-slate-50/80 dark:bg-white/[0.04] p-4">
                <Heart className="h-5 w-5 text-rose-500 mx-auto mb-2" />
                <p className="text-lg font-black text-slate-800 dark:text-white">{Math.round(dashboard.heartRateAvg || 0)}</p>
                <p className="text-xs text-slate-400 dark:text-slate-400">bpm</p>
              </div>
              <div className="text-center rounded-2xl bg-slate-50/80 dark:bg-white/[0.04] p-4">
                <TrendingUp className="h-5 w-5 text-emerald-500 mx-auto mb-2" />
                <p className="text-lg font-black text-slate-800 dark:text-white">{dashboard.exerciseYesterday?.minutes || 0}'</p>
                <p className="text-xs text-slate-400 dark:text-slate-400">ejercicio</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Alerts - Amber/Compact */}
        <Card className="relative overflow-hidden bg-white dark:bg-white/[0.05] border-slate-100 dark:border-white/[0.08] rounded-3xl p-5 md:p-6 shadow-sm md:col-span-2 xl:col-span-4 min-h-[280px]">
          <Bell className="absolute -right-3 -bottom-3 h-20 w-20 text-slate-500 dark:text-slate-300/10" />
          <div className="relative z-10">
            <p className="text-slate-500 dark:text-slate-300 text-xs uppercase font-bold tracking-wider mb-4 flex items-center gap-2">
              <Bell className="h-4 w-4" /> Pendiente
            </p>
            <div className="space-y-3">
              {dashboard.alerts.slice(0, 2).map((alert) => {
                const AlertIcon = getAlertIcon(alert.type)
                return (
                  <div key={alert.id} className={`flex items-center gap-3 p-3 rounded-2xl border ${getAlertColor(alert.type)}`}>
                    <AlertIcon className="h-4 w-4 shrink-0" />
                    <span className="text-sm font-medium leading-snug">{alert.message}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>

      </div>

      {/* Comodín Confirmation Modal - Updated for light theme */}
      {showConfirm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-white/10 border border-emerald-100 dark:border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
                <h3 className="text-slate-800 dark:text-white font-bold text-lg">Activar Comodín</h3>
              </div>
              <button onClick={() => setShowConfirm(false)} className="text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-slate-600 dark:text-slate-300 text-sm mb-4">
              El límite calórico de hoy se vuelve <span className="text-amber-600 font-bold">flexible</span>.
              Ideal para eventos sociales o días de mayor hambre.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-slate-500 dark:text-slate-300 text-sm font-semibold hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => { activateCheatDay(todayISO); setShowConfirm(false) }}
                className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 rounded-xl text-white text-sm font-bold shadow-md shadow-amber-200"
              >
                Activar
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
