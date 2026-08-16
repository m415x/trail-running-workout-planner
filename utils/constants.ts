import {
  Activity,
  Coffee,
  Gauge,
  Mountain,
  Route,
  Timer,
  Zap,
  Target,
  TrendingUp,
  Trophy,
  LucideIcon,
} from 'lucide-react'
import { DayConfig, MonthConfig } from '@/types/common.types'
import { HrZoneConfig } from '@/features/workouts/types/workout.types'

export const DAYS_OF_WEEK: readonly DayConfig[] = [
  { index: 0, short: 'L', twoLetter: 'Lu', medium: 'Lun', full: 'Lunes' },
  { index: 1, short: 'M', twoLetter: 'Ma', medium: 'Mar', full: 'Martes' },
  { index: 2, short: 'X', twoLetter: 'Mi', medium: 'Mié', full: 'Miércoles' },
  { index: 3, short: 'J', twoLetter: 'Ju', medium: 'Jue', full: 'Jueves' },
  { index: 4, short: 'V', twoLetter: 'Vi', medium: 'Vie', full: 'Viernes' },
  { index: 5, short: 'S', twoLetter: 'Sá', medium: 'Sáb', full: 'Sábado' },
  { index: 6, short: 'D', twoLetter: 'Do', medium: 'Dom', full: 'Domingo' },
] as const

export const MONTHS_OF_YEAR: readonly MonthConfig[] = [
  { index: 0, short: 'Ene', full: 'Enero' },
  { index: 1, short: 'Feb', full: 'Febrero' },
  { index: 2, short: 'Mar', full: 'Marzo' },
  { index: 3, short: 'Abr', full: 'Abril' },
  { index: 4, short: 'May', full: 'Mayo' },
  { index: 5, short: 'Jun', full: 'Junio' },
  { index: 6, short: 'Jul', full: 'Julio' },
  { index: 7, short: 'Ago', full: 'Agosto' },
  { index: 8, short: 'Sep', full: 'Septiembre' },
  { index: 9, short: 'Oct', full: 'Octubre' },
  { index: 10, short: 'Nov', full: 'Noviembre' },
  { index: 11, short: 'Dic', full: 'Diciembre' },
] as const

export const WORKOUT_TYPE_ICONS: Record<string, LucideIcon> = {
  Base: Activity, // Rodaje aeróbico / Base
  Long: Route, // Tirada larga / Fondo
  Intervals: Timer, // Series e intervalos
  Trail: Mountain, // Desnivel / Montaña
  Speed: Zap, // Velocidad / Calidad
  Fartlek: Gauge, // Cambios de ritmo
  PAM: Target, // Test de 1000m / Benchmark
  Hills: TrendingUp, // Entrenamientos en desnivel/cuestas
  Race: Trophy, // Día de Carrera / Test Oficial
  Rest: Coffee, // Descanso
}

export const HR_ZONES: Record<'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5', HrZoneConfig> = {
  Z1: {
    name: 'Zona 1',
    pct: '50–60%',
    rpe: '1–2/10',
    workType: 'Recuperación Activa',
    description: 'Ritmo suave de calentamiento, la conversación es fluida sin esfuerzo.',
    styles: {
      bg: 'bg-hr-z1/5',
      border: 'border-hr-z1/20',
      text: 'text-hr-z1',
      textMuted: 'text-hr-z1/70',
    },
  },
  Z2: {
    name: 'Zona 2',
    pct: '60–70%',
    rpe: '3–4/10',
    workType: 'Resistencia Básica',
    description: 'Base aeróbica. Ritmo de rodaje sostenible para largas distancias.',
    styles: {
      bg: 'bg-hr-z2/5',
      border: 'border-hr-z2/20',
      text: 'text-hr-z2',
      textMuted: 'text-hr-z2/70',
    },
  },
  Z3: {
    name: 'Zona 3',
    pct: '70–80%',
    rpe: '5–6/10',
    workType: 'Capacidad Aeróbica',
    description: 'Intensidad moderada. Mejora la eficiencia cardiovascular y el ritmo de carrera.',
    styles: {
      bg: 'bg-hr-z3/5',
      border: 'border-hr-z3/20',
      text: 'text-hr-z3',
      textMuted: 'text-hr-z3/70',
    },
  },
  Z4: {
    name: 'Zona 4',
    pct: '80–90%',
    rpe: '7–8/10',
    workType: 'Capacidad Anaeróbica',
    description: 'Umbral de lactato / Fartlek. Esfuerzo duro y respiración agitada.',
    styles: {
      bg: 'bg-hr-z4/5',
      border: 'border-hr-z4/20',
      text: 'text-hr-z4',
      textMuted: 'text-hr-z4/70',
    },
  },
  Z5: {
    name: 'Zona 5',
    pct: '90–100%',
    rpe: '9–10/10',
    workType: 'Potencia Máxima (VO₂ máx)',
    description: 'Velocidad pico e intervalos explosivos. Esfuerzo máximo de corta duración.',
    styles: {
      bg: 'bg-hr-z5/5',
      border: 'border-hr-z5/20',
      text: 'text-hr-z5',
      textMuted: 'text-hr-z5/70',
    },
  },
}

export interface RpeLevel {
  value: number
  label: string
  description: string
  details: string[]
  colorClass: string
}

export const RPE_LEVELS: readonly RpeLevel[] = [
  {
    value: 1,
    label: 'Muy suave',
    description: 'Esfuerzo mínimo',
    details: ['Podías cantar o hablar sin pausa', 'Casi sin elevación cardíaca', 'Ideal para recuperación activa'],
    colorClass: 'bg-hr-z1 text-foreground',
  },
  {
    value: 2,
    label: 'Suave',
    description: 'Paseo ligero',
    details: ['Conversación fluida', 'Ritmo de calentamiento o trote regenerativo'],
    colorClass: 'bg-hr-z1 text-foreground',
  },
  {
    value: 3,
    label: 'Ligero',
    description: 'Cómodo y sostenible',
    details: ['Podías mantener una charla continua', 'Ritmo base aeróbica (Z2)', 'Sostenible durante horas'],
    colorClass: 'bg-hr-z2 text-white',
  },
  {
    value: 4,
    label: 'Moderado bajo',
    description: 'Controlado',
    details: ['Respiración presente pero rítmica', 'Hablas en oraciones completas'],
    colorClass: 'bg-hr-z2 text-white',
  },
  {
    value: 5,
    label: 'Moderado',
    description: 'Meta moderada',
    details: [
      'Podías hablar en frases cortas',
      'Respirabas con algo de dificultad',
      'Dentro de tu zona de confort, pero esforzándote',
    ],
    colorClass: 'bg-hr-z3 text-white',
  },
  {
    value: 6,
    label: 'Vigoroso',
    description: 'Ritmo vivo / Tempo',
    details: ['Hablar cuesta más trabajo', 'Comienzo de acumulación de lactato', 'Exige concentración en subidas'],
    colorClass: 'bg-hr-z3 text-white',
  },
  {
    value: 7,
    label: 'Duro',
    description: 'Umbral anaeróbico',
    details: [
      'Solo puedes decir un par de palabras',
      'Respiración forzada y continua',
      'Sostenible por 20 a 40 minutos',
    ],
    colorClass: 'bg-hr-z4 text-white',
  },
  {
    value: 8,
    label: 'Muy duro',
    description: 'Alta intensidad / Series',
    details: ['No puedes hablar', 'Esfuerzo exigente en rampas pronunciadas', 'Sensación de ardor en piernas'],
    colorClass: 'bg-hr-z4 text-white',
  },
  {
    value: 9,
    label: 'Casi máximo',
    description: 'Esfuerzo extremo',
    details: ['Apenas puedes mantener el ritmo unos minutos', 'Frecuencia cardíaca cercana a FC Máx'],
    colorClass: 'bg-hr-z5 text-white',
  },
  {
    value: 10,
    label: 'Esfuerzo máximo',
    description: 'Al límite / Sprint final',
    details: ['Agotamiento total inmediato', 'Imposible mantener por más de 30-60 segundos', 'Esfuerzo de meta'],
    colorClass: 'bg-hr-z5 text-white',
  },
] as const
