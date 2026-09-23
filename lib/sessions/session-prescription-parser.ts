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
  durationMin: optionalNumber,
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
  const groupIds = [...new Set(formData.getAll('prescriptionGroupId').map((value) => value.toString()))]
  if (groupIds.length === 0) return { success: false, errorCode: 'groupRequired' }

  const rows: SessionPrescriptionInput[] = []
  for (const groupId of groupIds) {
    const intensityMethod = formData.get(`intensityMethod:${groupId}`)?.toString() || null
    const parsed = sessionPrescriptionSchema.safeParse({
      groupId,
      microcycleId: formData.get(`microcycleId:${groupId}`)?.toString() || '',
      distanceKm: formData.get(`distanceKm:${groupId}`)?.toString() || '',
      durationMin: formData.get(`durationMin:${groupId}`)?.toString() || '',
      elevationGain: formData.get(`elevationGain:${groupId}`)?.toString() || '',
      intensityMethod,
      zone: intensityMethod === 'hr_zone' ? formData.get(`zone:${groupId}`)?.toString() || null : null,
      referencePercentage: intensityMethod === 'reference_percentage'
        ? formData.get(`referencePercentage:${groupId}`)?.toString() || ''
        : '',
      notes: formData.get(`prescriptionNotes:${groupId}`)?.toString() || '',
    })
    if (!parsed.success) {
      return { success: false, errorCode: prescriptionErrorCode(parsed.error.issues[0]) }
    }
    rows.push(parsed.data)
  }
  return { success: true, data: rows }
}
