import { z } from 'zod'
import { isSessionReferencePercentage } from '@/lib/sessions/reference-percentage-options'

export type SessionPrescriptionErrorCode =
  | 'groupRequired'
  | 'invalidVolume'
  | 'microcycleRequired'
  | 'hrZoneRequired'
  | 'referencePercentageInvalid'
  | 'prescriptionsInvalid'

const optionalNumber = z.preprocess(
  (value) => value === '' || value == null ? null : Number(value),
  z.number().finite().min(0).nullable(),
)

export const sessionPrescriptionSchema = z.object({
  groupId: z.string().trim().min(1),
  microcycleId: z.string().trim().min(1),
  distanceKm: optionalNumber,
  durationMin: z.preprocess(
    (value) => value === '' || value == null ? null : Number(value),
    z.number().finite().positive().nullable(),
  ),
  elevationGain: optionalNumber,
  intensityMethod: z.enum(['hr_zone', 'reference_percentage']).nullable(),
  zone: z.enum(['Z1', 'Z2', 'Z3', 'Z4', 'Z5']).nullable(),
  referencePercentage: optionalNumber,
  notes: z.string().trim().transform((value) => value || null),
}).superRefine((data, context) => {
  if (data.intensityMethod === 'hr_zone' && !data.zone) {
    context.addIssue({ code: 'custom', path: ['zone'], message: 'hrZoneRequired' })
  }
  if (data.intensityMethod === 'reference_percentage'
    && (data.referencePercentage == null || !isSessionReferencePercentage(data.referencePercentage))) {
    context.addIssue({ code: 'custom', path: ['referencePercentage'], message: 'referencePercentageInvalid' })
  }
})

export type SessionPrescriptionInput = z.infer<typeof sessionPrescriptionSchema>

function prescriptionErrorCode(issue: z.core.$ZodIssue): SessionPrescriptionErrorCode {
  if (issue.path.includes('microcycleId')) return 'microcycleRequired'
  if (issue.path.includes('zone')) return 'hrZoneRequired'
  if (issue.path.includes('referencePercentage')) return 'referencePercentageInvalid'
  if (issue.path.some((part) => part === 'distanceKm' || part === 'durationMin' || part === 'elevationGain')) return 'invalidVolume'
  return 'prescriptionsInvalid'
}

export function parseSessionPrescriptions(formData: FormData):
  | { success: true; data: SessionPrescriptionInput[] }
  | { success: false; errorCode: SessionPrescriptionErrorCode } {
  const explicitMicrocycleIds = formData.getAll('prescriptionMicrocycleId').map((value) => value.toString())
  if (explicitMicrocycleIds.length > 0) {
    const rows: SessionPrescriptionInput[] = []
    const seen = new Set<string>()
    for (const microcycleId of explicitMicrocycleIds) {
      if (!microcycleId || seen.has(microcycleId)) {
        return { success: false, errorCode: 'prescriptionsInvalid' }
      }
      seen.add(microcycleId)
      const field = (name: string) => formData.get(`${name}:${microcycleId}`)?.toString() || ''
      const intensityMethod = field('intensityMethod') || null
      const parsed = sessionPrescriptionSchema.safeParse({
        groupId: field('prescriptionGroupId'),
        microcycleId,
        distanceKm: field('distanceKm'),
        durationMin: field('durationMin'),
        elevationGain: field('elevationGain'),
        intensityMethod,
        zone: intensityMethod === 'hr_zone' ? field('zone') || null : null,
        referencePercentage: intensityMethod === 'reference_percentage' ? field('referencePercentage') : '',
        notes: field('prescriptionNotes'),
      })
      if (!parsed.success) {
        return { success: false, errorCode: prescriptionErrorCode(parsed.error.issues[0]) }
      }
      rows.push(parsed.data)
    }
    return { success: true, data: rows }
  }

  const groupIds = [...new Set(formData.getAll('prescriptionGroupId').map((value) => value.toString()))]
  if (groupIds.length === 0) return { success: false, errorCode: 'groupRequired' }

  const rows: SessionPrescriptionInput[] = []
  const selectedMicrocycles = new Set<string>()
  for (const groupId of groupIds) {
    const microcycleIds = formData.getAll(`microcycleId:${groupId}`).map((value) => value.toString())
    // One scope per unique microcycle. A repeated group checkbox does not create another scope.
    for (let index = 0; index < Math.max(1, microcycleIds.length); index++) {
      const microcycleId = microcycleIds[index] ?? ''
      if (microcycleId && selectedMicrocycles.has(microcycleId)) {
        return { success: false, errorCode: 'prescriptionsInvalid' }
      }
      const field = (name: string) => formData.getAll(`${name}:${groupId}`)[index]?.toString() || ''
      const intensityMethod = field('intensityMethod') || null
      const parsed = sessionPrescriptionSchema.safeParse({
        groupId,
        microcycleId,
        distanceKm: field('distanceKm'),
        durationMin: field('durationMin'),
        elevationGain: field('elevationGain'),
        intensityMethod,
        zone: intensityMethod === 'hr_zone' ? field('zone') || null : null,
        referencePercentage: intensityMethod === 'reference_percentage' ? field('referencePercentage') : '',
        notes: field('prescriptionNotes'),
      })
      if (!parsed.success) {
        return { success: false, errorCode: prescriptionErrorCode(parsed.error.issues[0]) }
      }
      selectedMicrocycles.add(microcycleId)
      rows.push(parsed.data)
    }
  }
  return { success: true, data: rows }
}
