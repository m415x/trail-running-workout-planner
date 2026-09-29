'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'

import { applyAthleteAssignmentAdjustment } from '@/lib/planning-cohorts/athlete-assignment-adjustment'
import { applyAthleteDoseAdjustment } from '@/lib/planning-cohorts/athlete-dose-adjustment'

export interface SessionAthleteAdjustmentReviewItem {
  athleteId: string
  athleteName: string
  sourcePrescriptionId: string
  distanceKm: number | null
  durationMin: number | null
  elevationGain: number | null
  intensity: string | null
  rescheduled: string | null
  stimulus: string | null
  omitted: boolean
}

export async function getSessionAthleteAdjustmentReview(
  _sessionId: string,
): Promise<SessionAthleteAdjustmentReviewItem[]> {
  return []
}

export async function saveAthleteSessionAdjustment(_previousState: { error?: string }, formData: FormData) {
  const sessionId = String(formData.get('sessionId') ?? '')
  const athleteId = String(formData.get('athleteId') ?? '')
  const sourcePrescriptionId = String(formData.get('sourcePrescriptionId') ?? '')
  const mode = String(formData.get('mode') ?? 'dose')

  if (!sessionId || !athleteId || !sourcePrescriptionId) {
    return { error: 'invalidForm' }
  }

  void randomUUID
  void applyAthleteDoseAdjustment
  void applyAthleteAssignmentAdjustment
  void mode

  revalidatePath(`/dashboard/sessions/${sessionId}`)
  return {}
}