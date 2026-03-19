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
import {
  Dumbbell,
  Clock,
  Flame,
  History,
  Sparkles,
  Plus,
  CalendarDays,
} from "lucide-react"
import type { TrainingData, ExerciseRoutine } from "@/lib/api"
import { fetchTraining, logExercise, generateRoutine } from "@/lib/api"

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
  routines: [],
}

const mockGymRoutine: ExerciseRoutine[] = [
  { day: "Día 1 - Empuje", exercises: [{ name: "Press de banca", sets: 4, reps: "8-10", rest: "90s" }, { name: "Press militar", sets: 3, reps: "10-12", rest: "60s" }, { name: "Fondos en paralelas", sets: 3, reps: "12-15", rest: "60s" }, { name: "Elevaciones laterales", sets: 3, reps: "12-15", rest: "45s" }] },
  { day: "Día 2 - Tirón", exercises: [{ name: "Peso muerto", sets: 4, reps: "6-8", rest: "120s" }, { name: "Remo con barra", sets: 4, reps: "8-10", rest: "90s" }, { name: "Jalón al pecho", sets: 3, reps: "10-12", rest: "60s" }, { name: "Curl de bíceps", sets: 3, reps: "12-15", rest: "45s" }] },
  { day: "Día 3 - Piernas", exercises: [{ name: "Sentadillas", sets: 4, reps: "8-10", rest: "120s" }, { name: "Prensa de piernas", sets: 3, reps: "10-12", rest: "90s" }, { name: "Peso muerto rumano", sets: 3, reps: "10-12", rest: "60s" }, { name: "Elevaciones de gemelos", sets: 4, reps: "15-20", rest: "45s" }] },
]

const mockCalisthenicsRoutine: ExerciseRoutine[] = [
  { day: "Día 1 - Tren superior", exercises: [{ name: "Flexiones", sets: 4, reps: "15-20", rest: "60s" }, { name: "Dominadas", sets: 4, reps: "8-12", rest: "90s" }, { name: "Fondos", sets: 3, reps: "12-15", rest: "60s" }, { name: "Flexiones en pica", sets: 3, reps: "10-12", rest: "60s" }] },
  { day: "Día 2 - Tren inferior", exercises: [{ name: "Sentadilla a una pierna", sets: 3, reps: "6-8 c/u", rest: "90s" }, { name: "Sentadillas con salto", sets: 4, reps: "15-20", rest: "60s" }, { name: "Zancadas", sets: 3, reps: "12 c/u", rest: "60s" }, { name: "Elevaciones de gemelos", sets: 4, reps: "20-25", rest: "45s" }] },
  { day: "Día 3 - Core", exercises: [{ name: "Plancha", sets: 3, reps: "60s", rest: "45s" }, { name: "Elevaciones de piernas", sets: 4, reps: "15-20", rest: "45s" }, { name: "Giros rusos", sets: 3, reps: "20 c/u", rest: "45s" }, { name: "Mountain climbers", sets: 3, reps: "30s", rest: "30s" }] },
]

export default function TrainingPage() {
  const [data, setData] = useState<TrainingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedType, setSelectedType] = useState("")
  const [minutes, setMinutes] = useState("")
  const [logging, setLogging] = useState(false)
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

  const handleLogExercise = async () => {
    if (!selectedType || !minutes) return
    setLogging(true)
    try {
      const newLog = await logExercise({ type: selectedType, minutes: parseInt(minutes) })
      setData((prev) =>
        prev
          ? { ...prev, history: [newLog, ...prev.history] }
          : prev
      )
    } catch {
      // Mock response
      const mockLog = {
        id: Date.now().toString(),
        date: new Date().toISOString().split("T")[0],
        type: selectedType,
        minutes: parseInt(minutes),
        caloriesBurned: Math.round(parseInt(minutes) * 8),
      }
      setData((prev) =>
        prev
          ? { ...prev, history: [mockLog, ...prev.history] }
          : prev
      )
    }
    setSelectedType("")
    setMinutes("")
    setLogging(false)
  }

  const handleGenerateRoutine = async () => {
    setGenerating(true)
    try {
      const routine = await generateRoutine({ type: routineType, daysPerWeek: daysPerWeek[0] })
      setGeneratedRoutine(routine)
    } catch {
      // Mock response
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
            <TabsTrigger value="routine" className="data-[state=active]:bg-white/20 data-[state=active]:text-white text-white/70">
              Generador de rutinas
            </TabsTrigger>
          </TabsList>

          {/* Log Exercise Tab */}
          <TabsContent value="log">
            <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6">
              <h3 className="text-xl font-semibold text-white mb-6">Registrar ejercicio de ayer</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
                <div className="space-y-2">
                  <Label className="text-white/80">Tipo de ejercicio</Label>
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger className="bg-white/5 border-white/20 text-white">
                      <SelectValue placeholder="Selecciona tipo de ejercicio" />
                    </SelectTrigger>
                    <SelectContent>
                      {training.exerciseTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
          </TabsContent>

          {/* History Tab */}
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {training.history.slice(0, 7).map((log) => (
                    <TableRow key={log.id} className="border-white/10">
                      <TableCell className="text-white/80">
                        {new Date(log.date).toLocaleDateString("es-ES", {
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Routine Generator Tab */}
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

              {/* Generated Routine Display */}
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
                            <TableHead className="text-white/60">Reps</TableHead>
                            <TableHead className="text-white/60">Descanso</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {day.exercises.map((exercise, i) => (
                            <TableRow key={i} className="border-white/10">
                              <TableCell className="text-white font-medium">{exercise.name}</TableCell>
                              <TableCell className="text-white/80">{exercise.sets}</TableCell>
                              <TableCell className="text-white/80">{exercise.reps}</TableCell>
                              <TableCell className="text-white/80">{exercise.rest}</TableCell>
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
