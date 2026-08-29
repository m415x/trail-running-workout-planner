import { BaseEntity } from '@/types/core/base.types'

export type ShoeStatus = 'active' | 'warning' | 'retired'

export interface Shoe extends BaseEntity {
  athleteId: string

  type: string // Ej: "Trail / Competición"
  brand: string
  model: string
  maxKm: number // Ej: 800 km
  purchaseDate: string

  currentKm: number
  retiredAt: string // Fecha cuando se dejó de usar
  notes: string

  isActive?: boolean
  isDefault?: boolean
}

// Props para el componente visual en ProfileTab o GearTab
export interface ShoeItemProps {
  type: string
  brand: string
  model: string
  name: string
  maxKm: number
  currentKm: number
  status: ShoeStatus
}
