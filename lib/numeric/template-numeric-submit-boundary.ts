import { normalizeSessionPrescriptionMetricDraft } from './session-prescription-metric-draft'
import { normalizeTemplateReferencePercentageDraft } from './template-reference-percentage-draft'

/**
 * Pure submission boundary: validate all numeric drafts before modifying
 * the submitted payload or invoking the existing authorized action.
 */
export function submitValidatedTemplateNumericDraft(
  input: FormData,
  intensityMethod: string,
  submit: (payload: FormData) => void,
): 'submitted' | 'invalid' {
  const normalizedMetrics: Array<[string, string]> = []
  for (const field of ['distanceKm', 'durationMin', 'elevationGain'] as const) {
    const parsed = normalizeSessionPrescriptionMetricDraft(String(input.get(field) ?? ''), field)
    if (parsed.status === 'invalid') return 'invalid'
    normalizedMetrics.push([field, parsed.status === 'valid' ? parsed.value : ''])
  }

  if (intensityMethod === 'reference_percentage') {
    const parsed = normalizeTemplateReferencePercentageDraft(String(input.get('referencePercentage') ?? ''))
    if (parsed.status !== 'valid') return 'invalid'
    normalizedMetrics.push(['referencePercentage', parsed.value])
  }

  const canonical = new FormData()
  for (const [key, value] of input.entries()) canonical.append(key, value)
  for (const [key, value] of normalizedMetrics) canonical.set(key, value)
  submit(canonical)
  return 'submitted'
}
