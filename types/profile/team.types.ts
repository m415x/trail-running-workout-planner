import { BaseEntity } from '@/types/core/core.types'

export interface Team extends BaseEntity {
  name: string
  description?: string
  avatarLight?: string
  avatarDark?: string
}
