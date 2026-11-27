import { calculateVerticalBlockTotals, resolveVerticalPrimaryObjective, resolveVerticalSessionElevationGain, type VerticalBlockV1, type VerticalBlockTotals, type VerticalCoverage, type VerticalDirection, type VerticalMetricPerRepetition, type VerticalPrimaryObjective } from './vertical-prescription'
import { readVerticalBlockJson, writeVerticalBlockJson } from './vertical-prescription-json'
import { parseRegionalNumericInput } from '../numeric/regional-numeric-input'

export interface PreviousVerticalPrescription {
  primaryObjective: VerticalPrimaryObjective | null
  verticalBlockJson: string | null
  elevationGain: number | null
}

export interface ManualVerticalBlockDraft {
  direction: VerticalDirection
  coverage: VerticalCoverage
  repetitions: string
  gain: string
  loss: string
}

export interface VerticalPrescriptionDraft {
  primaryObjective?: VerticalPrimaryObjective | null
  /** undefined retains persisted bytes; null is an explicit removal */
  block?: ManualVerticalBlockDraft | null
}

export type VerticalEditorError = 'invalidBlock' | 'invalidTotal' | 'opaqueHistory' | 'historicalTrack'

const MAX_METERS = 2_147_483_647
const toInput = (value: number | null) => value === null ? '' : String(value)

function optionalInteger(raw: string): number | null {
  const parsed = parseRegionalNumericInput(raw, { kind: 'integer' })
  if (parsed.status === 'empty') return null
  if (parsed.status !== 'valid' || parsed.value < 0 || parsed.value > MAX_METERS) {
    throw new RangeError('Invalid vertical integer')
  }
  return parsed.value
}

function manualMetric(raw: string): VerticalMetricPerRepetition {
  const meters = optionalInteger(raw)
  return { meters, provenance: { kind: meters === null ? 'unknown' : 'coach_manual' } }
}

export function parseManualVerticalBlock(draft: ManualVerticalBlockDraft): VerticalBlockV1 {
  const repetitions = optionalInteger(draft.repetitions)
  if (repetitions === null || repetitions === 0) throw new RangeError('Invalid repetitions')
  const block: VerticalBlockV1 = {
    schemaVersion: 1,
    direction: draft.direction,
    coverage: draft.coverage,
    repetitions,
    elevationGainPerRep: manualMetric(draft.gain),
    elevationLossPerRep: manualMetric(draft.loss),
  }
  calculateVerticalBlockTotals(block)
  return block
}

export function hasHistoricalTrack(block: VerticalBlockV1) {
  return block.elevationGainPerRep.provenance.kind === 'track_adopted'
    || block.elevationLossPerRep.provenance.kind === 'track_adopted'
}

export function manualDraftFromBlock(block: VerticalBlockV1): ManualVerticalBlockDraft {
  if (hasHistoricalTrack(block)) throw new RangeError('Historical track provenance cannot be recast as manual')
  return {
    direction: block.direction,
    coverage: block.coverage,
    repetitions: String(block.repetitions),
    gain: toInput(block.elevationGainPerRep.meters),
    loss: toInput(block.elevationLossPerRep.meters),
  }
}

export function initialManualVerticalBlock(): ManualVerticalBlockDraft {
  return { direction: 'ascent', coverage: 'partial', repetitions: '1', gain: '', loss: '' }
}

type Submission =
  | { ok: true; fields: { elevationGain: string; primaryObjective?: string; verticalBlockJson?: string }; totals: VerticalBlockTotals | null }
  | { ok: false; error: VerticalEditorError }

export function prepareVerticalPrescriptionSubmission(input: VerticalPrescriptionDraft & {
  previous: PreviousVerticalPrescription | null
  elevationGain: string
}): Submission {
  const read = readVerticalBlockJson(input.previous?.verticalBlockJson ?? null)
  const fields: { elevationGain: string; primaryObjective?: string; verticalBlockJson?: string } = { elevationGain: input.elevationGain }
  if (read.status === 'unsupported' || read.status === 'corrupt') {
    // An opaque block is not editable or removable here. Legacy unrelated edits
    // may retain the exact bytes; no objective or elevation reinterpretation.
    if (input.block !== undefined || input.primaryObjective !== undefined || input.elevationGain !== toInput(input.previous?.elevationGain ?? null)) {
      return { ok: false, error: 'opaqueHistory' }
    }
    return { ok: true, fields, totals: null }
  }

  if (read.status === 'valid' && hasHistoricalTrack(read.block) && input.block !== null) {
    // T3 rejects retained adopted references without server-owned authority.
    // Never bypass that guard by translating a retained track into manual data.
    return { ok: false, error: 'historicalTrack' }
  }

  let effective: VerticalBlockV1 | null
  let totals: VerticalBlockTotals | null
  try {
    if (input.primaryObjective !== undefined) {
      fields.primaryObjective = resolveVerticalPrimaryObjective({ primaryObjective: input.primaryObjective }) ?? ''
    }
    effective = input.block === undefined
      ? read.status === 'valid' ? read.block : null
      : input.block === null ? null : parseManualVerticalBlock(input.block)
    totals = effective ? calculateVerticalBlockTotals(effective) : null
    if (input.block !== undefined) fields.verticalBlockJson = writeVerticalBlockJson(effective) ?? ''
  } catch {
    return { ok: false, error: 'invalidBlock' }
  }

  try {
    // For explicit complete edits, the block alone determines the whole dose.
    // For retained complete blocks, reject inconsistent historical D+ rather
    // than rewriting it silently on unrelated edits.
    const proposed = effective?.coverage === 'complete' && input.block !== undefined
      ? totals!.elevationGainTotalM
      : optionalInteger(input.elevationGain)
    const elevation = effective
      ? resolveVerticalSessionElevationGain({ block: effective, proposedSessionElevationGainM: proposed })
      : proposed
    fields.elevationGain = toInput(elevation)
    return { ok: true, fields, totals }
  } catch {
    return { ok: false, error: 'invalidTotal' }
  }
}

/** Protect historical and current explicit decisions, including an explicit clear. */
export function hasVerticalDecision(input: VerticalPrescriptionDraft & { previous: PreviousVerticalPrescription | null }): boolean {
  return input.block !== undefined || input.primaryObjective !== undefined
    || input.previous?.verticalBlockJson != null || input.previous?.primaryObjective != null
}

export function resolveVerticalTemplateElevation(input: VerticalPrescriptionDraft & {
  previous: PreviousVerticalPrescription | null
  currentElevationGain: string
  templateElevationGain: string
}): { elevationGain: string; conflict: boolean } {
  if (!hasVerticalDecision(input)) return { elevationGain: input.templateElevationGain, conflict: false }
  const prepared = prepareVerticalPrescriptionSubmission({ ...input, elevationGain: input.currentElevationGain })
  const current = prepared.ok ? prepared.fields.elevationGain : input.currentElevationGain
  return { elevationGain: current, conflict: current !== input.templateElevationGain }
}
