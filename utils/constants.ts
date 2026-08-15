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
import { DayConfig, MonthConfig, HrZoneConfig } from '@/utils/interfaces'

export const DAYS_OF_WEEK: readonly DayConfig[] = [
  { index: 0, short: 'L', medium: 'Lun', full: 'Lunes' },
  { index: 1, short: 'M', medium: 'Mar', full: 'Martes' },
  { index: 2, short: 'X', medium: 'Mié', full: 'Miércoles' },
  { index: 3, short: 'J', medium: 'Jue', full: 'Jueves' },
  { index: 4, short: 'V', medium: 'Vie', full: 'Viernes' },
  { index: 5, short: 'S', medium: 'Sáb', full: 'Sábado' },
  { index: 6, short: 'D', medium: 'Dom', full: 'Domingo' },
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
