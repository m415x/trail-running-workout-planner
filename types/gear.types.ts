import { BaseEntity } from '@/types/core.types'

export type ShoeStatus = 'active' | 'warning' | 'retired'

export interface Shoe extends BaseEntity {
  userId: string
  name: string // Ej: "Hoka Speedgoat 5"
  type: string // Ej: "Trail / Competición"
  currentKm: number
  maxKm: number // Ej: 800 km
  isDefault?: boolean
}

// Props para el componente visual en ProfileTab o GearTab
export interface ShoeItemProps {
  name: string
  type: string
  km: number
  maxKm: number
  status: ShoeStatus | string
}
