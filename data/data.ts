import { WorkoutProps, WeekDay, UserProps, WeeklyCycle } from '@/utils/interfaces'

export const currentUser: UserProps = {
  id: 'usr_1',
  firstName: 'Cristian Daniel',
  lastName: 'Lahoz Piantanida',
  nickName: 'Cristian Lahoz',
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
  id: 'cycle_32',
  title: 'Microciclo #32',
  phase: 'Choque',
  startDate: '2026-08-10',
  endDate: '2026-08-16',
  targetKm: 45,
}

export const weekDaysRaw: WeekDay[] = [
  { date: '2026-08-10', km: 8, type: 'Base', completedKm: 8, isDone: true, workoutId: 0 },
  { date: '2026-08-11', km: 6, type: 'Intervals', completedKm: 3.5, isPartial: true, workoutId: 1 },
  { date: '2026-08-12', km: 9, type: 'Long', isMissed: true, workoutId: 2 },
  { date: '2026-08-13', km: 6, type: 'Fartlek', workoutId: 3 },
  { date: '2026-08-14', km: 0, isRest: true },
  { date: '2026-08-15', km: 16, type: 'Trail', workoutId: 5 },
  { date: '2026-08-16', km: 10, type: 'Race', workoutId: 6 },
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
    km: 20,
    zone: 'Z5',
    time: 180,
    gain: 820,
    pace: 540, // 8:08 min/km
    notes:
      'Salida progresiva. Administrar hidratación en el km 10 antes del ascenso principal. ¡A disfrutar la carrera!',
  },
}

export const elevationProfiles: Record<number, { km: string; elev: number }[]> = {
  1: [
    { km: '0', elev: 820 },
    { km: '0.5', elev: 870 },
    { km: '1', elev: 940 },
    { km: '1.5', elev: 1010 },
    { km: '2', elev: 1090 },
    { km: '2.5', elev: 1180 },
    { km: '3', elev: 1260 },
    { km: '3.5', elev: 1310 },
    { km: '4', elev: 1290 },
    { km: '4.5', elev: 1220 },
    { km: '5', elev: 1150 },
    { km: '5.5', elev: 1040 },
    { km: '6', elev: 940 },
  ],
  5: [
    { km: '0', elev: 900 },
    { km: '2', elev: 1020 },
    { km: '4', elev: 1180 },
    { km: '6', elev: 1310 },
    { km: '8', elev: 1250 },
    { km: '10', elev: 1100 },
    { km: '12', elev: 980 },
    { km: '14', elev: 870 },
    { km: '16', elev: 900 },
  ],
  6: [
    { km: '0', elev: 750 },
    { km: '1', elev: 820 },
    { km: '2', elev: 900 },
    { km: '3', elev: 990 },
    { km: '4', elev: 1050 },
    { km: '5', elev: 980 },
    { km: '6', elev: 910 },
    { km: '7', elev: 840 },
    { km: '8', elev: 790 },
    { km: '9', elev: 750 },
  ],
}
