"use client"

import { useEffect, useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Flame,
  Dumbbell,
  Bell,
  Scale,
  ClipboardList,
  Calendar,
  TrendingUp,
  Beef,
  Wheat,
  Droplet,
} from "lucide-react"
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts"
import type { DashboardData } from "@/lib/api"
import { fetchDashboard } from "@/lib/api"

// Mock data for development when API is unavailable
const mockDashboardData: DashboardData = {
  dailyCalorieTarget: 2200,
  caloriesConsumed: 1650,
  macros: {
    protein: { current: 95, target: 150 },
    carbs: { current: 180, target: 250 },
    fat: { current: 55, target: 70 },
  },
  exerciseYesterday: {
    type: "Running",
    minutes: 45,
    caloriesBurned: 420,
  },
  alerts: [
    { id: "1", type: "weigh-in", message: "Time for your weekly weigh-in!" },
    { id: "2", type: "survey", message: "Complete your weekly sensations survey" },
    { id: "3", type: "event", message: "Beach vacation in 3 weeks", dueDate: "2024-02-15" },
  ],
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboard()
      .then(setData)
      .catch(() => setData(mockDashboardData))
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

  const dashboard = data || mockDashboardData
  const calorieProgress = Math.round((dashboard.caloriesConsumed / dashboard.dailyCalorieTarget) * 100)

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

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-3xl font-bold text-white">Panel</h2>
              <p className="text-white/60">Sigue tu nutrición y objetivos de fitness</p>
            </div>
            <div className="text-right">
              <p className="text-white/60 text-sm">Hoy</p>
              <p className="text-white font-medium">
                {new Date().toLocaleDateString("es-ES", {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>
        </Card>

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

          {/* Yesterday's Exercise */}
          <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6 transition-all duration-300 hover:bg-white/15">
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
      </div>
    </AppLayout>
  )
}
