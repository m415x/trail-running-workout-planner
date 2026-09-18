export function targetAthleteActiveState(isActive: boolean): boolean {
  return !isActive
}

export function requiresAthleteActiveStateConfirmation(isActive: boolean): boolean {
  return isActive
}
