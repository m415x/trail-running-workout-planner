import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import Database from 'better-sqlite3'
import type { AthleteDoseOverrides, AthleteAssignmentOverride, EffectiveAudiencePrescription, SharedSessionEvent } from '../../lib/planning-cohorts/athlete-session-adjustment'
import type { PersistedAthleteSessionAdjustment, PersistedAthleteSessionAdjustmentRevision } from '../../lib/planning-cohorts/athlete-session-adjustment-persistence'
import { resolveAthletePlanningOnDate, type PlanningResolutionPlan, type PlanningResolutionMembership } from '../../lib/planning-cohorts/planning-resolution'
import { resolveAthleteSessionPrescription } from '../../lib/planning-cohorts/athlete-session-prescription'
import type { VerticalBlockV1, VerticalPrimaryObjective } from '../../lib/sessions/vertical-prescription'

type SafeBlock = {
  direction: VerticalBlockV1['direction']
  coverage: VerticalBlockV1['coverage']
  repetitions: number
  elevationGainPerRep: { meters: number | null; provenance: VerticalBlockV1['elevationGainPerRep']['provenance']['kind'] }
  elevationLossPerRep: { meters: number | null; provenance: VerticalBlockV1['elevationLossPerRep']['provenance']['kind'] }
  elevationGainTotalM: number | null
  elevationLossTotalM: number | null
}
type Projection = {
  state: 'inherited_effective' | 'override_consistent' | 'override_incompatible' | 'effective_unknown' | 'omitted' | 'authority_conflict'
  primaryObjective?: VerticalPrimaryObjective | null
  effectiveElevationGain?: number | null
  effectiveBlock?: SafeBlock | null
  referenceBlock?: SafeBlock | null
  blockStatus?: 'absent' | 'valid' | 'unsupported' | 'corrupt'
}
type Source = EffectiveAudiencePrescription & {
  primaryObjective: VerticalPrimaryObjective | null
  verticalBlockJson: string | null
}
type Input = {
  teamId: string
  athleteId: string
  session: SharedSessionEvent
  prescription: Source
  adjustments: PersistedAthleteSessionAdjustment[]
  revisions: PersistedAthleteSessionAdjustmentRevision[]
}
type Outcome =
  | { status: 'resolved'; session: SharedSessionEvent; prescription: EffectiveAudiencePrescription; vertical: Projection }
  | { status: 'omitted' | 'conflict'; vertical: Projection }
type Module = {
  resolveAthleteEffectiveVerticalSession(input: Input): Outcome
}

async function load(): Promise<Module> {
  const path = '../../lib/athlete-planning/effective-vertical-session'
  assert.ok(existsSync('lib/athlete-planning/effective-vertical-session.ts'), 'Athlete requires a safe effective vertical resolver downstream of the exact selected prescription')
  return await import(path) as Module
}

const block: VerticalBlockV1 = {
  schemaVersion: 1, direction: 'ascent', repetitions: 3, coverage: 'complete',
  elevationGainPerRep: { meters: 850, provenance: { kind: 'coach_manual' } },
  elevationLossPerRep: { meters: null, provenance: { kind: 'unknown' } },
}
const source: Source = {
  id: 'prescription-1', distanceKm: 12, durationMin: 120, elevationGain: 2550,
  intensityMethod: 'hr_zone', zone: 'Z2', referencePercentage: null, notes: 'Group instructions',
  primaryObjective: 'elevation_gain', verticalBlockJson: JSON.stringify(block),
}
const session: SharedSessionEvent = { id: 'session-1', date: '2026-11-25', workoutId: 'trail-1', type: 'Trail' }
const adjustment: PersistedAthleteSessionAdjustment = { id: 'adjustment-1', teamId: 'team-1', athleteId: 'athlete-1', sourcePrescriptionId: source.id }
const input: Input = { teamId: 'team-1', athleteId: 'athlete-1', session, prescription: source, adjustments: [], revisions: [] }

function dose(value: number | null): AthleteDoseOverrides {
  return { distanceKm: { kind: 'inherit' }, durationMin: { kind: 'inherit' }, elevationGain: { kind: 'override', value }, intensity: { kind: 'inherit' } }
}
function revision(d: AthleteDoseOverrides | null, assignment: AthleteAssignmentOverride = { kind: 'inherit' }, extra: Partial<PersistedAthleteSessionAdjustmentRevision> = {}): PersistedAthleteSessionAdjustmentRevision {
  return { id: 'revision-1', adjustmentId: adjustment.id, state: 'active', payload: { dose: d, assignment }, reason: 'Coach', changedByUserId: 'coach-1', isCurrent: true, ...extra }
}
function adjusted(r: PersistedAthleteSessionAdjustmentRevision, prescription = source): Input {
  return { ...input, prescription, adjustments: [adjustment], revisions: [r] }
}
function resolved(result: Outcome) {
  if (result.status !== 'resolved') assert.fail('Expected resolved Athlete dose')
  return result
}

test('KAN-881 absent adjustment, null dose, inherited elevation and withdrawn revision preserve the group block', async () => {
  const { resolveAthleteEffectiveVerticalSession: resolve } = await load()
  for (const value of [input, adjusted(revision(null)), adjusted(revision({ ...dose(100), elevationGain: { kind: 'inherit' } })), adjusted(revision(dose(100), { kind: 'inherit' }, { state: 'withdrawn' }))]) {
    const result = resolved(resolve(value))
    assert.equal(result.prescription.id, source.id)
    assert.equal(result.prescription.elevationGain, 2550)
    assert.equal(result.vertical.state, 'inherited_effective')
    assert.equal(result.vertical.effectiveElevationGain, 2550)
    assert.equal(result.vertical.effectiveBlock?.repetitions, 3)
    assert.equal(result.vertical.effectiveBlock?.elevationGainTotalM, 2550)
    assert.equal(result.vertical.effectiveBlock?.elevationLossTotalM, null)
    assert.equal(result.vertical.referenceBlock, null)
  }
})

test('KAN-881 exact override, incompatible override, zero and explicit null are not conflated', async () => {
  const { resolveAthleteEffectiveVerticalSession: resolve } = await load()
  const cases = [
    { value: 2550, state: 'override_consistent', effective: true },
    { value: 1800, state: 'override_incompatible', effective: false },
    { value: 0, state: 'override_incompatible', effective: false },
    { value: null, state: 'effective_unknown', effective: false },
  ] as const
  for (const c of cases) {
    const result = resolved(resolve(adjusted(revision(dose(c.value)))))
    assert.equal(result.prescription.elevationGain, c.value)
    assert.equal(result.vertical.effectiveElevationGain, c.value)
    assert.equal(result.vertical.state, c.state)
    assert.equal(Boolean(result.vertical.effectiveBlock), c.effective)
    assert.equal(Boolean(result.vertical.referenceBlock), !c.effective)
    assert.equal(result.vertical.primaryObjective, 'elevation_gain')
    assert.equal(result.prescription.distanceKm, 12)
  }
  assert.equal(source.elevationGain, 2550)
})

test('KAN-881 partial overrides retain coverage and require a known compatible subtotal when the dose changes', async () => {
  const { resolveAthleteEffectiveVerticalSession: resolve } = await load()
  const partial: VerticalBlockV1 = { ...block, coverage: 'partial', repetitions: 4, elevationGainPerRep: { meters: 200, provenance: { kind: 'coach_manual' } }, elevationLossPerRep: { meters: 0, provenance: { kind: 'coach_manual' } } }
  const p = { ...source, elevationGain: 1000, verticalBlockJson: JSON.stringify(partial) }
  const compatible = resolved(resolve(adjusted(revision(dose(900)), p))).vertical
  assert.equal(compatible.state, 'override_consistent')
  assert.equal(compatible.effectiveBlock?.coverage, 'partial')
  assert.equal(compatible.effectiveBlock?.elevationGainTotalM, 800)
  assert.equal(compatible.effectiveBlock?.elevationLossTotalM, 0)
  assert.equal(compatible.effectiveElevationGain, 900)
  assert.equal(resolved(resolve(adjusted(revision(dose(799)), p))).vertical.state, 'override_incompatible')
  const unknown = { ...p, verticalBlockJson: JSON.stringify({ ...partial, elevationGainPerRep: { meters: null, provenance: { kind: 'unknown' } } }) }
  assert.equal(resolved(resolve(adjusted(revision(dose(900)), unknown))).vertical.state, 'override_incompatible')
  assert.equal(resolved(resolve(adjusted(revision(dose(1000)), unknown))).vertical.effectiveBlock?.coverage, 'partial')
})

test('KAN-881 replaced stimulus cannot claim inherited group repetitions as effective; rescheduling retains the exact source', async () => {
  const { resolveAthleteEffectiveVerticalSession: resolve } = await load()
  const changed = resolved(resolve(adjusted(revision(null, { kind: 'stimulus_override', type: 'Rest', workoutId: null }))))
  assert.equal(changed.prescription.elevationGain, 2550)
  assert.equal(changed.vertical.state, 'override_incompatible')
  assert.equal(changed.vertical.effectiveBlock, null)
  assert.equal(changed.vertical.referenceBlock?.repetitions, 3)
  const moved = resolved(resolve(adjusted(revision(null, { kind: 'rescheduled', date: '2026-11-28' }))))
  assert.equal(moved.session.date, '2026-11-28')
  assert.equal(moved.prescription.id, source.id)
  assert.equal(moved.vertical.state, 'inherited_effective')
})

test('KAN-881 omission and effective authority conflicts disclose no vertical dose or source block', async () => {
  const { resolveAthleteEffectiveVerticalSession: resolve } = await load()
  const omit = resolve(adjusted(revision(null, { kind: 'omitted' })))
  assert.deepEqual(omit, { status: 'omitted', vertical: { state: 'omitted' } })
  const valid = adjusted(revision(dose(1800)))
  for (const bad of [
    { ...valid, adjustments: [{ ...adjustment, teamId: 'team-other' }] },
    { ...valid, adjustments: [{ ...adjustment, athleteId: 'athlete-other' }] },
    { ...valid, adjustments: [{ ...adjustment, sourcePrescriptionId: 'other-prescription' }] },
    { ...valid, adjustments: [adjustment, { ...adjustment, id: 'duplicate' }] },
    { ...valid, revisions: [revision(dose(1800)), revision(dose(100), { kind: 'inherit' }, { id: 'duplicate-current' })] },
  ]) {
    assert.deepEqual(resolve(bad), { status: 'conflict', vertical: { state: 'authority_conflict' } })
  }
  const historical = resolved(resolve({ ...valid, revisions: [revision(dose(10), { kind: 'inherit' }, { id: 'old', isCurrent: false }), revision(dose(1800))] }))
  assert.equal(historical.prescription.elevationGain, 1800)
})

test('KAN-881 legacy, unsupported and corrupt records retain only authorized numeric dose, never opaque payload or track locator', async () => {
  const { resolveAthleteEffectiveVerticalSession: resolve } = await load()
  for (const [raw, status] of [[null, 'absent'], ['{"schemaVersion":2,"secret":"future-private"}', 'unsupported'], ['{private-corrupt', 'corrupt']] as const) {
    const result = resolved(resolve({ ...input, prescription: { ...source, primaryObjective: null, verticalBlockJson: raw } }))
    assert.equal(result.prescription.elevationGain, 2550)
    assert.equal(result.vertical.primaryObjective, null)
    assert.equal(result.vertical.blockStatus, status)
    assert.equal(result.vertical.effectiveBlock, null)
    assert.equal(result.vertical.referenceBlock, null)
    assert.equal('verticalBlockJson' in result.prescription, false)
    assert.doesNotMatch(JSON.stringify(result), /future-private|private-corrupt/)
  }
  const historic = { ...block, elevationGainPerRep: { meters: 850, provenance: { kind: 'track_adopted', trackReference: 'private-track-locator' } } }
  const result = resolved(resolve({ ...input, prescription: { ...source, verticalBlockJson: JSON.stringify(historic) } }))
  assert.equal(result.vertical.effectiveBlock?.elevationGainPerRep.provenance, 'track_adopted')
  assert.doesNotMatch(JSON.stringify(result), /private-track-locator/)
})

test('KAN-881 dated authority selects Variant first, Base only outside its date, never sparse session fallback; SQLite rows retain exact prescription and revision identity', async () => {
  const { resolveAthleteEffectiveVerticalSession: resolve } = await load()
  const db = new Database(':memory:')
  try {
    db.exec("CREATE TABLE prescriptions(id TEXT PRIMARY KEY, plan_id TEXT, gain INTEGER, block_json TEXT); CREATE TABLE adjustments(id TEXT PRIMARY KEY, team_id TEXT, athlete_id TEXT, source_id TEXT); CREATE TABLE revisions(id TEXT PRIMARY KEY, adjustment_id TEXT, current INTEGER, gain INTEGER);")
    db.prepare('INSERT INTO prescriptions VALUES (?, ?, ?, ?)').run('base-p', 'base-plan', 2550, JSON.stringify(block))
    db.prepare('INSERT INTO prescriptions VALUES (?, ?, ?, ?)').run('variant-p', 'variant-plan', 900, JSON.stringify({ ...block, repetitions: 3, elevationGainPerRep: { meters: 300, provenance: { kind: 'coach_manual' } } }))
    db.prepare('INSERT INTO adjustments VALUES (?, ?, ?, ?)').run('base-adjustment', 'team-1', 'athlete-1', 'base-p')
    db.prepare('INSERT INTO adjustments VALUES (?, ?, ?, ?)').run('variant-adjustment', 'team-1', 'athlete-1', 'variant-p')
    db.prepare('INSERT INTO adjustments VALUES (?, ?, ?, ?)').run('other-adjustment', 'team-1', 'athlete-other', 'variant-p')
    db.prepare('INSERT INTO revisions VALUES (?, ?, ?, ?)').run('old-revision', 'variant-adjustment', 0, 777)
    db.prepare('INSERT INTO revisions VALUES (?, ?, ?, ?)').run('current-revision', 'variant-adjustment', 1, 0)
    db.prepare('INSERT INTO revisions VALUES (?, ?, ?, ?)').run('base-revision', 'base-adjustment', 1, 100)
    db.prepare('INSERT INTO revisions VALUES (?, ?, ?, ?)').run('other-revision', 'other-adjustment', 1, 555)
    const base: PlanningResolutionPlan = { id: 'base-plan', groupId: 'group-1', planningCohortId: null, status: 'active', isDeleted: false, macrocycles: [{ startDate: '2026-11-01', endDate: '2026-11-30', isDeleted: false }] }
    const variant: PlanningResolutionPlan = { ...base, id: 'variant-plan', planningCohortId: 'cohort-1', macrocycles: [{ startDate: '2026-11-20', endDate: '2026-11-30', isDeleted: false }] }
    const memberships: PlanningResolutionMembership[] = [{ id: 'membership-1', startDate: '2026-11-01', endDate: null, isDeleted: false, cohort: { id: 'cohort-1', teamId: 'team-1', groupId: 'group-1', status: 'active', isDeleted: false, planningVariant: variant } }]
    const plan = (date: string) => resolveAthletePlanningOnDate({ athleteTeamId: 'team-1', currentGroupId: 'group-1', groupChanges: [], memberships, basePlans: [base], date })
    const rows = db.prepare('SELECT id, plan_id AS groupTrainingPlanId, gain AS elevationGain, block_json AS verticalBlockJson FROM prescriptions').all() as Array<{ id: string; groupTrainingPlanId: string; elevationGain: number; verticalBlockJson: string }>
    const candidates = rows.map(row => ({ ...row, groupId: 'group-1', microcycleId: row.id + '-micro' }))
    const chosen = resolveAthleteSessionPrescription({ planning: plan('2026-11-25'), prescriptions: candidates })
    if (chosen.status !== 'resolved') assert.fail('Variant must resolve')
    assert.equal(chosen.prescriptionId, 'variant-p')
    assert.equal(resolveAthleteSessionPrescription({ planning: plan('2026-11-25'), prescriptions: candidates.filter(row => row.id === 'base-p') }).status, 'none')
    const baseChosen = resolveAthleteSessionPrescription({ planning: plan('2026-11-10'), prescriptions: candidates })
    if (baseChosen.status !== 'resolved') assert.fail('Base must resolve outside Variant dates')
    assert.equal(baseChosen.prescriptionId, 'base-p')
    const selected = rows.find(row => row.id === chosen.prescriptionId)!
    const adjustments = db.prepare('SELECT id, team_id AS teamId, athlete_id AS athleteId, source_id AS sourcePrescriptionId FROM adjustments WHERE athlete_id = ? AND source_id = ?').all(input.athleteId, selected.id) as PersistedAthleteSessionAdjustment[]
    const rawRevisions = db.prepare('SELECT id, adjustment_id AS adjustmentId, current, gain FROM revisions WHERE adjustment_id = ?').all(adjustments[0].id) as Array<{ id: string; adjustmentId: string; current: number; gain: number }>
    const revisions = rawRevisions.map(row => revision(dose(row.gain), { kind: 'inherit' }, { id: row.id, adjustmentId: row.adjustmentId, isCurrent: Boolean(row.current) }))
    const result = resolved(resolve({ ...input, prescription: { ...source, ...selected }, adjustments, revisions }))
    assert.equal(result.prescription.id, 'variant-p')
    assert.equal(result.prescription.elevationGain, 0)
    assert.equal(result.vertical.effectiveBlock, null)
  } finally { db.close() }
})

test('KAN-881 Home and Plan production readers call the same effective resolver; Athlete UI renders safe projection and localized states', () => {
  const source = readFileSync('app/actions/dashboard-actions.ts', 'utf8')
  const week = source.slice(source.indexOf('export async function getCurrentAthletePlanningWeek'), source.indexOf('export async function getCurrentAthletePlanningPeriod'))
  const period = source.slice(source.indexOf('export async function getCurrentAthletePlanningPeriod'), source.indexOf('export async function getAthleteShoes'))
  for (const reader of [week, period]) {
    assert.match(reader, /resolveAthleteEffectiveVerticalSession/, 'Both reader paths must project the exact effective vertical dose')
    assert.match(reader, /vertical:\s*plannedSession\.vertical/)
    assert.doesNotMatch(reader, /\.\.\.sourcePrescription,/, 'Raw group fields must not leak through a spread into Athlete output')
  }
  const card = readFileSync('features/athlete-planning/components/AthleteSessionCard.tsx', 'utf8')
  assert.match(card, /AthleteVerticalPrescription/)
  const home = readFileSync('app/[locale]/(mobile)/page.tsx', 'utf8')
  assert.match(home, /getCurrentAthletePlanningWeek/)
  const component = 'features/athlete-planning/components/AthleteVerticalPrescription.tsx'
  assert.ok(existsSync(component))
  assert.match(readFileSync(component, 'utf8'), /referenceBlock/)
  assert.match(readFileSync(component, 'utf8'), /effectiveBlock/)
  for (const locale of ['es', 'en']) {
    const catalog = JSON.parse(readFileSync('messages/' + locale + '/athletes/plan.json', 'utf8')).AthletePlan.session.vertical
    for (const key of ['inherited_effective', 'override_consistent', 'override_incompatible', 'effective_unknown', 'referenceOnly', 'effectiveBlock', 'unknown']) {
      assert.ok(typeof catalog?.[key] === 'string' && catalog[key].trim(), locale + ' missing ' + key)
    }
  }
})
