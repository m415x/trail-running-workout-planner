import {
  resolveAthleteNameWriteIntent,
  type AthleteEditableName,
} from '@/features/athletes/lib/athlete-name-write-intent'

function requiredString(formData: FormData, name: 'firstName' | 'lastName'): string {
  const value = formData.get(name)
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Missing athlete ${name}`)
  }
  return value
}

/**
 * Adds only explicit write intent to the submitted edit payload. It never
 * invents an account identity or copies fallback User data into AthleteProfile.
 */
export function prepareAthleteEditFormData(
  initial: AthleteEditableName,
  formData: FormData,
): FormData {
  const current = {
    firstName: requiredString(formData, 'firstName'),
    lastName: requiredString(formData, 'lastName'),
  }

  formData.set('nameWriteIntent', resolveAthleteNameWriteIntent(initial, current))
  return formData
}
