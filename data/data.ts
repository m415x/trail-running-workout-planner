import { Team, WorkoutProps, WeekDayRaw, GeoLocation, User, Athlete, AthleteProfile } from '@/types'

export const TRAINING_LOCATIONS: Record<string, GeoLocation> = {
  elParque: {
    name: 'Parque de Mayo',
    lon: -68.5440881,
    lat: -31.529822,
  },
  laGranja: {
    name: 'Pista La Granja',
    lon: -68.4914957,
    lat: -31.5272365,
  },
  diqueUllum: {
    name: 'Dique de Ullum (Cuestas)',
    lon: -68.6486688,
    lat: -31.487247,
  },
} as const

// Ubicación por defecto de la app
export const DEFAULT_FALLBACK_LOCATION = TRAINING_LOCATIONS.elParque

export const team: Team = {
  id: 'team_1',
  name: 'El Parque Team',
  description: 'El mejor team',
  avatarLight: '/avatars/logo-ept.png',
  avatarDark: '/avatars/logo-ept-dark.png',
}

export const currentUser: User = {
  id: 'user_1',
  role: 'athlete',
  userName: 'm415x',
  email: 'cristianlahoz@elparque.com.ar',
  firstName: 'Cristian Daniel',
  lastName: 'Lahoz Piantanida',
  avatar: '/avatars/cristian.png',
}

export const currentAthlete: AthleteProfile = {
  id: 'profile_user_1',
  userId: 'user_1',
  teamId: 'team_1',
  groupId: 'team_1_S2',
  nickName: 'Cristian',
  dni: '38.123.456',
  birthday: '1992-08-14',
  phone: '+54 9 264 123-4567',
  emergencyContact: 'María Lahoz (Hermana)',
  emergencyPhone: '+54 9 264 987-6543',
}

export const weeklyCycle = {
  id: 'cycle_35',
  title: 'Microciclo #35',
  weekNumber: 35,
  type: 'development',
  phase: 'Desarrollo',
  startDate: '2026-08-24',
  endDate: '2026-08-30',
  targetKm: 39,
}

export const weekDaysRaw: WeekDayRaw[] = [
  { date: '2026-08-31', type: 'Base', completedKm: 8, isDone: true, workoutId: 0 },
  { date: '2026-09-01', type: 'Intervals', completedKm: 3.5, isPartial: true, workoutId: 1 },
  { date: '2026-09-02', type: 'Long', isMissed: true, workoutId: 2 },
  { date: '2026-09-03', type: 'Fartlek', workoutId: 3 },
  { date: '2026-09-04', isRest: true },
  { date: '2026-09-05', type: 'Trail', workoutId: 11 },
  { date: '2026-09-06', type: 'Race', workoutId: 6 },
  { date: '2026-09-07', type: 'Base', completedKm: 8, isDone: true, workoutId: 0 },
  { date: '2026-09-08', type: 'Intervals', completedKm: 3.5, isPartial: true, workoutId: 1 },
  { date: '2026-09-09', type: 'Long', isMissed: true, workoutId: 2 },
  { date: '2026-09-10', type: 'Fartlek', workoutId: 3 },
  { date: '2026-09-11', isRest: true },
  { date: '2026-09-12', type: 'Trail', workoutId: 11 },
  { date: '2026-09-13', type: 'Race', workoutId: 6 },
  { date: '2026-08-14', type: 'Base', completedKm: 8, isDone: true, workoutId: 0 },
  { date: '2026-09-15', type: 'Intervals', completedKm: 3.5, isPartial: true, workoutId: 1 },
  { date: '2026-09-16', type: 'Long', isMissed: true, workoutId: 2 },
  { date: '2026-09-17', type: 'Fartlek', workoutId: 3 },
  { date: '2026-09-18', isRest: true },
  { date: '2026-09-19', type: 'Trail', workoutId: 11 },
  { date: '2026-09-20', type: 'Race', workoutId: 6 },
  { date: '2026-09-21', type: 'Base', completedKm: 8, isDone: true, workoutId: 0 },
  { date: '2026-09-22', type: 'Intervals', completedKm: 3.5, isPartial: true, workoutId: 1 },
  { date: '2026-09-23', type: 'Long', isMissed: true, workoutId: 2 },
  { date: '2026-09-24', type: 'Fartlek', workoutId: 3 },
  { date: '2026-09-25', isRest: true },
  { date: '2026-09-26', type: 'Trail', workoutId: 11 },
  { date: '2026-09-27', type: 'Race', workoutId: 6 },
]

export const workouts: Record<number, WorkoutProps> = {
  0: {
    type: 'Base',
    title: 'Rodaje Base',
    distance: 8,
    zone: 'Z1',
    time: 56,
    gain: 320,
    pace: 420,
    notes: 'Rodaje suave por camino llano. Mantener conversación fluida. Día de base aeróbica.',
  },
  1: {
    type: 'Trail',
    title: 'Ruta Antenas',
    distance: 6,
    zone: 'Z2',
    time: 42,
    gain: 490,
    pace: 420,
    notes: 'Subida por Antenas, mantener FC en Z2. No exceder el ritmo — este es un día de base aeróbica.',
  },
  2: {
    type: 'Long',
    title: 'Fondo',
    distance: 9,
    zone: 'Z3',
    time: 63,
    gain: 380,
    pace: 420,
    notes: 'Volumen aeróbico controlado. Hidratación cada 20 min. Conservar energía para el jueves.',
  },
  3: {
    type: 'Fartlek',
    title: 'EC + Fartlek',
    distance: 6,
    zone: 'Z4',
    time: 38,
    gain: 140,
    pace: 310,
    notes: 'EC2k + 2k Fartlek: series 200×200m. Recuperación activa 2k al final. Calidad sobre cantidad.',
  },
  5: {
    type: 'Trail',
    title: 'Parkinson',
    distance: 16,
    zone: 'Z5',
    time: 130,
    gain: 820,
    pace: 488,
    notes: 'Tirada larga semanal por Parkinson. Ritmo muy conservador. Llevar gel y bidón extra.',
  },
  6: {
    type: 'Race',
    title: 'Tierra de Gigantes',
    distance: 60,
    zone: 'Z5',
    time: 180,
    gain: 820,
    pace: 540,
    notes:
      'Salida progresiva. Administrar hidratación en el km 42 antes del ascenso principal. ¡A disfrutar la carrera!',
    trackPath: '/tracks/tierra-de-gigantes-2026-10k.gpx',
  },
  7: {
    type: 'Base',
    title: 'Rodaje Base',
    distance: 7,
    zone: 'Z2',
    time: 42,
    gain: 0,
    pace: 360,
    notes: 'Rodaje suave por camino llano. Mantener conversación fluida. Día de base aeróbica.',
  },
  8: {
    type: 'Trail',
    title: 'Panorámico por Pinar (desde faunístico)',
    distance: 7,
    zone: 'Z2',
    time: 42,
    gain: 490,
    pace: 420,
    notes: 'Mantener FC en Z2. No exceder el ritmo — este es un día de base aeróbica.',
  },
  9: {
    type: 'Long',
    title: 'Fondo',
    distance: 8,
    zone: 'Z2',
    time: 63,
    gain: 380,
    pace: 420,
    notes: 'Volumen aeróbico controlado. Hidratación cada 20 min. Conservar energía para el jueves.',
  },
  10: {
    type: 'Intervals',
    title: 'Intervalos',
    distance: 5,
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
    distance: 12,
    zone: 'Z3',
    time: 130,
    gain: 820,
    pace: 488,
    notes: 'Tirada larga semanal por Matagusanos. Ritmo muy conservador. Llevar gel y bidón extra.',
    trackPath: '/tracks/matagusanos-12k.gpx',
  },
}

export const runningShoes = [
  {
    brand: 'Salomon',
    model: 'S/Lab Genesis',
    name: 'Salomon S/Lab Genesis',
    type: 'Competición / Terreno Técnico',
    currentKm: 248,
    maxKm: 650,
    status: 'active',
  },
  {
    brand: 'Hoka',
    model: 'Speedgoat 5',
    name: 'Hoka Speedgoat 5',
    type: 'Rodajes Largos / Amortiguación',
    currentKm: 490,
    maxKm: 700,
    status: 'warning',
  },
]
