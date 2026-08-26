/**
 * @file Contiene la base de persistencia y primitivos compartidos en toda la aplicación.
 */

export interface BaseEntity {
  id: string
  createdAt?: string // ISO 8601 string
  updatedAt?: string // ISO 8601 string
  isDeleted?: boolean
}

export interface GeoLocation {
  name: string
  lat: number
  lon: number
}

export type IntensityZone = 'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5'

export type NavigationTab = 'home' | 'plan' | 'stats' | 'profile'
