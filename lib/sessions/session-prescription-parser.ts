import { z } from 'zod'

const optionalNumber = z.preprocess(
  (value) => value === '' || value == null ? null : Number(value),
  z.number().finite().min(0, 'Los valores de volumen no pueden ser negativos').nullable(),
)

export const sessionPrescriptionSchema = z.object({
  groupId: z.string().trim().min(1),
  microcycleId: z.string().trim().min(1, 'Seleccioná un microciclo para cada grupo'),
  distanceKm: optionalNumber,
  durationMin: optionalNumber,
  elevationGain: optionalNumber,
  intensityMethod: z.enum(['hr_zone', 'pam_percentage']).nullable(),
  zone: z.enum(['Z1', 'Z2', 'Z3', 'Z4', 'Z5']).nullable(),
  pamPercentage: optionalNumber,
  notes: z.string().trim().transform((value) => value || null),
}).superRefine((data, context) => {
  if (data.intensityMethod === 'hr_zone' && !data.zone) {
    context.addIssue({ code: 'custom', path: ['zone'], message: 'Seleccioná una zona para la intensidad por FC' })
  }
  if (data.intensityMethod === 'pam_percentage'
    && (data.pamPercentage == null || data.pamPercentage <= 0 || data.pamPercentage > 200)) {
    context.addIssue({ code: 'custom', path: ['pamPercentage'], message: 'Ingresá un porcentaje PAM entre 0 y 200' })
  }
})

export type SessionPrescriptionInput = z.infer<typeof sessionPrescriptionSchema>

export function parseSessionPrescriptions(formData: FormData):
  | { success: true; data: SessionPrescriptionInput[] }
  | { success: false; error: string } {
  const groupIds = [...new Set(formData.getAll('prescriptionGroupId').map((value) => value.toString()))]
  if (groupIds.length === 0) return { success: false, error: 'Asigná la sesión al menos a un grupo' }

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
      pamPercentage: intensityMethod === 'pam_percentage'
        ? formData.get(`pamPercentage:${groupId}`)?.toString() || ''
        : '',
      notes: formData.get(`prescriptionNotes:${groupId}`)?.toString() || '',
    })
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Revisá las prescripciones grupales' }
    }
    rows.push(parsed.data)
  }
  return { success: true, data: rows }
}
