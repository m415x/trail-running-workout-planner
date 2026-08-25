import { BaseEntity } from '@/types/core.types'

export interface Team extends BaseEntity {
  name: string
  description?: string
  avatarLight?: string
  avatarDark?: string
}
