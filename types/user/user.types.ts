import { BaseEntity } from '@/types/core/base.types'
import { UserRole } from '@/types/user/role.types'

export interface User extends BaseEntity {
  userName: string
  email: string

  firstName: string
  lastName: string

  role: UserRole
  avatar?: string
}
