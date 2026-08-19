import { Team, User, WorkoutProps, WeekDayRaw, WeeklyCycle, GeoLocation } from '@/types'
import { ShoeItemProps } from '@/features/profile/types/profile.types'
import { TrainingLocationKey } from '@/types'

export const TRAINING_LOCATIONS: Record<TrainingLocationKey, GeoLocation> = {
  parqueDeMayo: {
    name: 'Parque de Mayo',
    lat: -31.529822,
    lon: -68.5440881,
  },
  laGranja: {
    name: 'Pista La Granja',
    lat: -31.5272365,
    lon: -68.4914957,
  },
  diqueUllum: {
    name: 'Dique de Ullum (Cuestas)',
    lat: -31.487247,
    lon: -68.6486688,
  },
} as const

// Ubicación por defecto de la app
export const DEFAULT_FALLBACK_LOCATION = TRAINING_LOCATIONS.parqueDeMayo

export const team: Team = {
  id: 'team_1',
  name: 'El Parque Team',
  avatar: '/avatars/logo-ept.png',
}

export const currentUser: User = {
  id: 'usr_1',
  firstName: 'Cristian Daniel',
  lastName: 'Lahoz Piantanida',
  nickName: 'Cristian',
  dni: '38.123.456',
  birthday: '1992-08-14',
  phone: '+54 9 264 123-4567',
  email: 'cristianlahoz@elparque.com.ar',
  emergencyContact: 'María Lahoz (Hermana)',
  emergencyPhone: '+54 9 264 987-6543',
  avatar: '/avatars/cristian.png',
  group: 'S2',
  role: 'athlete',
  // apto fisico con vencimiento de 1 año, subir a la app
}

export const weeklyCycle: WeeklyCycle = {
  id: 'cycle_33',
  title: 'Microciclo #33',
  phase: 'Desarrollo',
  startDate: '2026-08-17',
  endDate: '2026-08-23',
  targetKm: 39,
}

export const weekDaysRaw: WeekDayRaw[] = [
  { date: '2026-08-10', type: 'Base', completedKm: 8, isDone: true, workoutId: 0 },
  { date: '2026-08-11', type: 'Intervals', completedKm: 3.5, isPartial: true, workoutId: 1 },
  { date: '2026-08-12', type: 'Long', isMissed: true, workoutId: 2 },
  { date: '2026-08-13', type: 'Fartlek', workoutId: 3 },
  { date: '2026-08-14', isRest: true },
  { date: '2026-08-15', type: 'Trail', workoutId: 5 },
  { date: '2026-08-16', type: 'Race', workoutId: 6 },
  { date: '2026-08-17', type: 'Base', workoutId: 7 },
  { date: '2026-08-18', type: 'Trail', workoutId: 8 },
  { date: '2026-08-19', type: 'Long', workoutId: 9 },
  { date: '2026-08-20', type: 'Intervals', workoutId: 10 },
  { date: '2026-08-21', isRest: true },
  { date: '2026-08-22', type: 'Trail', workoutId: 11 },
  { date: '2026-08-23', isRest: true },
]

export const workouts: Record<number, WorkoutProps> = {
  0: {
    type: 'Base', // <--- Faltaba esto
    title: 'Rodaje Base',
    km: 8,
    zone: 'Z1',
    time: 56,
    gain: 320,
    pace: 420,
    notes: 'Rodaje suave por camino llano. Mantener conversación fluida. Día de base aeróbica.',
  },
  1: {
    type: 'Trail', // <--- Asignado a Trail por el desnivel
    title: 'Ruta Antenas',
    km: 6,
    zone: 'Z2',
    time: 42,
    gain: 490,
    pace: 420,
    notes: 'Subida por Antenas, mantener FC en Z2. No exceder el ritmo — este es un día de base aeróbica.',
  },
  2: {
    type: 'Long',
    title: 'Fondo',
    km: 9,
    zone: 'Z3',
    time: 63,
    gain: 380,
    pace: 420,
    notes: 'Volumen aeróbico controlado. Hidratación cada 20 min. Conservar energía para el jueves.',
  },
  3: {
    type: 'Fartlek',
    title: 'EC + Fartlek',
    km: 6,
    zone: 'Z4',
    time: 38,
    gain: 140,
    pace: 310,
    notes: 'EC2k + 2k Fartlek: series 200×200m. Recuperación activa 2k al final. Calidad sobre cantidad.',
  },
  5: {
    type: 'Trail',
    title: 'Parkinson',
    km: 16,
    zone: 'Z5',
    time: 130,
    gain: 820,
    pace: 488,
    notes: 'Tirada larga semanal por Parkinson. Ritmo muy conservador. Llevar gel y bidón extra.',
  },
  6: {
    type: 'Race',
    title: 'Tierra de Gigantes',
    km: 60,
    zone: 'Z5',
    time: 180,
    gain: 820,
    pace: 540,
    notes:
      'Salida progresiva. Administrar hidratación en el km 42 antes del ascenso principal. ¡A disfrutar la carrera!',
    gpxPath: '/tracks/tierra-de-gigantes-2026-10k.gpx',
  },
  7: {
    type: 'Base',
    title: 'Rodaje Base',
    km: 7,
    zone: 'Z2',
    time: 42,
    gain: 0,
    pace: 360,
    notes: 'Rodaje suave por camino llano. Mantener conversación fluida. Día de base aeróbica.',
  },
  8: {
    type: 'Trail',
    title: 'Panorámico por Pinar (desde faunístico)',
    km: 7,
    zone: 'Z2',
    time: 42,
    gain: 490,
    pace: 420,
    notes: 'Mantener FC en Z2. No exceder el ritmo — este es un día de base aeróbica.',
  },
  9: {
    type: 'Long',
    title: 'Fondo',
    km: 8,
    zone: 'Z2',
    time: 63,
    gain: 380,
    pace: 420,
    notes: 'Volumen aeróbico controlado. Hidratación cada 20 min. Conservar energía para el jueves.',
  },
  10: {
    type: 'Intervals',
    title: 'Intervalos',
    km: 5,
    zone: 'Z5',
    time: 38,
    gain: 140,
    pace: 310,
    notes:
      "Entrada en calor 2k + 6x200m al 115% con Micropausas de 2'3'' entre pasada. Recuperación activa 2k al final. Calidad sobre cantidad.",
  },
  11: {
    type: 'Trail',
    title: 'Matagusanos',
    km: 12,
    zone: 'Z3',
    time: 130,
    gain: 820,
    pace: 488,
    notes: 'Tirada larga semanal por Matagusanos. Ritmo muy conservador. Llevar gel y bidón extra.',
    gpxPath: '/tracks/matagusanos-12k.gpx',
  },
}

export const runningShoes: ShoeItemProps[] = [
  {
    name: 'Salomon S/Lab Genesis',
    type: 'Competición / Terreno Técnico',
    km: 248,
    maxKm: 650,
    status: 'Óptimo',
  },
  {
    name: 'Hoka Speedgoat 5',
    type: 'Rodajes Largos / Amortiguación',
    km: 490,
    maxKm: 700,
    status: 'Desgaste medio',
  },
]
