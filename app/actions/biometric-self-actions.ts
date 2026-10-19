'use server'

import { revalidatePath } from 'next/cache'
import { createCurrentBiometricSqliteObservation, correctCurrentBiometricSqliteObservation } from '@/lib/physiology/biometric-self-sqlite-server-writer'
import type { BiometricCreateInput, BiometricCorrectionInput } from '@/lib/physiology/biometric-self-writer'

export async function createCurrentSelfBiometricAction(input: BiometricCreateInput) {
  const result = await createCurrentBiometricSqliteObservation(input)
  if (result.status === 'persisted') revalidatePath('/[locale]/profile', 'page')
  return result
}

export async function correctCurrentSelfBiometricAction(input: BiometricCorrectionInput) {
  const result = await correctCurrentBiometricSqliteObservation(input)
  if (result.status === 'persisted') revalidatePath('/[locale]/profile', 'page')
  return result
}
