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

const todayISO = new Date().toISOString().slice(0, 10)

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
        <div className="flex items-center justify-center h-screen -mt-20">
          <div className="text-emerald-600/60 font-medium">{loading ? "Cargando..." : "Error al cargar el dashboard"}</div>
        </div>
      </AppLayout>
    )
  }

  const dashboard = data
  const calorieProgress = Math.round((dashboard.caloriesConsumed / dashboard.dailyCalorieTarget) * 100)

  const macroData = [
    { name: "Proteínas", value: dashboard.macros.protein.current, color: "#ef4444" },
    { name: "Carbohidratos", value: dashboard.macros.carbs.current, color: "#f59e0b" },
    { name: "Grasas", value: dashboard.macros.fat.current, color: "#3b82f6" },
  ]

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
      default: return "bg-slate-100 text-slate-600 border-slate-200"
    }
  }

  return (
    <AppLayout>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 max-h-full">

        {/* Header - Compact */}
        <Card className="relative overflow-hidden bg-white border-emerald-100 rounded-2xl p-4 shadow-sm md:col-span-2 lg:col-span-3">
          <Activity className="absolute -right-4 -top-4 h-24 w-24 text-emerald-500/5 rotate-12" />
          <div className="flex items-center justify-between gap-2 relative z-10">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 leading-tight">Panel</h2>
              <p className="text-slate-500 text-xs">
                {new Date().toLocaleDateString("es-ES", { weekday: "long", month: "short", day: "numeric" })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {cheatActive ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-100 rounded-lg">
                  <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                  <span className="text-amber-700 text-xs font-semibold">Comodín activo</span>
                </div>
              ) : weeklyUsed ? (
                <div className="px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg opacity-60">
                  <span className="text-slate-400 text-xs">Comodín usado</span>
                </div>
              ) : (
                <button
                  onClick={() => setShowConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg text-amber-700 text-xs font-semibold transition-colors shadow-sm"
                >
                  <Star className="h-3.5 w-3.5" />
                  Activar Comodín
                </button>
              )}
            </div>
          </div>
        </Card>

        {/* Gamification card - Indigo */}
        {gamification && (
          <Card className="relative overflow-hidden bg-white border-indigo-50 rounded-2xl p-4 shadow-sm">
            <Trophy className="absolute -right-3 -bottom-3 h-16 w-16 text-indigo-500/10 -rotate-12" />
            <div className="relative z-10 space-y-3">
              <LevelBadge status={gamification} />
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Entrenos",   value: gamification.breakdown.training,  color: "text-emerald-600", bg: "bg-emerald-50" },
                  { label: "Dieta",      value: gamification.breakdown.diet,      color: "text-amber-600",   bg: "bg-amber-50"   },
                  { label: "Combos",     value: gamification.breakdown.combo,     color: "text-violet-600",  bg: "bg-violet-50"  },
                  { label: "Rachas",     value: gamification.breakdown.streak,    color: "text-rose-600",    bg: "bg-rose-50"     },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} className={`${bg} rounded-lg py-1.5 px-1 text-center`}>
                    <p className={`text-xs font-bold ${color}`}>+{value}</p>
                    <p className="text-slate-400 text-[9px] uppercase tracking-tighter">{label}</p>
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
            <Card className="relative overflow-hidden bg-white border-blue-50 rounded-2xl p-4 shadow-sm">
              <Target className="absolute -right-3 -bottom-3 h-16 w-16 text-blue-500/10" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg bg-blue-50 ${goalColors[gb.goal]}`}>
                      <GoalIcon className="h-4 w-4" />
                    </div>
                    <span className="font-bold text-slate-800 text-sm">{goalLabels[gb.goal]}</span>
                  </div>
                  <span className={`text-[11px] font-bold ${statusColor}`}>{statusText}</span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>Ingesta: {consumed} kcal</span>
                    <span>Meta: {target}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${onTrack ? 'bg-blue-500' : 'bg-rose-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {active > 0 && (
                    <div className="flex items-center justify-between text-[10px] text-orange-600 font-medium">
                      <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> Activas</span>
                      <span>+{active} kcal</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )
        })()}

        {/* Daily Calories - Orange */}
        <Card className="relative overflow-hidden bg-white border-orange-50 rounded-2xl p-4 shadow-sm">
          <Flame className="absolute -right-2 -top-2 h-16 w-16 text-orange-500/10 rotate-12" />
          <div className="relative z-10 flex flex-col justify-between h-full">
            <div>
              <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1">Calorías Hoy</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-800">{dashboard.caloriesConsumed.toLocaleString()}</span>
                <span className="text-slate-400 text-xs">/ {dashboard.dailyCalorieTarget}</span>
              </div>
            </div>
            <div className="mt-3">
              <div className="flex justify-between items-center mb-1">
                 <div className="w-full bg-slate-100 rounded-full h-1.5 flex-1 mr-2">
                    <div
                      className="bg-orange-500 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(calorieProgress, 100)}%` }}
                    />
                  </div>
                  <span className="text-orange-600 font-bold text-xs">{calorieProgress}%</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Macros - Red/Amber/Blue */}
        <Card className="relative overflow-hidden bg-white border-slate-100 rounded-2xl p-4 shadow-sm md:col-span-1">
          <div className="flex items-center gap-3">
            <div className="w-20 h-20 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={macroData} cx="50%" cy="50%" innerRadius={22} outerRadius={35} paddingAngle={2} dataKey="value">
                    {macroData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-1.5">
              {[
                { label: "Pro", cur: dashboard.macros.protein.current, tgt: dashboard.macros.protein.target, color: "bg-red-500", icon: Beef },
                { label: "Car", cur: dashboard.macros.carbs.current, tgt: dashboard.macros.carbs.target, color: "bg-amber-500", icon: Wheat },
                { label: "Fat", cur: dashboard.macros.fat.current, tgt: dashboard.macros.fat.target, color: "bg-blue-500", icon: Droplet },
              ].map((m) => (
                <div key={m.label} className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${m.color}`} />
                    <span className="text-slate-600 font-medium">{m.label}</span>
                  </div>
                  <span className="text-slate-800 font-bold">{m.cur}g</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Activity & Exercise - Emerald */}
        <Card className="relative overflow-hidden bg-white border-emerald-50 rounded-2xl p-4 shadow-sm md:col-span-1">
          <Dumbbell className="absolute -right-3 -top-3 h-16 w-16 text-emerald-500/10" />
          <div className="relative z-10">
            <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-2">Actividad</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center">
                <Footprints className="h-4 w-4 text-blue-500 mx-auto mb-1" />
                <p className="text-xs font-bold text-slate-800">{Math.round(dashboard.steps || 0)}</p>
                <p className="text-[9px] text-slate-400">pasos</p>
              </div>
              <div className="text-center">
                <Heart className="h-4 w-4 text-rose-500 mx-auto mb-1" />
                <p className="text-xs font-bold text-slate-800">{Math.round(dashboard.heartRateAvg || 0)}</p>
                <p className="text-[9px] text-slate-400">bpm</p>
              </div>
              <div className="text-center">
                <TrendingUp className="h-4 w-4 text-emerald-500 mx-auto mb-1" />
                <p className="text-xs font-bold text-slate-800">{dashboard.exerciseYesterday?.minutes || 0}'</p>
                <p className="text-[9px] text-slate-400">ejer.</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Alerts - Amber/Compact */}
        <Card className="relative overflow-hidden bg-white border-slate-100 rounded-2xl p-4 shadow-sm md:col-span-2 lg:col-span-1">
          <Bell className="absolute -right-3 -bottom-3 h-16 w-16 text-slate-500/10" />
          <div className="relative z-10">
            <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-2 flex items-center gap-1">
              <Bell className="h-3 w-3" /> Pendiente
            </p>
            <div className="space-y-2">
              {dashboard.alerts.slice(0, 2).map((alert) => {
                const AlertIcon = getAlertIcon(alert.type)
                return (
                  <div key={alert.id} className={`flex items-center gap-2 p-2 rounded-xl border ${getAlertColor(alert.type)}`}>
                    <AlertIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-[11px] font-medium leading-tight truncate">{alert.message}</span>
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
          <div className="bg-white border border-emerald-100 rounded-3xl p-6 w-full max-w-sm shadow-xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
                <h3 className="text-slate-800 font-bold text-lg">Activar Comodín</h3>
              </div>
              <button onClick={() => setShowConfirm(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-slate-600 text-sm mb-4">
              El límite calórico de hoy se vuelve <span className="text-amber-600 font-bold">flexible</span>.
              Ideal para eventos sociales o días de mayor hambre.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-slate-500 text-sm font-semibold hover:bg-slate-50"
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
