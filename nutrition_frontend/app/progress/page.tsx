"use client"

import { useEffect, useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TrendingUp, Scale, Plus, CheckCircle } from "lucide-react"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import type { ProgressData } from "@/lib/api"
import { fetchProgress, logWeight } from "@/lib/api"

const mockProgressData: ProgressData = {
  weightHistory: [
    { date: "2024-01-01", weight: 82 },
    { date: "2024-01-08", weight: 81.5 },
    { date: "2024-01-15", weight: 81.2 },
    { date: "2024-01-22", weight: 80.8 },
    { date: "2024-01-29", weight: 80.5 },
    { date: "2024-02-05", weight: 80.1 },
    { date: "2024-02-12", weight: 79.8 },
  ],
  trendLine: [
    { date: "2024-01-01", weight: 82 },
    { date: "2024-01-08", weight: 81.6 },
    { date: "2024-01-15", weight: 81.2 },
    { date: "2024-01-22", weight: 80.8 },
    { date: "2024-01-29", weight: 80.4 },
    { date: "2024-02-05", weight: 80.0 },
    { date: "2024-02-12", weight: 79.6 },
  ],
  adherenceByWeek: [
    { week: "Semana 1", adherence: 85 },
    { week: "Semana 2", adherence: 92 },
    { week: "Semana 3", adherence: 78 },
    { week: "Semana 4", adherence: 88 },
    { week: "Semana 5", adherence: 95 },
    { week: "Semana 6", adherence: 90 },
  ],

  currentWeight: 81.5,
  needsWeighIn: false,
  expectedWeekly: -0.5,
  analysis: "Tu progreso va según lo previsto.",
}

export default function ProgressPage() {
  const [data, setData] = useState<ProgressData | null>(null)
  const [loading, setLoading] = useState(true)
  const [weight, setWeight] = useState("")
  const [logging, setLogging] = useState(false)

  useEffect(() => {
    fetchProgress()
      .then(setData)
      .catch(() => setData(mockProgressData))
      .finally(() => setLoading(false))
  }, [])

  const handleLogWeight = async () => {
    if (!weight) return
    setLogging(true)
    const newEntry = {
      date: new Date().toISOString().split("T")[0],
      weight: parseFloat(weight),
    }
    try {
      await logWeight(parseFloat(weight))
    } catch {
      // continue — add entry locally even if API fails
    }
    setData((prev) =>
      prev
        ? { ...prev, weightHistory: [...prev.weightHistory, newEntry] }
        : { ...mockProgressData, weightHistory: [newEntry] }
    )
    setWeight("")
    setLogging(false)
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

  const progress = data || mockProgressData

  // Combine weight history and trend line for chart
  const weightChartData = progress.weightHistory.map((entry, index) => ({
    date: new Date(entry.date).toLocaleDateString("es-ES", { month: "short", day: "numeric" }),
    weight: entry.weight,
    trend: progress.trendLine[index]?.weight || entry.weight,
  }))

  const currentWeight = progress.weightHistory[progress.weightHistory.length - 1]?.weight || 0
  const startWeight = progress.weightHistory[0]?.weight || 0
  const weightChange = currentWeight - startWeight

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <Card className="backdrop-blur-xl bg-black/5 dark:bg-white/10 border border-black/20 dark:border-white/20 rounded-3xl p-6">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-7 w-7 text-emerald-400" />
            <div>
              <h2 className="text-3xl font-bold text-foreground">Seguimiento</h2>
              <p className="text-muted-foreground">Controla tu peso y adherencia a lo largo del tiempo</p>
            </div>
          </div>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
          <Card className="backdrop-blur-xl bg-black/5 dark:bg-white/10 border border-black/20 dark:border-white/20 rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Peso actual</p>
                <p className="text-3xl font-bold text-foreground">{currentWeight} kg</p>
              </div>
              <Scale className="h-8 w-8 text-blue-400" />
            </div>
          </Card>
          <Card className="backdrop-blur-xl bg-black/5 dark:bg-white/10 border border-black/20 dark:border-white/20 rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Cambio total</p>
                <p className={`text-3xl font-bold ${weightChange <= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {weightChange > 0 ? "+" : ""}{weightChange.toFixed(1)} kg
                </p>
              </div>
              <TrendingUp className={`h-8 w-8 ${weightChange <= 0 ? "text-emerald-400" : "text-red-400"}`} />
            </div>
          </Card>
          <Card className="backdrop-blur-xl bg-black/5 dark:bg-white/10 border border-black/20 dark:border-white/20 rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Adherencia media</p>
                <p className="text-3xl font-bold text-foreground">
                  {progress.adherenceByWeek.length > 0
                    ? Math.round(progress.adherenceByWeek.reduce((sum, w) => sum + w.adherence, 0) / progress.adherenceByWeek.length)
                    : 0}%
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-emerald-400" />
            </div>
          </Card>
        </div>

        {/* Weight Registration Form */}
        <Card className="backdrop-blur-xl bg-black/5 dark:bg-white/10 border border-black/20 dark:border-white/20 rounded-3xl p-6">
          <h3 className="text-xl font-semibold text-foreground mb-4">Registrar peso de hoy</h3>
          <div className="flex gap-4 items-end">
            <div className="flex-1 max-w-xs space-y-2">
              <Label className="text-foreground/80">Peso (kg)</Label>
              <div className="relative">
                <Scale className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
                <Input
                  type="number"
                  step="0.1"
                  placeholder="79.5"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="pl-10 bg-black/5 dark:bg-white/5 border-black/20 dark:border-white/20 text-foreground placeholder:text-foreground/40"
                />
              </div>
            </div>
            <Button
              onClick={handleLogWeight}
              disabled={!weight || logging}
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              <Plus className="mr-2 h-4 w-4" />
              {logging ? "Registrando..." : "Registrar peso"}
            </Button>
          </div>
        </Card>

        {/* Weight Chart */}
        <Card className="backdrop-blur-xl bg-black/5 dark:bg-white/10 border border-black/20 dark:border-white/20 rounded-3xl p-6">
          <h3 className="text-xl font-semibold text-foreground mb-6">Progreso de peso</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weightChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.2)" />
                <XAxis dataKey="date" stroke="rgba(128,128,128,0.6)" tick={{ fill: "rgba(128,128,128,0.8)" }} />
                <YAxis
                  stroke="rgba(128,128,128,0.6)"
                  tick={{ fill: "rgba(128,128,128,0.8)" }}
                  domain={["dataMin - 1", "dataMax + 1"]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(0,0,0,0.8)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "white" }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="weight"
                  name="Peso real"
                  stroke="#60a5fa"
                  strokeWidth={2}
                  dot={{ fill: "#60a5fa", strokeWidth: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="trend"
                  name="Línea de tendencia"
                  stroke="#34d399"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Adherence Chart */}
        <Card className="backdrop-blur-xl bg-black/5 dark:bg-white/10 border border-black/20 dark:border-white/20 rounded-3xl p-6">
          <h3 className="text-xl font-semibold text-foreground mb-6">Adherencia semanal</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={progress.adherenceByWeek}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.2)" />
                <XAxis dataKey="week" stroke="rgba(128,128,128,0.6)" tick={{ fill: "rgba(128,128,128,0.8)" }} />
                <YAxis
                  stroke="rgba(128,128,128,0.6)"
                  tick={{ fill: "rgba(128,128,128,0.8)" }}
                  domain={[0, 100]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(0,0,0,0.8)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "white" }}
                  formatter={(value: number) => [`${value}%`, "Adherencia"]}
                />
                <Bar dataKey="adherence" fill="#34d399" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </AppLayout>
  )
}
