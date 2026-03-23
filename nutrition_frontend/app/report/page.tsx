"use client"

import { useEffect, useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import {
  FileBarChart,
  Dumbbell,
  Flame,
  CheckCircle,
  Scale,
  Zap,
  Moon,
  Smile,
  Utensils,
  Lightbulb,
  Send,
  Download,
} from "lucide-react"
import type { WeeklyReportData, ArchivedReport } from "@/lib/api"
import { fetchWeeklyReport, submitSensationsSurvey, getReportPdfUrl, getReportsList } from "@/lib/api"

const sensationLabels = {
  energy: ["Muy baja", "Baja", "Moderada", "Alta", "Muy alta"],
  sleep: ["Mala", "Regular", "Normal", "Buena", "Excelente"],
  mood: ["Muy malo", "Malo", "Neutro", "Bueno", "Excelente"],
  hunger: ["Siempre con hambre", "A menudo con hambre", "Equilibrado", "Raramente con hambre", "Sin hambre"],
}

export default function ReportPage() {
  const [data, setData] = useState<WeeklyReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [survey, setSurvey] = useState({
    energy: [3],
    sleep: [3],
    mood: [3],
    hunger: [3],
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [archivedReports, setArchivedReports] = useState<ArchivedReport[]>([])

  useEffect(() => {
    fetchWeeklyReport()
      .then(setData)
      .catch((err) => console.error("Report fetch failed:", err))
      .finally(() => setLoading(false))
    getReportsList().then(setArchivedReports).catch(() => [])
  }, [])

  const handleSubmitSurvey = async () => {
    setSubmitting(true)
    try {
      await submitSensationsSurvey({
        energy: survey.energy[0],
        sleep: survey.sleep[0],
        mood: survey.mood[0],
        hunger: survey.hunger[0],
      })
    } catch {
      // Continue anyway for demo
    }
    setSubmitted(true)
    setSubmitting(false)
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

  if (!data) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-white/60">Error al cargar el informe</div>
        </div>
      </AppLayout>
    )
  }

  const report = data

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <FileBarChart className="h-7 w-7 text-emerald-400" />
              <div>
                <h2 className="text-3xl font-bold text-white">Informe semanal</h2>
                <p className="text-white/60">Resumen de tu rendimiento esta semana</p>
              </div>
            </div>
            <a
              href={getReportPdfUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 rounded-xl text-emerald-300 text-sm font-medium transition-colors"
            >
              <Download className="h-4 w-4" />
              Descargar PDF
            </a>
          </div>
        </Card>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6 transition-all duration-300 hover:bg-white/15">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white/60 text-sm">Días entrenados</p>
                <p className="text-3xl font-bold text-white">{report.daysTrained}</p>
                <p className="text-white/60 text-sm">esta semana</p>
              </div>
              <Dumbbell className="h-8 w-8 text-blue-400" />
            </div>
          </Card>

          <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6 transition-all duration-300 hover:bg-white/15">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white/60 text-sm">Calorías quemadas</p>
                <p className="text-3xl font-bold text-white">{report.totalKcalBurned.toLocaleString()}</p>
                <p className="text-white/60 text-sm">kcal totales</p>
              </div>
              <Flame className="h-8 w-8 text-orange-400" />
            </div>
          </Card>

          <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6 transition-all duration-300 hover:bg-white/15">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white/60 text-sm">Adherencia</p>
                <p className="text-3xl font-bold text-white">{report.adherencePercent}%</p>
                <p className="text-white/60 text-sm">plan de comidas</p>
              </div>
              <CheckCircle className="h-8 w-8 text-emerald-400" />
            </div>
          </Card>

          <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6 transition-all duration-300 hover:bg-white/15">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white/60 text-sm">Cambio de peso</p>
                <p className={`text-3xl font-bold ${(report.weightChange ?? 0) <= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {(report.weightChange ?? 0) > 0 ? "+" : ""}{report.weightChange ?? 0} kg
                </p>
                <p className="text-white/60 text-sm">esta semana</p>
              </div>
              <Scale className="h-8 w-8 text-purple-400" />
            </div>
          </Card>
        </div>

        {/* Sensations Survey */}
        <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6">
          <h3 className="text-xl font-semibold text-white mb-6">Encuesta de sensaciones semanales</h3>
          {submitted || report.sensationsSurvey ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
              <p className="text-white text-lg">¡Gracias por completar la encuesta de esta semana!</p>
              <p className="text-white/60">Tus respuestas nos ayudan a mejorar tus recomendaciones.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                {/* Energy Level */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-400" />
                    <Label className="text-white">Nivel de energía</Label>
                  </div>
                  <Slider
                    value={survey.energy}
                    onValueChange={(v) => setSurvey({ ...survey, energy: v })}
                    min={1}
                    max={5}
                    step={1}
                  />
                  <p className="text-white/60 text-sm text-center">
                    {sensationLabels.energy[survey.energy[0] - 1]}
                  </p>
                </div>

                {/* Sleep Quality */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Moon className="h-5 w-5 text-blue-400" />
                    <Label className="text-white">Calidad del sueño</Label>
                  </div>
                  <Slider
                    value={survey.sleep}
                    onValueChange={(v) => setSurvey({ ...survey, sleep: v })}
                    min={1}
                    max={5}
                    step={1}
                  />
                  <p className="text-white/60 text-sm text-center">
                    {sensationLabels.sleep[survey.sleep[0] - 1]}
                  </p>
                </div>

                {/* Mood */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Smile className="h-5 w-5 text-emerald-400" />
                    <Label className="text-white">Estado de ánimo general</Label>
                  </div>
                  <Slider
                    value={survey.mood}
                    onValueChange={(v) => setSurvey({ ...survey, mood: v })}
                    min={1}
                    max={5}
                    step={1}
                  />
                  <p className="text-white/60 text-sm text-center">
                    {sensationLabels.mood[survey.mood[0] - 1]}
                  </p>
                </div>

                {/* Hunger */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Utensils className="h-5 w-5 text-orange-400" />
                    <Label className="text-white">Nivel de hambre</Label>
                  </div>
                  <Slider
                    value={survey.hunger}
                    onValueChange={(v) => setSurvey({ ...survey, hunger: v })}
                    min={1}
                    max={5}
                    step={1}
                  />
                  <p className="text-white/60 text-sm text-center">
                    {sensationLabels.hunger[survey.hunger[0] - 1]}
                  </p>
                </div>
              </div>

              <Button
                onClick={handleSubmitSurvey}
                disabled={submitting}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                <Send className="mr-2 h-4 w-4" />
                {submitting ? "Enviando..." : "Enviar encuesta"}
              </Button>
            </div>
          )}
        </Card>

        {/* Recommendations */}
        <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <Lightbulb className="h-5 w-5 text-yellow-400" />
            <h3 className="text-xl font-semibold text-white">Recomendaciones personalizadas</h3>
          </div>
          <div className="space-y-3">
            {report.recommendations.map((recommendation, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-4 bg-white/5 rounded-xl border border-white/10"
              >
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm font-medium">
                  {index + 1}
                </span>
                <p className="text-white/80">{recommendation}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Archived Reports */}
        {archivedReports.length > 0 && (
          <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Reportes anteriores</h3>
            <div className="space-y-2">
              {archivedReports.map((report) => (
                <div
                  key={report.filename}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10"
                >
                  <div className="flex items-center gap-3">
                    <FileBarChart className="h-4 w-4 text-white/50" />
                    <span className="text-white/80 text-sm">Semana {report.week}</span>
                  </div>
                  <a
                    href={report.url}
                    download={report.filename}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/10 hover:bg-white/20 text-white/70 hover:text-white rounded-lg border border-white/10 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Descargar
                  </a>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </AppLayout>
  )
}
