import { WorkoutProps, WeekDay } from '@/utils/interfaces'

export const weekDays: WeekDay[] = [
  { day: 'L', date: 10, km: 8, type: 'Base', completedKm: 8, isDone: true },
  { day: 'M', date: 11, km: 6, type: 'Intervals', completedKm: 3.5, isPartial: true },
  { day: 'X', date: 12, km: 9, type: 'Long', isMissed: true },
  { day: 'J', date: 13, km: 6, type: 'Fartlek', isToday: true },
  { day: 'V', date: 14, km: 0, isRest: true },
  { day: 'S', date: 15, km: 16, type: 'Trail' },
  { day: 'D', date: 16, km: 0, type: 'Race' },
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
}

export const elevationProfiles: Record<number, { km: string; elev: number }[]> = {
  0: [
    { km: '0', elev: 720 },
    { km: '1', elev: 740 },
    { km: '2', elev: 755 },
    { km: '3', elev: 750 },
    { km: '4', elev: 745 },
    { km: '5', elev: 738 },
    { km: '6', elev: 730 },
    { km: '7', elev: 725 },
    { km: '8', elev: 720 },
  ],
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
  2: [
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
  3: [
    { km: '0', elev: 820 },
    { km: '1', elev: 870 },
    { km: '2', elev: 900 },
    { km: '3', elev: 880 },
    { km: '4', elev: 860 },
    { km: '5', elev: 845 },
    { km: '6', elev: 820 },
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
}
