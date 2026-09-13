import { z } from 'zod'

const text = z.string().trim().max(2000)
const label = z.string().trim().min(1).max(200)
const optionalText = text.transform(value => value || null)
const url = z.string().trim().refine(value => {
  if (!value) return true
  try { return ['https:', 'http:'].includes(new URL(value).protocol) } catch { return false }
}).transform(value => value || null)

/** Rejects impossible calendar dates instead of relying on browser validation. */
export function isCatalogDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(value))
    && new Date(value).toISOString().slice(0, 10) === value
}
const date = z.string().refine(isCatalogDate)
const optionalDate = z.string().refine(value => !value || isCatalogDate(value))
  .transform(value => value || null)
const metric = z.string().trim().transform(value => value === '' ? null : Number(value))
  .refine(value => value === null || (Number.isFinite(value) && value >= 0))

export const eventFormSchema = z.object({
  name: label, description: optionalText, websiteUrl: url,
  status: z.enum(['active', 'archived']),
})
export const editionFormSchema = z.object({
  label, startDate: date, endDate: optionalDate,
  organizerName: optionalText, websiteUrl: url, notes: optionalText,
  locality: optionalText, region: optionalText,
  countryCode: z.string().trim().refine(value => !value || /^[a-zA-Z]{2}$/.test(value))
    .transform(value => value.toUpperCase() || null),
  status: z.enum(['draft', 'published', 'completed', 'cancelled']),
}).refine(value => !value.endDate || value.endDate >= value.startDate, { path: ['endDate'] })
export const courseFormSchema = z.object({
  label,
  distanceKm: metric.refine(value => value === null || value > 0),
  elevationGainM: metric,
  modalityCode: z.enum(['', 'road', 'trail', 'skyrunning', 'vertical_kilometer', 'other']),
  modalityLabel: text,
  scheduledStartAt: z.string().trim().refine(value => !value
    || (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)
      && isCatalogDate(value.slice(0, 10)) && !Number.isNaN(Date.parse(value))))
    .transform(value => value || null),
  startLocationLabel: optionalText, notes: optionalText,
  status: z.enum(['draft', 'published', 'cancelled']),
}).refine(value => value.modalityCode !== 'other' || Boolean(value.modalityLabel), { path: ['modalityLabel'] })

export interface CatalogFormState {
  error?: 'invalid' | 'unavailable' | 'saveFailed' | 'stale'
  fields?: string[]
}
