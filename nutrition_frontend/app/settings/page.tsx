"use client"

import { useEffect, useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Settings,
  User,
  UtensilsCrossed,
  Calendar,
  Save,
  Plus,
  X,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Download,
  ChevronDown,
} from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import type { SettingsData, UserProfile, FoodPreferences, UpcomingEvent, MicronutrientGoals } from "@/lib/api"
import { fetchSettings, updateProfile, updateFoodPreferences, saveEvent, deleteEvent, getExportUrl, getMicronutrientGoals, updateMicronutrientGoals } from "@/lib/api"

const mockSettingsData: SettingsData = {
  profile: {
    name: "John Doe",
    gender: "male",
    age: 32,
    height: 178,
    weight: 80,
    activityLevel: 3,
    goal: "lose",
    weekStartDay: 0,
  },
  foodPreferences: {
    excluded: ["shellfish", "peanuts"],
    favorites: ["chicken", "salmon", "broccoli", "eggs"],
    disliked: ["mushrooms", "olives"],
  },
  events: [],
}

export default function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle")
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [preferences, setPreferences] = useState<FoodPreferences | null>(null)
  const [newTag, setNewTag] = useState({ excluded: "", favorites: "", disliked: "" })
  const [newEvent, setNewEvent] = useState({ name: "", date: "" })
  const [microGoals, setMicroGoals] = useState<MicronutrientGoals | null>(null)
  const [microOpen, setMicroOpen] = useState(false)
  const [savingMicro, setSavingMicro] = useState(false)
  const [exportFrom, setExportFrom] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d.toISOString().slice(0, 10)
  })
  const [exportTo, setExportTo] = useState(new Date().toISOString().slice(0, 10))
  const [exportFormat, setExportFormat] = useState<"csv" | "xlsx">("csv")

  useEffect(() => {
    fetchSettings()
      .then((d) => {
        setData(d)
        setProfile(d.profile)
        setPreferences(d.foodPreferences)
      })
      .catch((err) => {
        console.error("[Settings] fetchSettings failed:", err)
        // Fallback only if backend is completely unreachable
        setData(mockSettingsData)
        setProfile(mockSettingsData.profile)
        setPreferences(mockSettingsData.foodPreferences)
      })
      .finally(() => setLoading(false))
    getMicronutrientGoals().then(setMicroGoals).catch(() => null)
  }, [])

  const handleSaveMicroGoals = async () => {
    if (!microGoals) return
    setSavingMicro(true)
    try {
      await updateMicronutrientGoals(microGoals)
      showStatus(true)
    } catch {
      showStatus(false)
    } finally {
      setSavingMicro(false)
    }
  }

  const showStatus = (ok: boolean) => {
    setSaveStatus(ok ? "saved" : "error")
    setTimeout(() => setSaveStatus("idle"), 3000)
  }

  const handleSaveProfile = async () => {
    if (!profile) return
    setSaving(true)
    try {
      const saved = await updateProfile(profile)
      setProfile(saved)
      showStatus(true)
    } catch {
      showStatus(false)
    } finally {
      setSaving(false)
    }
  }

  const handleSavePreferences = async () => {
    if (!preferences) return
    setSaving(true)
    try {
      const saved = await updateFoodPreferences(preferences)
      setPreferences(saved)
      showStatus(true)
    } catch {
      showStatus(false)
    } finally {
      setSaving(false)
    }
  }

  const handleAddTag = (type: keyof FoodPreferences) => {
    if (!preferences || !newTag[type].trim()) return
    setPreferences({
      ...preferences,
      [type]: [...preferences[type], newTag[type].trim()],
    })
    setNewTag({ ...newTag, [type]: "" })
  }

  const handleRemoveTag = (type: keyof FoodPreferences, tag: string) => {
    if (!preferences) return
    setPreferences({
      ...preferences,
      [type]: preferences[type].filter((t) => t !== tag),
    })
  }

  const handleAddEvent = async () => {
    if (!data || !newEvent.name || !newEvent.date) return
    const optimistic: UpcomingEvent = {
      id: newEvent.date,
      name: newEvent.name,
      date: newEvent.date,
      daysToEvent: null,
    }
    setData({ ...data, events: [...data.events, optimistic] })
    setNewEvent({ name: "", date: "" })
    try {
      await saveEvent({ name: newEvent.name, date: newEvent.date })
    } catch {
      // optimistic update stays
    }
  }

  const handleDeleteEvent = async (_eventId: string) => {
    if (!data) return
    setData({ ...data, events: [] })
    try {
      await deleteEvent()
    } catch {
      // Continue for demo
    }
  }

  if (loading || !profile || !preferences || !data) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-white/60">Cargando...</div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6">
          <div className="flex items-center gap-3">
            <Settings className="h-7 w-7 text-emerald-400" />
            <div>
              <h2 className="text-3xl font-bold text-white">Configuración</h2>
              <p className="text-white/60">Gestiona tu perfil, preferencias y eventos</p>
            </div>
          </div>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="bg-white/10 border border-white/20">
            <TabsTrigger value="profile" className="data-[state=active]:bg-white/20 data-[state=active]:text-white text-white/70">
              <User className="mr-2 h-4 w-4" />
              Perfil
            </TabsTrigger>
            <TabsTrigger value="preferences" className="data-[state=active]:bg-white/20 data-[state=active]:text-white text-white/70">
              <UtensilsCrossed className="mr-2 h-4 w-4" />
              Preferencias alimentarias
            </TabsTrigger>
            <TabsTrigger value="events" className="data-[state=active]:bg-white/20 data-[state=active]:text-white text-white/70">
              <Calendar className="mr-2 h-4 w-4" />
              Eventos
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6">
              <h3 className="text-xl font-semibold text-white mb-6">Información personal</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-2">
                  <Label className="text-white/80">Nombre</Label>
                  <Input
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    className="bg-white/5 border-white/20 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/80">Género</Label>
                  <Select value={profile.gender} onValueChange={(v) => setProfile({ ...profile, gender: v as UserProfile["gender"] })}>
                    <SelectTrigger className="bg-white/5 border-white/20 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Hombre</SelectItem>
                      <SelectItem value="female">Mujer</SelectItem>
                      <SelectItem value="other">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-white/80">Edad</Label>
                  <Input
                    type="number"
                    value={profile.age}
                    onChange={(e) => setProfile({ ...profile, age: parseInt(e.target.value) || 0 })}
                    className="bg-white/5 border-white/20 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/80">Altura (cm)</Label>
                  <Input
                    type="number"
                    value={profile.height}
                    onChange={(e) => setProfile({ ...profile, height: parseInt(e.target.value) || 0 })}
                    className="bg-white/5 border-white/20 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/80">Peso (kg)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={profile.weight}
                    onChange={(e) => setProfile({ ...profile, weight: parseFloat(e.target.value) || 0 })}
                    className="bg-white/5 border-white/20 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/80">Nivel de actividad</Label>
                  <Select value={String(profile.activityLevel)} onValueChange={(v) => setProfile({ ...profile, activityLevel: parseInt(v) })}>
                    <SelectTrigger className="bg-white/5 border-white/20 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Sedentario</SelectItem>
                      <SelectItem value="2">Ligeramente activo</SelectItem>
                      <SelectItem value="3">Moderadamente activo</SelectItem>
                      <SelectItem value="4">Muy activo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-white/80">Objetivo</Label>
                  <Select value={profile.goal} onValueChange={(v) => setProfile({ ...profile, goal: v as UserProfile["goal"] })}>
                    <SelectTrigger className="bg-white/5 border-white/20 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lose">Perder peso</SelectItem>
                      <SelectItem value="maintain">Mantener peso</SelectItem>
                      <SelectItem value="gain">Ganar músculo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-white/80">Inicio de semana dietética</Label>
                  <Select
                    value={String(profile.weekStartDay)}
                    onValueChange={(v) => setProfile({ ...profile, weekStartDay: parseInt(v) })}
                  >
                    <SelectTrigger className="bg-white/5 border-white/20 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Lunes</SelectItem>
                      <SelectItem value="1">Martes</SelectItem>
                      <SelectItem value="2">Miércoles</SelectItem>
                      <SelectItem value="3">Jueves</SelectItem>
                      <SelectItem value="4">Viernes</SelectItem>
                      <SelectItem value="5">Sábado</SelectItem>
                      <SelectItem value="6">Domingo</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-white/40 text-xs">El menú semanal se renovará cada semana a partir de este día.</p>
                </div>
              </div>
              <div className="mt-6 flex items-center gap-4">
                <Button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Guardando..." : "Guardar perfil"}
                </Button>
                {saveStatus === "saved" && (
                  <span className="flex items-center gap-1.5 text-emerald-400 text-sm font-medium">
                    <CheckCircle2 className="h-4 w-4" />
                    Perfil guardado
                  </span>
                )}
                {saveStatus === "error" && (
                  <span className="flex items-center gap-1.5 text-red-400 text-sm font-medium">
                    <AlertCircle className="h-4 w-4" />
                    Error al guardar
                  </span>
                )}
              </div>
            </Card>
          </TabsContent>

          {/* Preferences Tab */}
          <TabsContent value="preferences">
            <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6">
              <h3 className="text-xl font-semibold text-white mb-6">Preferencias alimentarias</h3>
              <div className="space-y-6">
                {/* Excluded Foods */}
                <div className="space-y-3">
                  <Label className="text-white/80">Ingredientes excluidos (alergias/restricciones)</Label>
                  <div className="flex flex-wrap gap-2">
                    {preferences.excluded.map((tag) => (
                      <Badge
                        key={tag}
                        className="bg-red-500/20 text-red-400 border-red-400/30 pr-1"
                      >
                        {tag}
                        <button
                          onClick={() => handleRemoveTag("excluded", tag)}
                          className="ml-1 hover:text-red-300"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Añadir alimento a excluir..."
                      value={newTag.excluded}
                      onChange={(e) => setNewTag({ ...newTag, excluded: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && handleAddTag("excluded")}
                      className="bg-white/5 border-white/20 text-white placeholder:text-white/40 max-w-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleAddTag("excluded")}
                      className="bg-white/5 border-white/20 text-white hover:bg-white/10"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Favorite Foods */}
                <div className="space-y-3">
                  <Label className="text-white/80">Favoritos</Label>
                  <div className="flex flex-wrap gap-2">
                    {preferences.favorites.map((tag) => (
                      <Badge
                        key={tag}
                        className="bg-emerald-500/20 text-emerald-400 border-emerald-400/30 pr-1"
                      >
                        {tag}
                        <button
                          onClick={() => handleRemoveTag("favorites", tag)}
                          className="ml-1 hover:text-emerald-300"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Añadir alimento favorito..."
                      value={newTag.favorites}
                      onChange={(e) => setNewTag({ ...newTag, favorites: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && handleAddTag("favorites")}
                      className="bg-white/5 border-white/20 text-white placeholder:text-white/40 max-w-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleAddTag("favorites")}
                      className="bg-white/5 border-white/20 text-white hover:bg-white/10"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Disliked Foods */}
                <div className="space-y-3">
                  <Label className="text-white/80">No me gusta</Label>
                  <div className="flex flex-wrap gap-2">
                    {preferences.disliked.map((tag) => (
                      <Badge
                        key={tag}
                        className="bg-amber-500/20 text-amber-400 border-amber-400/30 pr-1"
                      >
                        {tag}
                        <button
                          onClick={() => handleRemoveTag("disliked", tag)}
                          className="ml-1 hover:text-amber-300"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Añadir alimento que no te gusta..."
                      value={newTag.disliked}
                      onChange={(e) => setNewTag({ ...newTag, disliked: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && handleAddTag("disliked")}
                      className="bg-white/5 border-white/20 text-white placeholder:text-white/40 max-w-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleAddTag("disliked")}
                      className="bg-white/5 border-white/20 text-white hover:bg-white/10"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex items-center gap-4">
                <Button
                  onClick={handleSavePreferences}
                  disabled={saving}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Guardando..." : "Guardar preferencias"}
                </Button>
                {saveStatus === "saved" && (
                  <span className="flex items-center gap-1.5 text-emerald-400 text-sm font-medium">
                    <CheckCircle2 className="h-4 w-4" />
                    Preferencias guardadas
                  </span>
                )}
                {saveStatus === "error" && (
                  <span className="flex items-center gap-1.5 text-red-400 text-sm font-medium">
                    <AlertCircle className="h-4 w-4" />
                    Error al guardar
                  </span>
                )}
              </div>
            </Card>
          </TabsContent>

          {/* Events Tab */}
          <TabsContent value="events">
            <div className="space-y-6">
              {/* Add Event Form */}
              <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6">
                <h3 className="text-xl font-semibold text-white mb-6">Registrar próximo evento</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-white/80">Nombre del evento</Label>
                    <Input
                      placeholder="Ej.: Vacaciones en la playa"
                      value={newEvent.name}
                      onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })}
                      className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white/80">Fecha</Label>
                    <Input
                      type="date"
                      value={newEvent.date}
                      onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                      className="bg-white/5 border-white/20 text-white"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleAddEvent}
                  disabled={!newEvent.name || !newEvent.date}
                  className="mt-4 bg-emerald-500 hover:bg-emerald-600 text-white"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Añadir evento
                </Button>
              </Card>

              {/* Events List */}
              <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6">
                <h3 className="text-xl font-semibold text-white mb-6">Tus eventos</h3>
                {data.events.length === 0 ? (
                  <p className="text-white/60 text-center py-8">No hay próximos eventos registrados</p>
                ) : (
                  <div className="space-y-3">
                    {data.events.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-emerald-500/20 rounded-lg">
                            <Calendar className="h-5 w-5 text-emerald-400" />
                          </div>
                          <div>
                            <p className="text-white font-medium">{event.name}</p>
                            <p className="text-white/60 text-sm">
                              {new Date(event.date).toLocaleDateString("es-ES", {
                                weekday: "long",
                                month: "long",
                                day: "numeric",
                                year: "numeric",
                              })}
                              {event.daysToEvent !== null && ` · faltan ${event.daysToEvent} días`}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteEvent(event.id)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Export section */}
        <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Download className="h-5 w-5 text-white/70" />
            <h3 className="text-lg font-semibold text-white">Exportar mis datos</h3>
          </div>
          <p className="text-white/50 text-sm mb-4">
            Descarga todos tus datos en CSV o Excel para análisis externo.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="space-y-1">
              <Label className="text-white/70 text-xs">Desde</Label>
              <Input
                type="date"
                value={exportFrom}
                onChange={(e) => setExportFrom(e.target.value)}
                className="bg-white/5 border-white/20 text-white"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-white/70 text-xs">Hasta</Label>
              <Input
                type="date"
                value={exportTo}
                onChange={(e) => setExportTo(e.target.value)}
                className="bg-white/5 border-white/20 text-white"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              {(["csv", "xlsx"] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setExportFormat(fmt)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    exportFormat === fmt
                      ? "bg-emerald-500/20 border-emerald-400/30 text-emerald-300"
                      : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10"
                  }`}
                >
                  {fmt.toUpperCase()}
                </button>
              ))}
            </div>
            <a
              href={getExportUrl({ format: exportFormat, from: exportFrom, to: exportTo })}
              download
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <Download className="h-4 w-4" />
              Descargar
            </a>
          </div>
        </Card>
        {microGoals && (
          <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6">
            <Collapsible open={microOpen} onOpenChange={setMicroOpen}>
              <CollapsibleTrigger className="flex items-center justify-between w-full">
                <h3 className="text-lg font-semibold text-white">Objetivos de micronutrientes</h3>
                <ChevronDown className={`h-5 w-5 text-white/50 transition-transform ${microOpen ? "rotate-180" : ""}`} />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4">
                <p className="text-white/50 text-sm mb-4">
                  Valores pre-rellenados con IDR recomendadas. Puedes personalizar cada uno.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {([
                    { key: "fiber_g",         label: "Fibra (g/día)" },
                    { key: "sodium_mg",       label: "Sodio (mg/día)" },
                    { key: "potassium_mg",    label: "Potasio (mg/día)" },
                    { key: "calcium_mg",      label: "Calcio (mg/día)" },
                    { key: "iron_mg",         label: "Hierro (mg/día)" },
                    { key: "magnesium_mg",    label: "Magnesio (mg/día)" },
                    { key: "zinc_mg",         label: "Zinc (mg/día)" },
                    { key: "vitamin_c_mg",    label: "Vitamina C (mg/día)" },
                    { key: "vitamin_d_mcg",   label: "Vitamina D (mcg/día)" },
                    { key: "vitamin_a_mcg",   label: "Vitamina A (mcg/día)" },
                    { key: "vitamin_b12_mcg", label: "Vitamina B12 (mcg/día)" },
                  ] as { key: keyof MicronutrientGoals; label: string }[]).map(({ key, label }) => (
                    <div key={key} className="space-y-1">
                      <Label className="text-white/60 text-xs">{label}</Label>
                      <Input
                        type="number"
                        min={0}
                        value={microGoals[key] ?? ""}
                        onChange={(e) => setMicroGoals(prev =>
                          prev ? { ...prev, [key]: e.target.value ? Number(e.target.value) : null } : prev
                        )}
                        className="bg-white/5 border-white/20 text-white text-sm h-8"
                      />
                    </div>
                  ))}
                </div>
                <Button
                  onClick={handleSaveMicroGoals}
                  disabled={savingMicro}
                  className="mt-4 bg-emerald-600 hover:bg-emerald-700"
                >
                  {savingMicro ? "Guardando..." : "Guardar objetivos"}
                </Button>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        )}
      </div>
    </AppLayout>
  )
}
