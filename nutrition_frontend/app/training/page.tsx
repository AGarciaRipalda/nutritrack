"use client"

import { useEffect, useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import {
  Dumbbell,
  Clock,
  Flame,
  History,
  Sparkles,
  Plus,
  CalendarDays,
  Calendar as CalendarIcon,
  AlertCircle,
  CheckCircle2,
  Info,
  TrendingUp,
  Zap,
  Trash2,
  X,
  Sheet,
  HardDrive,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import type { TrainingData, ExerciseRoutine, ExerciseImpact, GymHistoryData } from "@/lib/api"
import { fetchTraining, logExerciseForDate, generateRoutine, deleteExerciseByDate, fetchGymHistory } from "@/lib/api"

const mockTrainingData: TrainingData = {
  exerciseTypes: ["Correr", "Ciclismo", "Natación", "Pesas", "HIIT", "Yoga", "Caminar", "Remo"],
  history: [
    { id: "1", date: "2024-01-14", type: "Correr", minutes: 45, caloriesBurned: 420 },
    { id: "2", date: "2024-01-13", type: "Pesas", minutes: 60, caloriesBurned: 350 },
    { id: "3", date: "2024-01-12", type: "HIIT", minutes: 30, caloriesBurned: 380 },
    { id: "4", date: "2024-01-11", type: "Ciclismo", minutes: 50, caloriesBurned: 400 },
    { id: "5", date: "2024-01-10", type: "Natación", minutes: 40, caloriesBurned: 360 },
    { id: "6", date: "2024-01-09", type: "Yoga", minutes: 45, caloriesBurned: 150 },
    { id: "7", date: "2024-01-08", type: "Correr", minutes: 35, caloriesBurned: 320 },
  ],
  streak: 0,
  totalKcal: 0,
  trainedDays: 0,
  yesterdayExercise: null,
  todayTraining: null,
}

const mockGymRoutine: ExerciseRoutine[] = [
  { day: "Día 1 - Empuje", label: "Empuje", exercises: [{ name: "Press de banca", sets: "4x8-10", muscles: "Pecho, Hombros, Tríceps" }, { name: "Press militar", sets: "3x10-12", muscles: "Hombros, Tríceps" }, { name: "Fondos en paralelas", sets: "3x12-15", muscles: "Pecho, Tríceps" }, { name: "Elevaciones laterales", sets: "3x12-15", muscles: "Hombros" }] },
  { day: "Día 2 - Tirón", label: "Tirón", exercises: [{ name: "Peso muerto", sets: "4x6-8", muscles: "Espalda, Isquios, Glúteos" }, { name: "Remo con barra", sets: "4x8-10", muscles: "Espalda, Bíceps" }, { name: "Jalón al pecho", sets: "3x10-12", muscles: "Espalda, Bíceps" }, { name: "Curl de bíceps", sets: "3x12-15", muscles: "Bíceps" }] },
  { day: "Día 3 - Piernas", label: "Piernas", exercises: [{ name: "Sentadillas", sets: "4x8-10", muscles: "Cuádriceps, Glúteos" }, { name: "Prensa de piernas", sets: "3x10-12", muscles: "Cuádriceps" }, { name: "Peso muerto rumano", sets: "3x10-12", muscles: "Isquios, Glúteos" }, { name: "Elevaciones de gemelos", sets: "4x15-20", muscles: "Gemelos" }] },
]

const mockCalisthenicsRoutine: ExerciseRoutine[] = [
  { day: "Día 1 - Tren superior", label: "Superior", exercises: [{ name: "Flexiones", sets: "4x15-20", muscles: "Pecho, Tríceps" }, { name: "Dominadas", sets: "4x8-12", muscles: "Espalda, Bíceps" }, { name: "Fondos", sets: "3x12-15", muscles: "Tríceps, Pecho" }, { name: "Flexiones en pica", sets: "3x10-12", muscles: "Hombros" }] },
  { day: "Día 2 - Tren inferior", label: "Inferior", exercises: [{ name: "Sentadilla a una pierna", sets: "3x6-8", muscles: "Cuádriceps, Glúteos" }, { name: "Sentadillas con salto", sets: "4x15-20", muscles: "Piernas completo" }, { name: "Zancadas", sets: "3x12", muscles: "Cuádriceps, Glúteos" }, { name: "Elevaciones de gemelos", sets: "4x20-25", muscles: "Gemelos" }] },
  { day: "Día 3 - Core", label: "Core", exercises: [{ name: "Plancha", sets: "3x60s", muscles: "Core completo" }, { name: "Elevaciones de piernas", sets: "4x15-20", muscles: "Abdomen" }, { name: "Giros rusos", sets: "3x20", muscles: "Oblicuos" }, { name: "Mountain climbers", sets: "3x30s", muscles: "Core, Cardio" }] },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function toLocalIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function formatDateEs(iso: string): string {
  const [y, m, day] = iso.split("-").map(Number)
  const d = new Date(y, m - 1, day)
  return d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })
}

function getMondayOfWeek(d: Date): Date {
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1 - day)
  const monday = new Date(d)
  monday.setDate(d.getDate() + diff)
  return monday
}

function getImpactStyle(impact: ExerciseImpact) {
  switch (impact.type) {
    case "today":
      return { bg: "bg-emerald-500/20 border-emerald-500/40", icon: <Zap className="h-4 w-4 text-emerald-400" />, color: "text-emerald-300" }
    case "yesterday":
      return { bg: "bg-blue-500/20 border-blue-500/40", icon: <TrendingUp className="h-4 w-4 text-blue-400" />, color: "text-blue-300" }
    case "this_week":
      return { bg: "bg-amber-500/20 border-amber-500/40", icon: <CheckCircle2 className="h-4 w-4 text-amber-400" />, color: "text-amber-300" }
    case "scheduled":
      return { bg: "bg-purple-500/20 border-purple-500/40", icon: <CalendarIcon className="h-4 w-4 text-purple-400" />, color: "text-purple-300" }
    default:
      return { bg: "bg-white/10 border-white/20", icon: <Info className="h-4 w-4 text-white/60" />, color: "text-white/60" }
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TrainingPage() {
  const [data, setData] = useState<TrainingData | null>(null)
  const [loading, setLoading] = useState(true)

  // Log exercise state
  const [selectedType, setSelectedType] = useState("")
  const [minutes, setMinutes] = useState("")
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [logging, setLogging] = useState(false)
  const [lastImpact, setLastImpact] = useState<ExerciseImpact | null>(null)
  const [savedKcal, setSavedKcal] = useState<number | null>(null)

  // Gym history from Google Sheets / Excel
  const [gymHistory, setGymHistory] = useState<GymHistoryData | null>(null)
  const [gymLoading, setGymLoading] = useState(false)
  const [gymError, setGymError] = useState<string | null>(null)
  const [expandedSession, setExpandedSession] = useState<string | null>(null)

  // Routine state
  const [routineType, setRoutineType] = useState<"gym" | "calisthenics">("gym")
  const [daysPerWeek, setDaysPerWeek] = useState([3])
  const [generatedRoutine, setGeneratedRoutine] = useState<ExerciseRoutine[]>([])
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    fetchTraining()
      .then(setData)
      .catch(() => setData(mockTrainingData))
      .finally(() => setLoading(false))
  }, [])

  const loadGymHistory = () => {
    setGymLoading(true)
    setGymError(null)
    fetchGymHistory(7)
      .then(setGymHistory)
      .catch(() => setGymError("No se pudo cargar el historial de gym. Verifica que el backend está activo y las credenciales configuradas."))
      .finally(() => setGymLoading(false))
  }

  // Si las credenciales acaban de configurarse, recargar automáticamente
  useEffect(() => {
    if (gymHistory?.credentials_configured && gymHistory.sessions.length === 0) {
      loadGymHistory()
    }
  }, [gymHistory?.credentials_configured])

  // ── Computed date info ──────────────────────────────────────────────────────
  const today = new Date()
  const todayIso = toLocalIso(today)
  const selectedIso = toLocalIso(selectedDate)
  const monday = getMondayOfWeek(today)
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)

  const isToday = selectedIso === todayIso
  const isYesterday = selectedIso === toLocalIso(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1))
  const isFuture = selectedDate > today
  const selectedMs = selectedDate.getTime()
  const mondayMs = monday.getTime(); const sundayMs = sunday.getTime()
  const inCurrentWeek = selectedMs >= mondayMs && selectedMs <= sundayMs + 86_400_000

  function getDateLabel() {
    if (isToday) return "Hoy"
    if (isYesterday) return "Ayer"
    return formatDateEs(selectedIso)
  }

  function getPreviewImpact(): string {
    if (isFuture) return "Se registrará como actividad programada"
    if (isToday) return "Afecta el objetivo calórico de hoy"
    if (isYesterday) return "Aplica ajuste de recuperación a hoy"
    if (inCurrentWeek) return "Completa un día de la semana actual"
    return "Semana anterior — no afecta el plan actual"
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleLogExercise = async () => {
    if (!selectedType || !minutes) return
    setLogging(true)
    setLastImpact(null)
    setSavedKcal(null)
    try {
      const result = await logExerciseForDate({
        date:    selectedIso,
        type:    selectedType,
        minutes: parseInt(minutes),
      })
      setLastImpact(result.impact)
      setSavedKcal(result.exercise_data.burned_kcal)

      const newLog = {
        id:            Date.now().toString(),
        date:          selectedIso,
        type:          selectedType.includes("|") ? selectedType.split("|")[1] : selectedType,
        minutes:       parseInt(minutes),
        caloriesBurned: result.exercise_data.burned_kcal || Math.round(parseInt(minutes) * 8),
      }
      setData((prev) => prev ? { ...prev, history: [newLog, ...prev.history] } : prev)
    } catch {
      // Mock fallback
      const burned = Math.round(parseInt(minutes) * 8)
      setSavedKcal(burned)

      // Build a local mock impact
      let impactType: ExerciseImpact["type"] = "past_week"
      let impactMsg = "Actividad registrada en el historial."
      if (isFuture) { impactType = "scheduled"; impactMsg = "Actividad programada registrada." }
      else if (isToday) { impactType = "today"; impactMsg = "Actividad de hoy registrada. Afecta el objetivo calórico del día." }
      else if (isYesterday) { impactType = "yesterday"; impactMsg = "Actividad de ayer registrada. Se aplica ajuste de recuperación a hoy." }
      else if (inCurrentWeek) { impactType = "this_week"; impactMsg = "Actividad dentro de la semana actual." }

      setLastImpact({
        type:            impactType,
        message:         impactMsg,
        in_current_week: inCurrentWeek,
        is_today:        isToday,
        is_yesterday:    isYesterday,
        is_future:       isFuture,
      })

      const newLog = {
        id:            Date.now().toString(),
        date:          selectedIso,
        type:          selectedType.includes("|") ? selectedType.split("|")[1] : selectedType,
        minutes:       parseInt(minutes),
        caloriesBurned: burned,
      }
      setData((prev) => prev ? { ...prev, history: [newLog, ...prev.history] } : prev)
    }
    setSelectedType("")
    setMinutes("")
    setLogging(false)
  }

  // ── Delete exercise ─────────────────────────────────────────────────────────
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleDeleteExercise = async (logId: string, logDate: string) => {
    if (confirmDeleteId !== logId) {
      setConfirmDeleteId(logId)
      return
    }
    setDeleting(true)
    try {
      await deleteExerciseByDate(logDate)
    } catch {
      // Si el backend falla (mock mode) igualmente eliminamos del estado local
    }
    setData((prev) =>
      prev ? { ...prev, history: prev.history.filter((h) => h.id !== logId) } : prev
    )
    setConfirmDeleteId(null)
    setDeleting(false)
  }

  const handleGenerateRoutine = async () => {
    setGenerating(true)
    try {
      const routine = await generateRoutine({ type: routineType, daysPerWeek: daysPerWeek[0] })
      setGeneratedRoutine(routine)
    } catch {
      const mockRoutine = routineType === "gym" ? mockGymRoutine : mockCalisthenicsRoutine
      setGeneratedRoutine(mockRoutine.slice(0, daysPerWeek[0]))
    }
    setGenerating(false)
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

  const training = data || mockTrainingData
  const maxKcal = Math.max(...training.history.map((h) => h.caloriesBurned), 1)

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6">
          <div className="flex items-center gap-3">
            <Dumbbell className="h-7 w-7 text-emerald-400" />
            <div>
              <h2 className="text-3xl font-bold text-white">Entrenamiento</h2>
              <p className="text-white/60">Registra ejercicios, consulta el historial y genera rutinas</p>
            </div>
          </div>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="log" className="space-y-6">
          <TabsList className="bg-white/10 border border-white/20">
            <TabsTrigger value="log" className="data-[state=active]:bg-white/20 data-[state=active]:text-white text-white/70">
              Registrar ejercicio
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-white/20 data-[state=active]:text-white text-white/70">
              Historial 7 días
            </TabsTrigger>
            <TabsTrigger
              value="gym"
              className="data-[state=active]:bg-white/20 data-[state=active]:text-white text-white/70"
              onClick={() => { if (!gymLoading) loadGymHistory() }}
            >
              <Sheet className="mr-1.5 h-3.5 w-3.5" />
              Gym (Sheets)
            </TabsTrigger>
            <TabsTrigger value="routine" className="data-[state=active]:bg-white/20 data-[state=active]:text-white text-white/70">
              Generador de rutinas
            </TabsTrigger>
          </TabsList>

          {/* ── Log Exercise Tab ── */}
          <TabsContent value="log">
            <div className="space-y-4">
              <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6">
                <h3 className="text-xl font-semibold text-white mb-6">Registrar ejercicio</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                  {/* Date picker */}
                  <div className="space-y-2">
                    <Label className="text-white/80">Fecha</Label>
                    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start gap-2 bg-white/5 border-white/20 text-white hover:bg-white/10"
                        >
                          <CalendarIcon className="h-4 w-4 text-white/40" />
                          {getDateLabel()}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-gray-900 border-white/20" align="start">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={(d) => {
                            if (d) { setSelectedDate(d); setLastImpact(null) }
                            setCalendarOpen(false)
                          }}
                          disabled={{ after: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30) }}
                          className="text-white [&_.rdp-day]:text-white [&_.rdp-day_button:hover]:bg-white/20 [&_.rdp-day_button.rdp-day_selected]:bg-emerald-500"
                        />
                      </PopoverContent>
                    </Popover>
                    {/* Preview impact badge */}
                    <p className="text-xs text-white/50">{getPreviewImpact()}</p>
                  </div>

                  {/* Exercise type */}
                  <div className="space-y-2">
                    <Label className="text-white/80">Tipo de ejercicio</Label>
                    <Select value={selectedType} onValueChange={setSelectedType}>
                      <SelectTrigger className="bg-white/5 border-white/20 text-white">
                        <SelectValue placeholder="Selecciona ejercicio" />
                      </SelectTrigger>
                      <SelectContent>
                        {training.exerciseTypes.map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Duration */}
                  <div className="space-y-2">
                    <Label className="text-white/80">Duración (minutos)</Label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                      <Input
                        type="number"
                        placeholder="45"
                        value={minutes}
                        onChange={(e) => setMinutes(e.target.value)}
                        className="pl-10 bg-white/5 border-white/20 text-white placeholder:text-white/40"
                      />
                    </div>
                  </div>

                  {/* Save button */}
                  <div className="flex items-end">
                    <Button
                      onClick={handleLogExercise}
                      disabled={!selectedType || !minutes || logging}
                      className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {logging ? "Guardando..." : "Guardar ejercicio"}
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Impact evaluation card */}
              {lastImpact && (
                <Card className={`backdrop-blur-xl border rounded-3xl p-5 ${getImpactStyle(lastImpact).bg}`}>
                  <div className="flex items-start gap-3">
                    {getImpactStyle(lastImpact).icon}
                    <div className="flex-1">
                      <p className={`font-semibold text-sm mb-1 ${getImpactStyle(lastImpact).color}`}>
                        {lastImpact.type === "today" && "Actividad de hoy registrada"}
                        {lastImpact.type === "yesterday" && "Actividad de ayer registrada"}
                        {lastImpact.type === "this_week" && "Actividad de la semana actual"}
                        {lastImpact.type === "scheduled" && "Actividad programada"}
                        {lastImpact.type === "past_week" && "Semana anterior"}
                      </p>
                      <p className="text-white/80 text-sm">{lastImpact.message}</p>
                      {savedKcal !== null && savedKcal > 0 && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <Flame className="h-3.5 w-3.5 text-orange-400" />
                          <span className="text-orange-400 text-sm font-medium">{savedKcal} kcal registradas</span>
                        </div>
                      )}
                    </div>
                    <CheckCircle2 className="h-5 w-5 text-white/40 shrink-0 mt-0.5" />
                  </div>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* ── History Tab ── */}
          <TabsContent value="history">
            <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6">
              <div className="flex items-center gap-2 mb-6">
                <History className="h-5 w-5 text-emerald-400" />
                <h3 className="text-xl font-semibold text-white">Historial de ejercicio (7 días)</h3>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10">
                    <TableHead className="text-white/60">Fecha</TableHead>
                    <TableHead className="text-white/60">Ejercicio</TableHead>
                    <TableHead className="text-white/60">Duración</TableHead>
                    <TableHead className="text-white/60">Calorías quemadas</TableHead>
                    <TableHead className="text-white/60 w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {training.history.slice(0, 7).map((log) => {
                    const isPendingDelete = confirmDeleteId === log.id
                    return (
                      <TableRow
                        key={log.id}
                        className={`border-white/10 transition-colors ${isPendingDelete ? "bg-red-500/10" : ""}`}
                      >
                        <TableCell className="text-white/80">
                          {new Date(log.date + "T12:00:00").toLocaleDateString("es-ES", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </TableCell>
                        <TableCell className="text-white font-medium">{log.type}</TableCell>
                        <TableCell className="text-white/80">{log.minutes} min</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 bg-white/10 rounded-full h-2 max-w-32">
                              <div
                                className="bg-gradient-to-r from-orange-400 to-red-500 h-2 rounded-full"
                                style={{ width: `${(log.caloriesBurned / maxKcal) * 100}%` }}
                              />
                            </div>
                            <span className="text-orange-400 font-medium">{log.caloriesBurned} kcal</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 justify-end">
                            {isPendingDelete ? (
                              <>
                                <Button
                                  size="sm"
                                  disabled={deleting}
                                  onClick={() => handleDeleteExercise(log.id, log.date)}
                                  className="h-7 px-2 text-xs bg-red-500 hover:bg-red-600 text-white"
                                >
                                  {deleting ? "..." : "Eliminar"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="h-7 w-7 p-0 text-white/40 hover:text-white hover:bg-white/10"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteExercise(log.id, log.date)}
                                className="h-7 w-7 p-0 text-white/30 hover:text-red-400 hover:bg-red-500/10"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* ── Gym Sheets Tab ── */}
          <TabsContent value="gym">
            <div className="space-y-4">
              {/* Source badge + refresh */}
              <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Dumbbell className="h-5 w-5 text-emerald-400" />
                    <h3 className="text-xl font-semibold text-white">Historial de gym (últimos 7 días)</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    {gymHistory && (
                      <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
                        gymHistory.source === "sheets"
                          ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                          : gymHistory.source === "excel"
                          ? "bg-blue-500/15 border-blue-500/30 text-blue-300"
                          : "bg-white/10 border-white/20 text-white/50"
                      }`}>
                        {gymHistory.source === "sheets"
                          ? <><Sheet className="h-3 w-3" /> Google Sheets</>
                          : gymHistory.source === "excel"
                          ? <><HardDrive className="h-3 w-3" /> Excel local</>
                          : "Sin datos"}
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={loadGymHistory}
                      disabled={gymLoading}
                      className="bg-white/5 border-white/20 text-white/80 hover:bg-white/10 text-xs h-8"
                    >
                      {gymLoading ? "Cargando..." : "Actualizar"}
                    </Button>
                  </div>
                </div>

                {!gymHistory?.credentials_configured && gymHistory?.source !== "sheets" && (
                  <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
                    <p className="font-medium mb-1">Google Sheets no configurado</p>
                    <p className="text-amber-300/80 text-xs">
                      Crea un Service Account en Google Cloud, comparte el spreadsheet con su email y
                      guarda el JSON como <code className="bg-white/10 px-1 rounded">nutrition_assistant/google_credentials.json</code>.
                    </p>
                  </div>
                )}
              </Card>

              {/* Error */}
              {gymError && (
                <Card className="backdrop-blur-xl bg-red-500/10 border border-red-500/20 rounded-3xl p-5">
                  <p className="text-red-300 text-sm">{gymError}</p>
                </Card>
              )}

              {/* Loading */}
              {gymLoading && (
                <div className="text-center py-12 text-white/40">Cargando sesiones...</div>
              )}

              {/* No sessions */}
              {!gymLoading && gymHistory && gymHistory.sessions.length === 0 && (
                <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-8 text-center">
                  <p className="text-white/50">No hay sesiones de gym registradas en los últimos 7 días.</p>
                </Card>
              )}

              {/* Sessions */}
              {!gymLoading && gymHistory && gymHistory.sessions.map((session, idx) => {
                const sessionKey = `${session.date}-${idx}`
                const isExpanded = expandedSession === sessionKey
                return (
                  <Card
                    key={sessionKey}
                    className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl overflow-hidden"
                  >
                    {/* Session header */}
                    <button
                      className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors text-left"
                      onClick={() => setExpandedSession(isExpanded ? null : sessionKey)}
                    >
                      <div className="flex items-center gap-3">
                        <CalendarDays className="h-4 w-4 text-emerald-400 shrink-0" />
                        <div>
                          <p className="text-white font-semibold">{session.type}</p>
                          <p className="text-white/50 text-sm">
                            {new Date(session.date + "T12:00:00").toLocaleDateString("es-ES", {
                              weekday: "long", day: "numeric", month: "long",
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <Flame className="h-4 w-4 text-orange-400" />
                          <span className="text-orange-400 font-semibold">{session.kcal} kcal</span>
                        </div>
                        <span className="text-white/40 text-sm">{session.exercises.length} ejercicios</span>
                        {isExpanded
                          ? <ChevronDown className="h-4 w-4 text-white/40" />
                          : <ChevronRight className="h-4 w-4 text-white/40" />
                        }
                      </div>
                    </button>

                    {/* Exercises detail */}
                    {isExpanded && (
                      <div className="border-t border-white/10 px-5 pb-5 pt-4">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-white/10">
                              <TableHead className="text-white/50 text-xs">Ejercicio</TableHead>
                              <TableHead className="text-white/50 text-xs text-right">Serie 1</TableHead>
                              <TableHead className="text-white/50 text-xs text-right">Serie 2</TableHead>
                              <TableHead className="text-white/50 text-xs text-right">Volumen</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {session.exercises.map((ex, i) => (
                              <TableRow key={i} className="border-white/10">
                                <TableCell className="text-white text-sm py-2">
                                  <span className={ex.compound ? "font-medium" : ""}>{ex.name}</span>
                                  {ex.compound && (
                                    <span className="ml-1.5 text-[10px] text-emerald-400/70 border border-emerald-500/20 rounded px-1 py-0.5">C</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-white/70 text-sm text-right py-2">
                                  {ex.reps_s1 > 0 ? `${ex.reps_s1}×${ex.kg_s1}kg` : "—"}
                                </TableCell>
                                <TableCell className="text-white/70 text-sm text-right py-2">
                                  {ex.reps_s2 > 0 ? `${ex.reps_s2}×${ex.kg_s2}kg` : "—"}
                                </TableCell>
                                <TableCell className="text-white/50 text-sm text-right py-2">
                                  {ex.volume > 0 ? `${ex.volume} kg·r` : "—"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          </TabsContent>

          {/* ── Routine Generator Tab ── */}
          <TabsContent value="routine">
            <div className="space-y-6">
              <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6">
                <div className="flex items-center gap-2 mb-6">
                  <Sparkles className="h-5 w-5 text-emerald-400" />
                  <h3 className="text-xl font-semibold text-white">Generar rutina de entrenamiento</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 items-end">
                  <div className="space-y-3">
                    <Label className="text-white/80">Tipo de entrenamiento</Label>
                    <div className="flex gap-2">
                      <Button
                        variant={routineType === "gym" ? "default" : "outline"}
                        onClick={() => setRoutineType("gym")}
                        className={`flex-1 justify-center ${
                          routineType === "gym"
                            ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                            : "bg-white/5 border-white/20 text-white/80 hover:bg-white/10"
                        }`}
                      >
                        <Dumbbell className="mr-2 h-4 w-4 shrink-0" />
                        Gimnasio
                      </Button>
                      <Button
                        variant={routineType === "calisthenics" ? "default" : "outline"}
                        onClick={() => setRoutineType("calisthenics")}
                        className={`flex-1 justify-center ${
                          routineType === "calisthenics"
                            ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                            : "bg-white/5 border-white/20 text-white/80 hover:bg-white/10"
                        }`}
                      >
                        Calistenia
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-white/80">Días por semana: {daysPerWeek[0]}</Label>
                    <Slider
                      value={daysPerWeek}
                      onValueChange={setDaysPerWeek}
                      min={2}
                      max={6}
                      step={1}
                      className="mt-2"
                    />
                  </div>
                  <Button
                    onClick={handleGenerateRoutine}
                    disabled={generating}
                    className="w-full justify-center bg-emerald-500 hover:bg-emerald-600 text-white"
                  >
                    <Sparkles className={`mr-2 h-4 w-4 shrink-0 ${generating ? "animate-spin" : ""}`} />
                    {generating ? "Generando..." : "Generar rutina"}
                  </Button>
                </div>
              </Card>

              {generatedRoutine.length > 0 && (
                <div className="grid grid-cols-1 gap-4">
                  {generatedRoutine.map((day, index) => (
                    <Card
                      key={index}
                      className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6"
                    >
                      <div className="flex items-center gap-2 mb-4">
                        <CalendarDays className="h-5 w-5 text-emerald-400" />
                        <h4 className="text-lg font-semibold text-white">{day.day}</h4>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow className="border-white/10">
                            <TableHead className="text-white/60">Ejercicio</TableHead>
                            <TableHead className="text-white/60">Series</TableHead>
                            <TableHead className="text-white/60">Músculos</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {day.exercises.map((exercise, i) => (
                            <TableRow key={i} className="border-white/10">
                              <TableCell className="text-white font-medium">{exercise.name}</TableCell>
                              <TableCell className="text-white/80">{exercise.sets}</TableCell>
                              <TableCell className="text-white/60 text-sm">{exercise.muscles}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  )
}
