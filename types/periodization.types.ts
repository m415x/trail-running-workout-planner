import { AthleteGroupCode } from '@/types/athlete-groups.types'

export type MicrocycleType = 'base' | 'desarrollo' | 'choque' | 'descarga' | 'tapering' | 'race'

export type PeriodType = 'preparatorio_general' | 'preparatorio_especifico' | 'competitivo' | 'transicion'

export interface Microcycle {
  id: string
  weekNumber: number
  type: MicrocycleType
  startDate: string // 'YYYY-MM-DD'
  endDate: string // 'YYYY-MM-DD'
  targetVolumeKmByGroup: Partial<Record<AthleteGroupCode, number>>
  notes?: string
}

export interface Mesocycle {
  id: string
  title: string // ej: "Mesociclo 1: Acumulación de Fuerza y Resistencia"
  number: number
  period: PeriodType
  objective: string
  microcycles: Microcycle[] // Habitualmente 4 microciclos
}

export interface Macrocycle {
  id: string
  title: string // ej: "Preparación Maratón San Juan 2026"
  targetRaceDate: string
  targetRaceName: string
  startDate: string
  endDate: string
  taperingWeeksCount: 2 | 3
  mesocycles: Mesocycle[]
}
