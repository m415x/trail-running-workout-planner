import { TeamProps, UserProps } from '@/types/common.types'
import { WorkoutProps, WeekDayRaw, WeeklyCycle } from '@/features/workouts/types/workout.types'
import { ShoeItemProps } from '@/features/profile/types/profile.types'

export const team: TeamProps = {
  id: 'team_1',
  name: 'El Parque Team',
  avatar: '/avatars/logo-ept.png',
}

export const currentUser: UserProps = {
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
  teamRole: 'El Parque Team Athlete',
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
    title: 'Rodaje Base',
    km: 8,
    zone: 'Z1',
    time: 56,
    gain: 320,
    pace: 420, // 7:00 min/km
    notes: 'Rodaje suave por camino llano. Mantener conversación fluida. Día de base aeróbica.',
  },
  1: {
    title: 'Ruta Antenas',
    km: 6,
    zone: 'Z2',
    time: 42,
    gain: 490,
    pace: 420, // 7:00 min/km
    notes: 'Subida por Antenas, mantener FC en Z2. No exceder el ritmo — este es un día de base aeróbica.',
  },
  2: {
    title: 'Fondo',
    km: 9,
    zone: 'Z3',
    time: 63,
    gain: 380,
    pace: 420, // 7:00 min/km
    notes: 'Volumen aeróbico controlado. Hidratación cada 20 min. Conservar energía para el jueves.',
  },
  3: {
    title: 'EC + Fartlek',
    km: 6,
    zone: 'Z4',
    time: 38,
    gain: 140,
    pace: 310, // 5:10 min/km
    notes: 'EC2k + 2k Fartlek: series 200×200m. Recuperación activa 2k al final. Calidad sobre cantidad.',
  },
  5: {
    title: 'Parkinson',
    km: 16,
    zone: 'Z5',
    time: 130,
    gain: 820,
    pace: 488, // 8:08 min/km
    notes: 'Tirada larga semanal por Parkinson. Ritmo muy conservador. Llevar gel y bidón extra.',
  },
  6: {
    title: 'Tierra de Gigantes',
    km: 60,
    zone: 'Z5',
    time: 180,
    gain: 820,
    pace: 540, // 8:08 min/km
    notes:
      'Salida progresiva. Administrar hidratación en el km 42 antes del ascenso principal. ¡A disfrutar la carrera!',
    gpxPath: '/tracks/tierra-de-gigantes-2026-10k.gpx',
  },
  7: {
    title: 'Rodaje Base',
    km: 7,
    zone: 'Z2',
    time: 42,
    gain: 0,
    pace: 360, // 6:00 min/km
    notes: 'Rodaje suave por camino llano. Mantener conversación fluida. Día de base aeróbica.',
  },
  8: {
    title: 'Panorámico por Pinar (desde faunístico)',
    km: 7,
    zone: 'Z2',
    time: 42,
    gain: 490,
    pace: 420, // 7:00 min/km
    notes: 'Mantener FC en Z2. No exceder el ritmo — este es un día de base aeróbica.',
  },
  9: {
    title: 'Fondo',
    km: 8,
    zone: 'Z2',
    time: 63,
    gain: 380,
    pace: 420, // 7:00 min/km
    notes: 'Volumen aeróbico controlado. Hidratación cada 20 min. Conservar energía para el jueves.',
  },
  10: {
    title: "EC2k + 6x200mx115%xMi2'3'' + 2k reg",
    km: 5,
    zone: 'Z5',
    time: 38,
    gain: 140,
    pace: 310, // 5:10 min/km
    notes:
      "EC2k + 6x200m al 115% con Micropausas de 2'3'' entre pasada. Recuperación activa 2k al final. Calidad sobre cantidad.",
  },
  11: {
    title: 'Matagusanos',
    km: 12,
    zone: 'Z3',
    time: 130,
    gain: 820,
    pace: 488, // 8:08 min/km
    notes: 'Tirada larga semanal por Matagusanos. Ritmo muy conservador. Llevar gel y bidón extra.',
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
