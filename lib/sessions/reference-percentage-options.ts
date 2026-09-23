/** Coach-approved reference percentages, expressed on the human 0–100+ scale. */
export const SESSION_REFERENCE_PERCENTAGES = [50, 60, 70, 80, 90, 100, 110, 115, 120] as const

export function isSessionReferencePercentage(value: number): boolean {
  return SESSION_REFERENCE_PERCENTAGES.some(option => option === value)
}
