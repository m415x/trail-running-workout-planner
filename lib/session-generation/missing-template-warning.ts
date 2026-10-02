import type { MicrocycleType, PeriodType } from '@/types/training/periodization.types'
import type { WeeklySessionRole } from '@/types/training/session-generation.types'

export interface MissingTemplateWarning {
  role: WeeklySessionRole
  period: PeriodType
  microcycleType: MicrocycleType
}

const roles: WeeklySessionRole[] = ['base', 'mountain', 'long', 'quality', 'recovery', 'competition']
const periods: PeriodType[] = ['general_preparatory', 'specific_preparatory', 'competitive', 'transition']
const types: MicrocycleType[] = ['base', 'development', 'shock', 'deload', 'tapering', 'race']

/** Recognizes one known legacy warning for localized display, never changes generation output. */
export function parseMissingTemplateWarning(warning: string): MissingTemplateWarning | null {
  const match = /^No hay una plantilla activa compatible con el rol ([a-z_]+), el período ([a-z_]+) y el microciclo ([a-z_]+)\.$/.exec(warning)
  if (!match) return null

  const [, role, period, microcycleType] = match
  if (!roles.includes(role as WeeklySessionRole) ||
      !periods.includes(period as PeriodType) ||
      !types.includes(microcycleType as MicrocycleType)) return null

  return {
    role: role as WeeklySessionRole,
    period: period as PeriodType,
    microcycleType: microcycleType as MicrocycleType,
  }
}
