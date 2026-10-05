import type { AthleteEconomicVisualTone } from './athlete-home-economic-visual'

/**
 * Semantic shell color only. Access control belongs to KAN-298, not the shell.
 * Static utility classes are discoverable by the Tailwind compiler.
 */
const shellBackground: Record<AthleteEconomicVisualTone, string> = {
  normal: 'bg-background',
  neutral: 'bg-background',
  warning: 'bg-amber-100 dark:bg-amber-900/50',
  danger: 'bg-red-100 dark:bg-red-900/50',
}

export function resolveAthleteEconomicShellBackground(
  tone: AthleteEconomicVisualTone,
): string {
  return shellBackground[tone]
}
