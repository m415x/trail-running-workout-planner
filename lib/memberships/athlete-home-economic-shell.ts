import type { AthleteEconomicVisualTone } from './athlete-home-economic-visual'

/**
 * Semantic shell color only. Access control belongs to KAN-298, not the shell.
 * Static utility classes are discoverable by the Tailwind compiler.
 */
const shellBackground: Record<AthleteEconomicVisualTone, string> = {
  normal: 'bg-background',
  neutral: 'bg-background',
  warning: 'bg-amber-50 dark:bg-amber-950/25',
  danger: 'bg-red-50 dark:bg-red-950/25',
}

export function resolveAthleteEconomicShellBackground(
  tone: AthleteEconomicVisualTone,
): string {
  return shellBackground[tone]
}
