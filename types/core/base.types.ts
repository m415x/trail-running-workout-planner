export interface BaseEntity {
  id: string
  createdAt?: string // ISO 8601 string
  updatedAt?: string // ISO 8601 string
  isDeleted?: boolean
}
