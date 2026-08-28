import { BaseEntity } from '@/types/core/base.types'

export interface Team extends BaseEntity {
  name: string
  description?: string
  avatarLight?: string
  avatarDark?: string
}
