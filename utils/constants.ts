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
import {
  IntensityZone,
  AthleteCategoryCode,
  AthleteLevelCode,
  CategoryMetadata,
  LevelMetadata,
  WorkoutType,
} from '@/types'

interface DayConfig {
  index: number
  short: string
  twoLetter: string
  medium: string
  full: string
}

export const DAYS_OF_WEEK: readonly DayConfig[] = [
  { index: 0, short: 'L', twoLetter: 'Lu', medium: 'Lun', full: 'Lunes' },
  { index: 1, short: 'M', twoLetter: 'Ma', medium: 'Mar', full: 'Martes' },
  { index: 2, short: 'X', twoLetter: 'Mi', medium: 'Mié', full: 'Miércoles' },
  { index: 3, short: 'J', twoLetter: 'Ju', medium: 'Jue', full: 'Jueves' },
  { index: 4, short: 'V', twoLetter: 'Vi', medium: 'Vie', full: 'Viernes' },
  { index: 5, short: 'S', twoLetter: 'Sá', medium: 'Sáb', full: 'Sábado' },
  { index: 6, short: 'D', twoLetter: 'Do', medium: 'Dom', full: 'Domingo' },
] as const

interface MonthConfig {
  index: number
  short: string
  full: string
}

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

export interface WorkoutTypeConfig {
  label: string
  icon: LucideIcon
  description?: string
}

export const WORKOUT_TYPES_CONFIG: Record<WorkoutType, WorkoutTypeConfig> = {
  Base: {
    label: 'Rodaje Base',
    icon: Activity,
    description: 'Rodaje aeróbico continuo a ritmo suave / conversacional',
  },
  Long: {
    label: 'Fondo / Tirada Larga',
    icon: Route,
    description: 'Volumen aeróbico y resistencia muscular de larga duración',
  },
  Intervals: {
    label: 'Series / Intervalos',
    icon: Timer,
    description: 'Fraccionados y pasadas de alta intensidad con recuperación',
  },
  Trail: {
    label: 'Entrenamiento Trail',
    icon: Mountain,
    description: 'Terreno técnico, montaña y senderos naturales',
  },
  Speed: {
    label: 'Velocidad / Calidad',
    icon: Zap,
    description: 'Ritmos rápidos, reactividad y potencia aeróbica',
  },
  Fartlek: {
    label: 'Fartlek',
    icon: Gauge,
    description: 'Juegos continuos con variaciones libres o pautadas de ritmo',
  },
  PAM: {
    label: 'Test PAM / 1000m',
    icon: Target,
    description: 'Evaluación y test de potencia aeróbica máxima',
  },
  Hills: {
    label: 'Cuestas y Desnivel',
    icon: TrendingUp,
    description: 'Fuerza específica y trabajo de subidas con pendiente',
  },
  Race: {
    label: 'Día de Carrera',
    icon: Trophy,
    description: 'Competición oficial o evento objetivo',
  },
  Rest: {
    label: 'Descanso',
    icon: Coffee,
    description: 'Recuperación activa o descanso total',
  },
} as const

export interface HrZoneStyles {
  bg: string
  border: string
  text: string
  textMuted: string
  badgeBg?: string
}

export interface HrZoneConfig {
  code: IntensityZone
  name: string
  pct: string
  rpe: string
  workType: string
  description: string
  // ── Datos Fisiológicos, Respiratorios y Biomecánicos ──
  effortAndPerception?: string
  breathingPathway?: string
  rhythmicPattern?: string
  biomechanicalFocus?: string
  // ── Estilos visuales ──
  styles: HrZoneStyles
}

export const HR_ZONES: Record<IntensityZone, HrZoneConfig> = {
  Z1: {
    code: 'Z1',
    name: 'Recuperación / Regenerativo',
    pct: '50-60%',
    rpe: '1-2',
    workType: 'Regenerativo',
    description: 'Recuperación activa y adaptación muscular de bajo impacto.',
    effortAndPerception: 'Muy suave. Ritmo de trote cómodo y sin esfuerzo real.',
    breathingPathway: 'Exclusivamente nasal.',
    rhythmicPattern: '4:4 o 3:3 (Inhalar en 3/4 pasos, exhalar en 3/4).',
    biomechanicalFocus:
      'Expansión diafragmática máxima. Relajar hombros y trapecios. Ideal para interiorizar una técnica de carrera limpia y sin tensión.',
    styles: {
      bg: 'bg-hr-z1/5',
      border: 'border-hr-z1/20',
      text: 'text-hr-z1',
      textMuted: 'text-hr-z1/70',
      badgeBg: 'bg-hr-z1',
    },
  },
  Z2: {
    code: 'Z2',
    name: 'Resistencia Aeróbica',
    pct: '60-70%',
    rpe: '3-4',
    workType: 'Base Aeróbica',
    description: 'Construcción del motor aeróbico y quema eficiente de grasas.',
    effortAndPerception: 'Suave. Ritmo conversacional totalmente fluido.',
    breathingPathway: 'Nasal o Mixta (Inhala nariz, exhala boca relajada).',
    rhythmicPattern: '3:3',
    biomechanicalFocus:
      'Mantener la caja torácica estable. El core se activa suavemente para absorber el bajo impacto. Es el trabajo de cimientos para el motor aeróbico.',
    styles: {
      bg: 'bg-hr-z2/5',
      border: 'border-hr-z2/20',
      text: 'text-hr-z2',
      textMuted: 'text-hr-z2/70',
      badgeBg: 'bg-hr-z2',
    },
  },
  Z3: {
    code: 'Z3',
    name: 'Tempo / Ritmo Maratón',
    pct: '70-80%',
    rpe: '5-6',
    workType: 'Tempo / Ritmo',
    description: 'Resistencia al ritmo sostenido y economía de carrera.',
    effortAndPerception: 'Moderado. Conversación entrecortada (frases cortas).',
    breathingPathway: 'Principalmente nasal.',
    rhythmicPattern: '2:2 (El patrón rey del corredor de fondo).',
    biomechanicalFocus:
      'Sincronización perfecta entre la pisada y el ciclo respiratorio para distribuir la carga del impacto uniformemente y evitar alteraciones posturales por fatiga.',
    styles: {
      bg: 'bg-hr-z3/5',
      border: 'border-hr-z3/20',
      text: 'text-hr-z3',
      textMuted: 'text-hr-z3/70',
      badgeBg: 'bg-hr-z3',
    },
  },
  Z4: {
    code: 'Z4',
    name: 'Umbral / Series Largas',
    pct: '80-90%',
    rpe: '7-8',
    workType: 'Umbral Lactato',
    description: 'Aclaramiento de lactato y tolerancia a la fatiga ácida.',
    effortAndPerception: 'Duro. Apenas puedes decir una o dos palabras sueltas.',
    breathingPathway: 'Mixta.',
    rhythmicPattern: '2:2 o 2:1 (Inhalar 2, exhalar 1).',
    biomechanicalFocus:
      'Usar un patrón asimétrico como el 2:1 alterna el lado del cuerpo que recibe el impacto durante la exhalación (momento de menor estabilidad del core), protegiendo rodillas y caderas.',
    styles: {
      bg: 'bg-hr-z4/5',
      border: 'border-hr-z4/20',
      text: 'text-hr-z4',
      textMuted: 'text-hr-z4/70',
      badgeBg: 'bg-hr-z4',
    },
  },
  Z5: {
    code: 'Z5',
    name: 'VO₂ Máx / Sprints',
    pct: '90-100%',
    rpe: '9-10',
    workType: 'Potencia / VO₂ Máx',
    description: 'Consumo máximo de oxígeno y velocidad terminal.',
    effortAndPerception: 'Máximo. Imposible hablar. Sensación de ahogo.',
    breathingPathway: 'Mixta.',
    rhythmicPattern: '1:1 o Libre (Centrado en la exhalación).',
    biomechanicalFocus:
      'La biomecánica aquí se somete a la supervivencia respiratoria. El objetivo mecánico es forzar la salida del dióxido de carbono mediante exhalaciones muy potentes; la inhalación será un reflejo automático.',
    styles: {
      bg: 'bg-hr-z5/5',
      border: 'border-hr-z5/20',
      text: 'text-hr-z5',
      textMuted: 'text-hr-z5/70',
      badgeBg: 'bg-hr-z5',
    },
  },
}

interface RpeLevel {
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
    colorClass: 'bg-hr-z1 text-white',
  },
  {
    value: 2,
    label: 'Suave',
    description: 'Paseo ligero',
    details: ['Conversación fluida', 'Ritmo de calentamiento o trote regenerativo'],
    colorClass: 'bg-hr-z1 text-white',
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

export const ATHLETE_CATEGORIES: Record<AthleteCategoryCode, CategoryMetadata> = {
  E: { name: 'Elite', code: 'E', description: 'Atletas de alto rendimiento y competencia' },
  U: { name: 'Ultra', code: 'U', description: 'Distancias superiores a 42k y ultras de montaña' },
  M: { name: 'Marathon', code: 'M', description: 'Distancia 42k en calle o trail maratón' },
  H: { name: 'Half-Marathon', code: 'H', description: 'Medio maratón (21k)' },
  S: { name: 'Short', code: 'S', description: 'Distancias cortas y explosivas (5k a 15k)' },
  B: { name: 'Base', code: 'B', description: 'Iniciación, adaptación y acondicionamiento' },
}

export const ATHLETE_LEVELS: Record<AthleteLevelCode, LevelMetadata> = {
  1: { name: 'Advance', code: '1', description: 'Alto volumen y experiencia' },
  2: { name: 'Intermediate', code: '2', description: 'Volumen y carga moderada' },
  3: { name: 'Beginner', code: '3', description: 'Volumen controlado y progresión técnica' },
}
