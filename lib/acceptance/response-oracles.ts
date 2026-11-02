/** Pure, secret-free helpers for KAN-850 HTTP acceptance. No network or database access. */
export type Inspection = {
  accessUnavailable: boolean
  denialReason: boolean
  athleteTable: boolean
  loginForm: boolean
  protectedValuesChecked: number
  protectedValueMatches: number
}

function representations(value: string): string[] {
  return [value, JSON.stringify(value).slice(1, -1), encodeURIComponent(value),
    value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')]
}

export function inspectDeniedHtml(html: string, canaries: readonly string[]): Inspection {
  if (canaries.length === 0 || canaries.some(value => value.trim().length < 5)) {
    throw new Error('Nonempty, nontrivial canaries required')
  }
  const unique = [...new Set(canaries)]
  return {
    accessUnavailable: html.includes('Acceso no disponible'),
    denialReason: html.includes('No se pudo determinar un equipo y acceso válidos.'),
    athleteTable: /<table\b/i.test(html),
    loginForm: /<input[^>]+type=["']password["']/i.test(html),
    protectedValuesChecked: unique.length,
    protectedValueMatches: unique.filter(value => representations(value).some(pattern => html.includes(pattern))).length,
  }
}

export function isControlledH3Deny(input: Inspection): boolean {
  return input.accessUnavailable && input.denialReason && !input.athleteTable &&
    !input.loginForm && input.protectedValueMatches === 0
}
