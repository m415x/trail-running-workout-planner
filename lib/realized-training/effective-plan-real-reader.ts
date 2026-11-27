import { and, eq, gte, inArray, lte, or } from 'drizzle-orm'
import { db } from '@/db'
import { athleteProfiles, athleteGroups, athleteSessionAdjustments, athleteSessionAdjustmentRevisions, groupSessionPrescriptions, groupTrainingPlans, macrocycles, mesocycles, microcycles, sessions } from '@/db/schema'
import { resolveAthleteSessionPrescription } from '@/lib/planning-cohorts/athlete-session-prescription'
import { resolveAthleteEffectiveVerticalSession } from '@/lib/athlete-planning/effective-vertical-session'
import type { AthletePlanningResolution } from '@/lib/planning-cohorts/planning-resolution'
import type { PersistedAthleteSessionAdjustmentRevision } from '@/lib/planning-cohorts/athlete-session-adjustment-persistence'
import { listRealizedTrainingRecordsForAthleteInDateRange } from './realized-training-repository'
import { buildAthletePlanRealComparison } from './plan-real-comparison-service'
import type { PlannedSessionComparisonInput } from './plan-real-comparison'
import type { PlanRealComparisonWindow, PlanRealMetricOperand, PlanRealPlanningResolutionLimitation } from '@/types/training/plan-real-comparison.types'

function numeric(value: number | null, unit: 'km' | 'min' | 'm'): PlanRealMetricOperand {
  if (value === null) return { state: 'unknown', reason: 'not_prescribed', unit }
  return Number.isFinite(value) && value >= 0
    ? { state: 'known', value, unit }
    : { state: 'unknown', reason: 'invalid_value', unit }
}

function intensity(p: { intensityMethod: string | null; zone: string | null; referencePercentage: number | null }): PlanRealMetricOperand {
  if (p.intensityMethod === 'hr_zone' && p.zone !== null) return { state: 'known', value: p.zone, unit: 'hr_zone' }
  if (p.intensityMethod === 'reference_percentage' && p.referencePercentage !== null && Number.isFinite(p.referencePercentage)) return { state: 'known', value: p.referencePercentage, unit: 'reference_percent' }
  return { state: 'unknown', reason: 'not_prescribed', unit: null }
}

/** Internal server read only. Caller supplies its own authorized subject and
 * dated planning boundary; a denied/unavailable resolver is not an empty plan.
 * Never invoke this directly from a client-facing boundary without authorization.
 */
export async function readEffectivePlanRealComparison(input: {
  athleteId: string
  teamId: string
  window: PlanRealComparisonWindow
  resolvePlanning: (date: string) => Promise<AthletePlanningResolution | null>
}) {
  const { athleteId, teamId, window } = input
  const unavailable = { success: false as const, data: null }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(window.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(window.endDate) || window.startDate > window.endDate) return unavailable
  const athlete = db.select({ id: athleteProfiles.id }).from(athleteProfiles)
    .where(and(eq(athleteProfiles.id, athleteId), eq(athleteProfiles.teamId, teamId), eq(athleteProfiles.isDeleted, false))).get()
  if (!athlete) return unavailable

  // Include out-of-window original dates only for own exact-source adjustments,
  // so rescheduling into the window retains original planning authority.
  // Intentionally do not filter adjustment Team here: corruption must fail closed.
  const adjustments = db.select().from(athleteSessionAdjustments)
    .where(and(eq(athleteSessionAdjustments.athleteId, athleteId), eq(athleteSessionAdjustments.isDeleted, false))).all()
  const adjustmentIds = adjustments.map(a => a.id)
  const revisions = adjustmentIds.length ? db.select().from(athleteSessionAdjustmentRevisions)
    .where(and(inArray(athleteSessionAdjustmentRevisions.adjustmentId, adjustmentIds),
      eq(athleteSessionAdjustmentRevisions.isCurrent, true), eq(athleteSessionAdjustmentRevisions.isDeleted, false))).all() : []
  // Only a current candidate reschedule into the requested window can bring
  // an original date outside it into scope. This is discovery, not authority:
  // the exact selected source and all its current revisions are resolved below.
  const movedIds = new Set(revisions.flatMap(r => {
    const assignment = (r.payload as Partial<PersistedAthleteSessionAdjustmentRevision['payload']> | null)?.assignment
    return r.state === 'active' && assignment?.kind === 'rescheduled'
      && typeof assignment.date === 'string' && assignment.date >= window.startDate && assignment.date <= window.endDate
      ? [r.adjustmentId] : []
  }))
  const adjustedIds = adjustments.filter(a => movedIds.has(a.id)).map(a => a.sourcePrescriptionId)
  const adjustedSessionIds = adjustedIds.length ? db.select({ id: groupSessionPrescriptions.sessionId })
    .from(groupSessionPrescriptions)
    .where(and(inArray(groupSessionPrescriptions.id, adjustedIds), eq(groupSessionPrescriptions.isDeleted, false)))
    .all().map(r => r.id) : []
  const originalWindow = and(gte(sessions.date, window.startDate), lte(sessions.date, window.endDate))
  const rows = db.select({
    session: { id: sessions.id, date: sessions.date, type: sessions.type, workoutId: sessions.workoutId, title: sessions.title },
    prescription: groupSessionPrescriptions,
    lineage: {
      planId: groupTrainingPlans.id, groupId: groupTrainingPlans.groupId, teamId: athleteGroups.teamId,
      groupDeleted: athleteGroups.isDeleted, planDeleted: groupTrainingPlans.isDeleted,
      macroDeleted: macrocycles.isDeleted, mesoDeleted: mesocycles.isDeleted, microDeleted: microcycles.isDeleted,
      microStart: microcycles.startDate, microEnd: microcycles.endDate,
    },
  }).from(sessions)
    .innerJoin(groupSessionPrescriptions, and(eq(groupSessionPrescriptions.sessionId, sessions.id), eq(groupSessionPrescriptions.isDeleted, false)))
    .leftJoin(microcycles, eq(groupSessionPrescriptions.microcycleId, microcycles.id))
    .leftJoin(mesocycles, eq(microcycles.mesocycleId, mesocycles.id))
    .leftJoin(macrocycles, eq(mesocycles.macrocycleId, macrocycles.id))
    .leftJoin(groupTrainingPlans, eq(macrocycles.groupTrainingPlanId, groupTrainingPlans.id))
    .leftJoin(athleteGroups, eq(groupTrainingPlans.groupId, athleteGroups.id))
    .where(and(eq(sessions.teamId, teamId), eq(sessions.isDeleted, false),
      adjustedSessionIds.length ? or(originalWindow, inArray(sessions.id, adjustedSessionIds)) : originalWindow)).all()


  const bySession = new Map<string, typeof rows>()
  for (const row of rows) {
    const list = bySession.get(row.session.id) ?? []
    list.push(row)
    bySession.set(row.session.id, list)
  }
  const planningByDate = new Map<string, AthletePlanningResolution>()
  for (const date of new Set(rows.map(row => row.session.date))) {
    const planning = await input.resolvePlanning(date)
    if (!planning) return unavailable
    planningByDate.set(date, planning)
  }

  const plannedSessions: PlannedSessionComparisonInput[] = []
  const planningLimitations: PlanRealPlanningResolutionLimitation[] = []
  const limit = (value: PlanRealPlanningResolutionLimitation) => {
    if (!planningLimitations.some(x => x.date === value.date && x.reason === value.reason)) planningLimitations.push(value)
  }
  const inWindow = (date: string) => date >= window.startDate && date <= window.endDate
  for (const candidates of bySession.values()) {
    const session = candidates[0].session
    const planning = planningByDate.get(session.date)!
    if (planning.status !== 'resolved') {
      if (planning.status === 'none') limit({ date: session.date, status: 'none', reason: planning.reason, conflictingIds: [] })
      else limit({ date: session.date, status: 'conflict', reason: planning.reason, conflictingIds: planning.conflictingIds })
      continue
    }
    const chosen = resolveAthleteSessionPrescription({
      planning,
      prescriptions: candidates.flatMap(({ prescription, lineage }) => lineage?.planId
        ? [{ id: prescription.id, groupId: prescription.groupId, microcycleId: prescription.microcycleId, groupTrainingPlanId: lineage.planId }] : []),
    })
    const conflict = (reason: 'multiple-prescriptions-for-applicable-plan' | 'invalid-prescription-lineage' | 'invalid-athlete-adjustment') =>
      limit({ date: session.date, status: 'conflict', reason, conflictingIds: [] })
    // A damaged lineage claiming the selected Plan/Group must not silently
    // disappear or cause a fallback to another source.
    if (candidates.some(({ prescription, lineage }) =>
      (lineage?.planId === planning.planId && prescription.groupId !== planning.groupId)
      || (prescription.groupId === planning.groupId && (!lineage?.planId || lineage.teamId !== teamId || lineage.groupId !== prescription.groupId)))) {
      conflict('invalid-prescription-lineage')
      continue
    }
    if (chosen.status === 'conflict') { conflict('multiple-prescriptions-for-applicable-plan'); continue }
    if (chosen.status !== 'resolved') continue
    const row = candidates.find(c => c.prescription.id === chosen.prescriptionId)
    if (!row?.lineage || row.lineage.teamId !== teamId || row.lineage.groupId !== planning.groupId
      || row.lineage.groupDeleted || row.lineage.planDeleted || row.lineage.macroDeleted || row.lineage.mesoDeleted || row.lineage.microDeleted
      || !row.lineage.microStart || !row.lineage.microEnd || session.date < row.lineage.microStart || session.date > row.lineage.microEnd) {
      conflict('invalid-prescription-lineage')
      continue
    }
    const own = adjustments.filter(a => a.sourcePrescriptionId === row.prescription.id)
    const current = revisions.filter(r => own.some(a => a.id === r.adjustmentId))
    const effective = resolveAthleteEffectiveVerticalSession({
      teamId, athleteId, session, prescription: row.prescription, adjustments: own,
      revisions: current.map(r => ({ ...r, payload: r.payload as PersistedAthleteSessionAdjustmentRevision['payload'] })),
    })
    if (effective.status === 'omitted') continue
    if (effective.status !== 'resolved' || !/^\d{4}-\d{2}-\d{2}$/.test(effective.session.date)) {
      conflict('invalid-athlete-adjustment')
      continue
    }
    if (!inWindow(effective.session.date)) continue
    const p = effective.prescription
    plannedSessions.push({
      teamId, athleteId, date: effective.session.date, sessionId: session.id, sessionTitle: session.title,
      planning: { source: planning.source, teamId, groupId: planning.groupId, planId: planning.planId, cohortId: planning.cohortId },
      metrics: {
        distanceKm: numeric(p.distanceKm, 'km'),
        durationMin: numeric(p.durationMin, 'min'),
        // This is the complete session operand, never a subtotal from a block.
        elevationGainM: numeric(effective.vertical.effectiveElevationGain, 'm'),
        intensity: intensity(p),
      },
    })
  }

  const records = listRealizedTrainingRecordsForAthleteInDateRange(athleteId, teamId, window.startDate, window.endDate)
  const eligible = new Set(plannedSessions.map(s => s.sessionId))
  return {
    success: true as const,
    data: buildAthletePlanRealComparison({
      teamId, athleteId, window, plannedSessions, planningLimitations,
      realizedRecords: records.filter(r => r.sessionId === null || eligible.has(r.sessionId)),
    }),
  }
}
