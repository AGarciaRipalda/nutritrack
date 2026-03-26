import type { Equipment, LibraryExercise, MuscleGroup } from './workout-types'

export const FALLBACK_MUSCLES: { id: string; label: string }[] = [
  { id: 'pecho', label: 'Pecho' },
  { id: 'espalda', label: 'Espalda' },
  { id: 'hombros', label: 'Hombros' },
  { id: 'biceps', label: 'Bíceps' },
  { id: 'triceps', label: 'Tríceps' },
  { id: 'core', label: 'Core' },
  { id: 'cuadriceps', label: 'Cuádriceps' },
  { id: 'isquiotibiales', label: 'Isquios' },
  { id: 'gluteos', label: 'Glúteos' },
  { id: 'gemelos', label: 'Gemelos' },
  { id: 'trapecio', label: 'Trapecio' },
  { id: 'cardio', label: 'Cardio' },
  { id: 'cuerpo_completo', label: 'Cuerpo completo' },
]

export const FALLBACK_EQUIPMENT: { id: string; label: string }[] = [
  { id: 'barra', label: 'Barra' },
  { id: 'mancuernas', label: 'Mancuernas' },
  { id: 'maquina', label: 'Máquina' },
  { id: 'cable', label: 'Cable' },
  { id: 'peso_corporal', label: 'Peso corporal' },
  { id: 'smith', label: 'Smith' },
  { id: 'kettlebell', label: 'Kettlebell' },
  { id: 'banda_elastica', label: 'Banda elástica' },
]

export const FALLBACK_EXERCISES: LibraryExercise[] = [
  { id: 'bench_press', name: 'Press de banca', muscle_primary: 'pecho', muscle_secondary: ['hombros', 'triceps'], equipment: 'barra', category: 'fuerza', force: 'push' },
  { id: 'incline_bench_press', name: 'Press inclinado con barra', muscle_primary: 'pecho', muscle_secondary: ['hombros', 'triceps'], equipment: 'barra', category: 'fuerza', force: 'push' },
  { id: 'db_bench_press', name: 'Press de banca con mancuernas', muscle_primary: 'pecho', muscle_secondary: ['hombros', 'triceps'], equipment: 'mancuernas', category: 'fuerza', force: 'push' },
  { id: 'push_up', name: 'Flexiones', muscle_primary: 'pecho', muscle_secondary: ['hombros', 'triceps', 'core'], equipment: 'peso_corporal', category: 'fuerza', force: 'push' },
  { id: 'cable_fly', name: 'Cruces en polea', muscle_primary: 'pecho', muscle_secondary: [], equipment: 'cable', category: 'fuerza', force: 'push' },
  { id: 'deadlift', name: 'Peso muerto convencional', muscle_primary: 'espalda', muscle_secondary: ['isquiotibiales', 'gluteos', 'core', 'trapecio'], equipment: 'barra', category: 'fuerza', force: 'pull' },
  { id: 'barbell_row', name: 'Remo con barra', muscle_primary: 'espalda', muscle_secondary: ['biceps', 'trapecio'], equipment: 'barra', category: 'fuerza', force: 'pull' },
  { id: 'db_row', name: 'Remo con mancuerna', muscle_primary: 'espalda', muscle_secondary: ['biceps'], equipment: 'mancuernas', category: 'fuerza', force: 'pull' },
  { id: 'pull_up', name: 'Dominadas', muscle_primary: 'espalda', muscle_secondary: ['biceps', 'core'], equipment: 'peso_corporal', category: 'fuerza', force: 'pull' },
  { id: 'lat_pulldown', name: 'Jalón al pecho', muscle_primary: 'espalda', muscle_secondary: ['biceps'], equipment: 'cable', category: 'fuerza', force: 'pull' },
  { id: 'cable_row_seated', name: 'Remo sentado en polea', muscle_primary: 'espalda', muscle_secondary: ['biceps', 'trapecio'], equipment: 'cable', category: 'fuerza', force: 'pull' },
  { id: 'overhead_press', name: 'Press militar con barra', muscle_primary: 'hombros', muscle_secondary: ['triceps', 'core'], equipment: 'barra', category: 'fuerza', force: 'push' },
  { id: 'db_shoulder_press', name: 'Press de hombros con mancuernas', muscle_primary: 'hombros', muscle_secondary: ['triceps'], equipment: 'mancuernas', category: 'fuerza', force: 'push' },
  { id: 'lateral_raise', name: 'Elevaciones laterales', muscle_primary: 'hombros', muscle_secondary: [], equipment: 'mancuernas', category: 'fuerza', force: 'push' },
  { id: 'rear_delt_fly', name: 'Pájaros', muscle_primary: 'hombros', muscle_secondary: ['trapecio'], equipment: 'mancuernas', category: 'fuerza', force: 'pull' },
  { id: 'barbell_curl', name: 'Curl con barra', muscle_primary: 'biceps', muscle_secondary: ['antebrazo'], equipment: 'barra', category: 'fuerza', force: 'pull' },
  { id: 'db_curl', name: 'Curl con mancuernas', muscle_primary: 'biceps', muscle_secondary: ['antebrazo'], equipment: 'mancuernas', category: 'fuerza', force: 'pull' },
  { id: 'hammer_curl', name: 'Curl martillo', muscle_primary: 'biceps', muscle_secondary: ['antebrazo'], equipment: 'mancuernas', category: 'fuerza', force: 'pull' },
  { id: 'tricep_pushdown', name: 'Extensión de tríceps en polea', muscle_primary: 'triceps', muscle_secondary: [], equipment: 'cable', category: 'fuerza', force: 'push' },
  { id: 'skull_crusher', name: 'Press francés', muscle_primary: 'triceps', muscle_secondary: [], equipment: 'barra', category: 'fuerza', force: 'push' },
  { id: 'dips_triceps', name: 'Fondos para tríceps', muscle_primary: 'triceps', muscle_secondary: ['pecho'], equipment: 'peso_corporal', category: 'fuerza', force: 'push' },
  { id: 'back_squat', name: 'Sentadilla trasera', muscle_primary: 'cuadriceps', muscle_secondary: ['gluteos', 'core'], equipment: 'barra', category: 'fuerza', force: 'compound' },
  { id: 'front_squat', name: 'Sentadilla frontal', muscle_primary: 'cuadriceps', muscle_secondary: ['core'], equipment: 'barra', category: 'fuerza', force: 'compound' },
  { id: 'leg_press', name: 'Prensa de piernas', muscle_primary: 'cuadriceps', muscle_secondary: ['gluteos'], equipment: 'maquina', category: 'fuerza', force: 'push' },
  { id: 'walking_lunge', name: 'Zancadas caminando', muscle_primary: 'cuadriceps', muscle_secondary: ['gluteos', 'isquiotibiales'], equipment: 'mancuernas', category: 'fuerza', force: 'compound' },
  { id: 'romanian_deadlift', name: 'Peso muerto rumano', muscle_primary: 'isquiotibiales', muscle_secondary: ['gluteos', 'espalda'], equipment: 'barra', category: 'fuerza', force: 'pull' },
  { id: 'leg_curl', name: 'Curl femoral', muscle_primary: 'isquiotibiales', muscle_secondary: [], equipment: 'maquina', category: 'fuerza', force: 'pull' },
  { id: 'hip_thrust', name: 'Hip thrust', muscle_primary: 'gluteos', muscle_secondary: ['isquiotibiales'], equipment: 'barra', category: 'fuerza', force: 'push' },
  { id: 'glute_bridge', name: 'Puente de glúteos', muscle_primary: 'gluteos', muscle_secondary: ['core'], equipment: 'peso_corporal', category: 'fuerza', force: 'push' },
  { id: 'standing_calf_raise', name: 'Elevación de gemelos de pie', muscle_primary: 'gemelos', muscle_secondary: [], equipment: 'maquina', category: 'fuerza', force: 'push' },
  { id: 'seated_calf_raise', name: 'Elevación de gemelos sentado', muscle_primary: 'gemelos', muscle_secondary: [], equipment: 'maquina', category: 'fuerza', force: 'push' },
  { id: 'plank', name: 'Plancha', muscle_primary: 'core', muscle_secondary: ['cuerpo_completo'], equipment: 'peso_corporal', category: 'fuerza', force: 'isometric' },
  { id: 'hanging_leg_raise', name: 'Elevaciones de piernas colgado', muscle_primary: 'core', muscle_secondary: [], equipment: 'peso_corporal', category: 'fuerza', force: 'pull' },
  { id: 'russian_twist', name: 'Giros rusos', muscle_primary: 'core', muscle_secondary: [], equipment: 'peso_corporal', category: 'fuerza', force: 'compound' },
  { id: 'burpee', name: 'Burpee', muscle_primary: 'cuerpo_completo', muscle_secondary: ['core'], equipment: 'peso_corporal', category: 'pliometria', force: 'compound' },
  { id: 'jump_squat', name: 'Sentadilla con salto', muscle_primary: 'cuadriceps', muscle_secondary: ['gluteos'], equipment: 'peso_corporal', category: 'pliometria', force: 'push' },
  { id: 'running', name: 'Correr', muscle_primary: 'cardio', muscle_secondary: ['cuerpo_completo'], equipment: 'ninguno' as Equipment, category: 'cardio', force: 'cardio' },
  { id: 'cycling', name: 'Ciclismo', muscle_primary: 'cardio', muscle_secondary: ['cuadriceps', 'gluteos'], equipment: 'ninguno' as Equipment, category: 'cardio', force: 'cardio' },
  { id: 'rowing', name: 'Remo ergómetro', muscle_primary: 'cardio', muscle_secondary: ['espalda', 'cuerpo_completo'], equipment: 'maquina', category: 'cardio', force: 'cardio' },
  { id: 'jump_rope', name: 'Comba', muscle_primary: 'cardio', muscle_secondary: ['gemelos', 'hombros'], equipment: 'ninguno' as Equipment, category: 'cardio', force: 'cardio' },
]

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function buildSearchableText(exercise: LibraryExercise): string {
  const aliases: Record<string, string[]> = {
    bench_press: ['press pecho', 'pecho barra'],
    incline_bench_press: ['press inclinado', 'pecho superior'],
    db_bench_press: ['press mancuernas', 'pecho mancuernas'],
    push_up: ['flexion', 'flexiones', 'calistenia pecho'],
    deadlift: ['peso muerto', 'cadena posterior'],
    barbell_row: ['remo', 'espalda barra'],
    db_row: ['remo mancuerna'],
    pull_up: ['dominada', 'dominadas'],
    lat_pulldown: ['jalon', 'jalon pecho'],
    overhead_press: ['press militar', 'hombro'],
    db_shoulder_press: ['press hombro mancuernas'],
    lateral_raise: ['hombro lateral'],
    rear_delt_fly: ['pajaros', 'deltoide posterior'],
    barbell_curl: ['curl biceps', 'biceps barra'],
    db_curl: ['curl mancuerna', 'biceps mancuerna'],
    hammer_curl: ['curl martillo', 'antebrazo'],
    tricep_pushdown: ['triceps polea'],
    skull_crusher: ['press frances', 'triceps barra'],
    back_squat: ['sentadilla', 'pierna', 'cuadriceps'],
    front_squat: ['sentadilla frontal', 'pierna'],
    leg_press: ['prensa', 'pierna maquina'],
    walking_lunge: ['zancadas', 'pierna gluteo'],
    romanian_deadlift: ['peso muerto rumano', 'isquios'],
    leg_curl: ['curl femoral', 'isquios maquina'],
    hip_thrust: ['gluteos barra'],
    glute_bridge: ['puente gluteos'],
    standing_calf_raise: ['gemelos'],
    seated_calf_raise: ['gemelos sentado'],
    plank: ['abdomen', 'core'],
    hanging_leg_raise: ['abdominales'],
    russian_twist: ['oblicuos', 'abdomen'],
    burpee: ['hiit', 'cardio'],
    jump_squat: ['sentadilla salto', 'pliometria'],
    running: ['correr', 'cardio'],
    cycling: ['bicicleta', 'cardio'],
    rowing: ['remo cardio', 'ergometro'],
    jump_rope: ['comba', 'saltar cuerda', 'cardio'],
  }

  return normalizeText([
    exercise.id,
    exercise.name,
    exercise.muscle_primary,
    exercise.muscle_secondary.join(' '),
    exercise.equipment,
    exercise.category,
    ...(aliases[exercise.id] ?? []),
  ].join(' '))
}

export function filterFallbackExercises(params: { q?: string; muscle?: string; equipment?: string; category?: string }): LibraryExercise[] {
  const normalizedQuery = normalizeText(params.q?.trim() ?? '')
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean)

  let results = FALLBACK_EXERCISES.filter((exercise) => {
    if (params.muscle && exercise.muscle_primary !== params.muscle && !exercise.muscle_secondary.includes(params.muscle as MuscleGroup)) return false
    if (params.equipment && exercise.equipment !== params.equipment) return false
    if (params.category && exercise.category !== params.category) return false
    if (!tokens.length) return true

    const searchable = buildSearchableText(exercise)
    return tokens.every((token) => searchable.includes(token))
  })

  if (!results.length && tokens.length) {
    results = FALLBACK_EXERCISES.filter((exercise) => {
      if (params.muscle && exercise.muscle_primary !== params.muscle && !exercise.muscle_secondary.includes(params.muscle as MuscleGroup)) return false
      if (params.equipment && exercise.equipment !== params.equipment) return false
      if (params.category && exercise.category !== params.category) return false

      const searchable = buildSearchableText(exercise)
      return tokens.some((token) => searchable.includes(token))
    })
  }

  return results
}
