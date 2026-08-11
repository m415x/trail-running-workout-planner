import { Home, Calendar, Play, BarChart2, User } from 'lucide-react'
import { WorkoutProps } from '@/utils/interfaces'

export const colors: Record<string, string> = { ORANGE: '#FF5A1A', EMERALD: '#34D399' }

export const weekDays = [
  { day: 'L', date: 10, km: 8, type: 'Z2', done: true, isRest: false, isToday: false },
  { day: 'M', date: 11, km: 6, type: 'Trail', done: false, isRest: false, isToday: true },
  { day: 'X', date: 12, km: 9, type: 'Z2', done: false, isRest: false, isToday: false },
  { day: 'J', date: 13, km: 6, type: 'Speed', done: false, isRest: false, isToday: false },
  { day: 'V', date: 14, km: 0, type: '', done: false, isRest: true, isToday: false },
  { day: 'S', date: 15, km: 16, type: 'Long', done: false, isRest: false, isToday: false },
  { day: 'D', date: 16, km: 0, type: '', done: false, isRest: true, isToday: false },
]

export const workouts: Record<number, WorkoutProps> = {
  0: {
    title: 'Rodaje Base',
    km: 8,
    zone: 'Z1',
    zonePct: '70–80%',
    time: '56',
    gain: '+320',
    pace: '7:00',
    notes: 'Rodaje suave por camino llano. Mantener conversación fluida. Día de base aeróbica.',
  },
  1: {
    title: 'Ruta Antenas',
    km: 6,
    zone: 'Z2',
    zonePct: '70–80%',
    time: '42',
    gain: '+490',
    pace: '7:00',
    notes: 'Subida por Antenas, mantener FC en Z2 (70–80% PAM). No exceder el ritmo — este es un día de base aeróbica.',
  },
  2: {
    title: 'Fondo Z2',
    km: 9,
    zone: 'Z3',
    zonePct: '70–80%',
    time: '63',
    gain: '+380',
    pace: '7:00',
    notes: 'Volumen aeróbico controlado. Hidratación cada 20 min. Conservar energía para el jueves.',
  },
  3: {
    title: 'EC + Farlek',
    km: 6,
    zone: 'Z4',
    zonePct: '100–110%',
    time: '38',
    gain: '+140',
    pace: '5:10',
    notes: 'EC2k + 2k Farlek: series 200×200m. Recuperación activa 2k al final. Calidad sobre cantidad.',
  },
  5: {
    title: 'Parkinson 16k',
    km: 16,
    zone: 'Z5',
    zonePct: '70–80%',
    time: '130',
    gain: '+820',
    pace: '8:08',
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
export const navItems = [
  { icon: Home, label: 'Inicio' },
  { icon: Calendar, label: 'Plan' },
  { icon: Play, label: '' },
  { icon: BarChart2, label: 'Stats' },
  { icon: User, label: 'Perfil' },
]

export const ZONE_STYLES: Record<string, { bg: string; border: string; text: string; textMuted: string }> = {
  Z1: {
    bg: 'bg-hr-z1/5',
    border: 'border-hr-z1/20',
    text: 'text-hr-z1',
    textMuted: 'text-hr-z1/70',
  },
  Z2: {
    bg: 'bg-hr-z2/5',
    border: 'border-hr-z2/20',
    text: 'text-hr-z2',
    textMuted: 'text-hr-z2/70',
  },
  Z3: {
    bg: 'bg-hr-z3/5',
    border: 'border-hr-z3/20',
    text: 'text-hr-z3',
    textMuted: 'text-hr-z3/70',
  },
  Z4: {
    bg: 'bg-hr-z4/5',
    border: 'border-hr-z4/20',
    text: 'text-hr-z4',
    textMuted: 'text-hr-z4/70',
  },
  Z5: {
    bg: 'bg-hr-z5/5',
    border: 'border-hr-z5/20',
    text: 'text-hr-z5',
    textMuted: 'text-hr-z5/70',
  },
}
