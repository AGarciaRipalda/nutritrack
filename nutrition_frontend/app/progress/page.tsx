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
    try {
      const newEntry = await logWeight(parseFloat(weight))
      setData((prev) =>
        prev
          ? { ...prev, weightHistory: [...prev.weightHistory, newEntry] }
          : prev
      )
    } catch {
      // Mock response
      const mockEntry = {
        date: new Date().toISOString().split("T")[0],
        weight: parseFloat(weight),
      }
      setData((prev) =>
        prev
          ? { ...prev, weightHistory: [...prev.weightHistory, mockEntry] }
          : prev
      )
    }
    setWeight("")
    setLogging(false)
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
        <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-7 w-7 text-emerald-400" />
            <div>
              <h2 className="text-3xl font-bold text-white">Seguimiento</h2>
              <p className="text-white/60">Controla tu peso y adherencia a lo largo del tiempo</p>
            </div>
          </div>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
          <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">Peso actual</p>
                <p className="text-3xl font-bold text-white">{currentWeight} kg</p>
              </div>
              <Scale className="h-8 w-8 text-blue-400" />
            </div>
          </Card>
          <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">Cambio total</p>
                <p className={`text-3xl font-bold ${weightChange <= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {weightChange > 0 ? "+" : ""}{weightChange.toFixed(1)} kg
                </p>
              </div>
              <TrendingUp className={`h-8 w-8 ${weightChange <= 0 ? "text-emerald-400" : "text-red-400"}`} />
            </div>
          </Card>
          <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">Adherencia media</p>
                <p className="text-3xl font-bold text-white">
                  {Math.round(
                    progress.adherenceByWeek.reduce((sum, w) => sum + w.adherence, 0) /
                      progress.adherenceByWeek.length
                  )}%
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-emerald-400" />
            </div>
          </Card>
        </div>

        {/* Weight Registration Form */}
        <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6">
          <h3 className="text-xl font-semibold text-white mb-4">Registrar peso de hoy</h3>
          <div className="flex gap-4 items-end">
            <div className="flex-1 max-w-xs space-y-2">
              <Label className="text-white/80">Peso (kg)</Label>
              <div className="relative">
                <Scale className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <Input
                  type="number"
                  step="0.1"
                  placeholder="79.5"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="pl-10 bg-white/5 border-white/20 text-white placeholder:text-white/40"
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
        <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6">
          <h3 className="text-xl font-semibold text-white mb-6">Progreso de peso</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weightChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.6)" tick={{ fill: "rgba(255,255,255,0.6)" }} />
                <YAxis
                  stroke="rgba(255,255,255,0.6)"
                  tick={{ fill: "rgba(255,255,255,0.6)" }}
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
        <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6">
          <h3 className="text-xl font-semibold text-white mb-6">Adherencia semanal</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={progress.adherenceByWeek}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="week" stroke="rgba(255,255,255,0.6)" tick={{ fill: "rgba(255,255,255,0.6)" }} />
                <YAxis
                  stroke="rgba(255,255,255,0.6)"
                  tick={{ fill: "rgba(255,255,255,0.6)" }}
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
