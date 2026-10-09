import type { TeamMembershipPreset } from '@/types'

export const TEAM_MEMBERSHIP_PRESETS = [
  'athlete',
  'assistant',
  'coach',
  'admin',
] as const satisfies readonly TeamMembershipPreset[]

export type CapabilityKey =
  | 'athlete.admin.manage'
  | 'sporting_group.admin.manage'
  | 'planning.manage'
  | 'planning.self.read'
  | 'stats.self.read'
  | 'physiology.self.read'
  | 'workout_log.self.manage'
  | 'training.coordinate'
  | 'physiology.read'
  | 'field_evidence_1000m.manage'
  | 'economy.manage'
  | 'economic_policy.manage'
  | 'team_membership.manage'
  | 'audit.read'

export interface CapabilityDefinition {
  key: CapabilityKey
  basePresets: readonly TeamMembershipPreset[]
  delegable: boolean
  structural: boolean
  requiredScope?: 'self'
}

export const CAPABILITY_CATALOG = [
  {
    key: 'athlete.admin.manage',
    basePresets: ['assistant', 'coach', 'admin'],
    delegable: false,
    structural: false,
  },
  {
    key: 'sporting_group.admin.manage',
    basePresets: ['assistant', 'coach', 'admin'],
    delegable: false,
    structural: false,
  },
  {
    key: 'planning.manage',
    basePresets: ['coach'],
    delegable: false,
    structural: false,
  },
  {
    key: 'planning.self.read',
    basePresets: ['athlete', 'assistant', 'coach', 'admin'],
    delegable: false,
    structural: false,
    requiredScope: 'self',
  },
  {
    key: 'stats.self.read',
    basePresets: ['athlete', 'assistant', 'coach', 'admin'],
    delegable: false,
    structural: false,
    requiredScope: 'self',
  },
  {
    key: 'physiology.self.read',
    basePresets: ['athlete', 'assistant', 'coach', 'admin'],
    delegable: false,
    structural: false,
    requiredScope: 'self',
  },
  {
    key: 'workout_log.self.manage',
    basePresets: ['athlete', 'assistant', 'coach', 'admin'],
    delegable: false,
    structural: false,
    requiredScope: 'self',
  },
  {
    key: 'training.coordinate',
    basePresets: ['coach'],
    delegable: true,
    structural: false,
  },
  {
    key: 'physiology.read',
    basePresets: ['coach'],
    delegable: false,
    structural: false,
  },
  {
    key: 'field_evidence_1000m.manage',
    basePresets: ['coach'],
    delegable: false,
    structural: false,
  },
  {
    key: 'economy.manage',
    basePresets: ['assistant', 'coach', 'admin'],
    delegable: false,
    structural: false,
  },
  {
    key: 'economic_policy.manage',
    basePresets: ['coach', 'admin'],
    delegable: false,
    structural: false,
  },
  {
    key: 'team_membership.manage',
    basePresets: ['admin'],
    delegable: false,
    structural: true,
  },
  {
    key: 'audit.read',
    basePresets: ['admin'],
    delegable: false,
    structural: false,
  },
] as const satisfies readonly CapabilityDefinition[]

const CAPABILITY_BY_KEY = new Map(
  CAPABILITY_CATALOG.map((definition) => [definition.key, definition]),
)

export function getCapabilityDefinition(key: CapabilityKey): CapabilityDefinition {
  const definition = CAPABILITY_BY_KEY.get(key)
  if (!definition) {
    throw new Error(`Unknown capability: ${key}`)
  }
  return definition
}
