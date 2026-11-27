import { resolveAthletePlanningSession } from '../planning-cohorts/athlete-planning-session-resolution'
import { resolveEffectiveAthleteAdjustment } from '../planning-cohorts/athlete-adjustment-resolution'
import type { EffectiveAudiencePrescription, SharedSessionEvent } from '../planning-cohorts/athlete-session-adjustment'
import type { PersistedAthleteSessionAdjustment, PersistedAthleteSessionAdjustmentRevision } from '../planning-cohorts/athlete-session-adjustment-persistence'
import { readVerticalBlockJson } from '../sessions/vertical-prescription-json'
import { calculateVerticalBlockTotals, resolveVerticalPrimaryObjective, resolveVerticalSessionElevationGain, type VerticalBlockV1, type VerticalPrimaryObjective } from '../sessions/vertical-prescription'

export type AthleteVerticalBlock = {
  direction: VerticalBlockV1['direction']
  coverage: VerticalBlockV1['coverage']
  repetitions: number
  elevationGainPerRep: { meters: number | null; provenance: VerticalBlockV1['elevationGainPerRep']['provenance']['kind'] }
  elevationLossPerRep: { meters: number | null; provenance: VerticalBlockV1['elevationLossPerRep']['provenance']['kind'] }
  elevationGainTotalM: number | null
  elevationLossTotalM: number | null
}

export type AthleteVerticalProjection = {
  state: 'inherited_effective' | 'override_consistent' | 'override_incompatible' | 'effective_unknown'
  primaryObjective: VerticalPrimaryObjective | null
  effectiveElevationGain: number | null
  effectiveBlock: AthleteVerticalBlock | null
  referenceBlock: AthleteVerticalBlock | null
  blockStatus: 'absent' | 'valid' | 'unsupported' | 'corrupt'
}

type Input = {
  teamId: string
  athleteId: string
  session: SharedSessionEvent
  prescription: EffectiveAudiencePrescription & { primaryObjective: VerticalPrimaryObjective | null; verticalBlockJson: string | null }
  adjustments: PersistedAthleteSessionAdjustment[]
  revisions: PersistedAthleteSessionAdjustmentRevision[]
}

type Outcome =
  | { status: 'resolved'; session: SharedSessionEvent; prescription: EffectiveAudiencePrescription; vertical: AthleteVerticalProjection }
  | { status: 'omitted'; vertical: { state: 'omitted' } }
  | { status: 'conflict'; vertical: { state: 'authority_conflict' } }

const conflict = (): Outcome => ({ status: 'conflict', vertical: { state: 'authority_conflict' } })

function safeBlock(block: VerticalBlockV1): AthleteVerticalBlock {
  return {
    direction: block.direction,
    coverage: block.coverage,
    repetitions: block.repetitions,
    elevationGainPerRep: { meters: block.elevationGainPerRep.meters, provenance: block.elevationGainPerRep.provenance.kind },
    elevationLossPerRep: { meters: block.elevationLossPerRep.meters, provenance: block.elevationLossPerRep.provenance.kind },
    ...calculateVerticalBlockTotals(block),
  }
}

/** Called only after dated, server-scoped prescription selection. Never expose
 * raw group JSON, revision payloads, audit identities or historical track locators. */
export function resolveAthleteEffectiveVerticalSession(input: Input): Outcome {
  try {
    if (!input.teamId || !input.athleteId || input.adjustments.length > 1) return conflict()
    const adjustment = input.adjustments[0] ?? null
    if (adjustment && (adjustment.teamId !== input.teamId || adjustment.athleteId !== input.athleteId || adjustment.sourcePrescriptionId !== input.prescription.id)) return conflict()
    if (input.revisions.some(row => !adjustment || row.adjustmentId !== adjustment.id)) return conflict()
    const selected = resolveEffectiveAthleteAdjustment({
      athleteId: input.athleteId, effectivePrescriptionId: input.prescription.id, adjustment, revisions: input.revisions,
    })
    if (selected.status === 'outside_authority' || selected.status === 'conflict') return conflict()
    if (selected.status === 'resolved') {
      const { dose, assignment } = selected.revision.payload
      if (dose !== null) {
        for (const field of [dose.distanceKm, dose.durationMin, dose.elevationGain]) {
          if (field.kind !== 'inherit' && (field.kind !== 'override' || (field.value !== null && (!Number.isFinite(field.value) || field.value < 0)))) return conflict()
        }
        if (dose.intensity.kind !== 'inherit' && dose.intensity.kind !== 'override') return conflict()
      }
      if (!['inherit', 'rescheduled', 'stimulus_override', 'omitted'].includes(assignment.kind)) return conflict()
    }
    const p = input.prescription
    const prescription: EffectiveAudiencePrescription = {
      id: p.id, distanceKm: p.distanceKm, durationMin: p.durationMin, elevationGain: p.elevationGain,
      intensityMethod: p.intensityMethod, zone: p.zone, referencePercentage: p.referencePercentage, notes: p.notes,
    }
    const resolved = resolveAthletePlanningSession({ athleteId: input.athleteId, session: input.session, prescription, adjustment, revisions: input.revisions })
    if (resolved.status === 'omitted') return { status: 'omitted', vertical: { state: 'omitted' } }
    if (resolved.status !== 'resolved') return conflict()
    const elevation = resolved.prescription.elevationGain
    if (elevation !== null && (!Number.isSafeInteger(elevation) || elevation < 0 || elevation > 2147483647)) return conflict()
    const override = selected.status === 'resolved' && selected.revision.payload.dose?.elevationGain.kind === 'override'
    const changedStimulus = resolved.session.type !== input.session.type || resolved.session.workoutId !== input.session.workoutId
    const read = readVerticalBlockJson(p.verticalBlockJson)
    const block = read.status === 'valid' ? safeBlock(read.block) : null
    let compatible = !changedStimulus && elevation !== null && !(override && elevation === 0)
    if (read.status === 'valid') {
      try {
        // Validate both historical group coherence and the effective total.
        resolveVerticalSessionElevationGain({ block: read.block, proposedSessionElevationGainM: p.elevationGain })
        resolveVerticalSessionElevationGain({ block: read.block, proposedSessionElevationGainM: elevation })
        if (override && elevation !== p.elevationGain && block?.elevationGainTotalM === null) compatible = false
      } catch { compatible = false }
    }
    const state: AthleteVerticalProjection['state'] = elevation === null ? 'effective_unknown'
      : changedStimulus || (block !== null && !compatible) || (override && elevation === 0) ? 'override_incompatible'
      : override ? 'override_consistent' : 'inherited_effective'
    return {
      status: 'resolved', session: resolved.session, prescription: resolved.prescription,
      vertical: {
        state, primaryObjective: resolveVerticalPrimaryObjective({ primaryObjective: p.primaryObjective }),
        effectiveElevationGain: elevation,
        effectiveBlock: compatible ? block : null,
        referenceBlock: compatible ? null : block,
        blockStatus: read.status,
      },
    }
  } catch { return conflict() }
}
