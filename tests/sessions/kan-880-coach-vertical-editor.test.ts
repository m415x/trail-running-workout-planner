import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { parseSessionPrescriptions } from '../../lib/sessions/session-prescription-parser'
import type { VerticalBlockV1, VerticalPrimaryObjective } from '../../lib/sessions/vertical-prescription'

type Previous = { primaryObjective: VerticalPrimaryObjective | null; verticalBlockJson: string | null; elevationGain: number | null }
type ManualBlockDraft = { direction: 'ascent' | 'descent' | 'circuit'; coverage: 'complete' | 'partial'; repetitions: string; gain: string; loss: string }
type Submission = { ok: true; fields: { elevationGain: string; primaryObjective?: string; verticalBlockJson?: string }; totals: { elevationGainTotalM: number | null; elevationLossTotalM: number | null } | null } | { ok: false; error: string }
type Editor = {
  prepareVerticalPrescriptionSubmission(input: { previous: Previous | null; primaryObjective?: VerticalPrimaryObjective | null; block?: ManualBlockDraft | null; elevationGain: string }): Submission
  resolveVerticalTemplateElevation(input: { previous: Previous | null; block?: ManualBlockDraft | null; primaryObjective?: VerticalPrimaryObjective | null; currentElevationGain: string; templateElevationGain: string }): { elevationGain: string; conflict: boolean }
}

async function editor(): Promise<Editor> {
  const path = '../../lib/sessions/vertical-prescription-editor'
  assert.ok(existsSync('lib/sessions/vertical-prescription-editor.ts'), 'Coach form needs an executable vertical draft-to-payload boundary')
  return await import(path) as Editor
}

const complete: ManualBlockDraft = { direction: 'ascent', coverage: 'complete', repetitions: '3', gain: '850', loss: '' }
const block: VerticalBlockV1 = {
  schemaVersion: 1, direction: 'ascent', coverage: 'complete', repetitions: 3,
  elevationGainPerRep: { meters: 850, provenance: { kind: 'coach_manual' } },
  elevationLossPerRep: { meters: null, provenance: { kind: 'unknown' } },
}
const previous: Previous = { primaryObjective: 'elevation_gain', verticalBlockJson: JSON.stringify(block), elevationGain: 2550 }

function fields(result: Submission) {
  assert.equal(result.ok, true)
  if (!result.ok) throw new Error(result.error)
  return result.fields
}

function append(form: FormData, id: string, values: ReturnType<typeof fields>) {
  form.append('prescriptionMicrocycleId', id)
  form.set('prescriptionGroupId:' + id, 'group-a')
  for (const [key, value] of Object.entries(values)) form.set(key + ':' + id, value)
}

test('KAN-880 complete derives the only whole-session D+; manual and unknown provenances round-trip through the real T3 parser', async () => {
  const { prepareVerticalPrescriptionSubmission: prepare } = await editor()
  const result = prepare({ previous: null, primaryObjective: 'elevation_gain', block: complete, elevationGain: '1' })
  const submitted = fields(result)
  assert.equal(submitted.elevationGain, '2550')
  assert.equal(submitted.primaryObjective, 'elevation_gain')
  assert.deepEqual(JSON.parse(submitted.verticalBlockJson!), block)
  assert.deepEqual(result.ok && result.totals, { elevationGainTotalM: 2550, elevationLossTotalM: null })
  const form = new FormData()
  append(form, 'week-a', submitted)
  const parsed = parseSessionPrescriptions(form)
  assert.ok(parsed.success)
  assert.equal(parsed.data[0].elevationGain, 2550)
  assert.deepEqual(parsed.data[0].verticalBlock, block)
})

test('KAN-880 partial subtotal is included, zero differs from unknown, and selected microcycles are independent', async () => {
  const { prepareVerticalPrescriptionSubmission: prepare } = await editor()
  const partial = { ...complete, direction: 'circuit' as const, coverage: 'partial' as const, gain: '200', loss: '0' }
  const a = prepare({ previous: null, primaryObjective: 'duration', block: partial, elevationGain: '900' })
  const b = prepare({ previous: null, block: { ...complete, direction: 'descent', gain: '', loss: '150' }, elevationGain: '900' })
  const form = new FormData()
  append(form, 'week-a', fields(a))
  append(form, 'week-b', fields(b))
  const parsed = parseSessionPrescriptions(form)
  assert.ok(parsed.success)
  const [first, second] = parsed.data
  assert.equal(first.elevationGain, 900)
  assert.equal(first.primaryObjective, 'duration')
  assert.deepEqual(first.verticalBlock?.elevationLossPerRep, { meters: 0, provenance: { kind: 'coach_manual' } })
  assert.equal(second.elevationGain, null)
  assert.equal(second.primaryObjective, undefined)
  assert.deepEqual(second.verticalBlock?.elevationGainPerRep, { meters: null, provenance: { kind: 'unknown' } })
  assert.deepEqual(second.verticalBlock?.elevationLossPerRep, { meters: 150, provenance: { kind: 'coach_manual' } })
  assert.equal(prepare({ previous: null, block: partial, elevationGain: '599' }).ok, false)
  assert.equal(fields(prepare({ previous: null, block: partial, elevationGain: '' })).elevationGain, '')
  assert.equal(fields(prepare({ previous: null, block: { ...partial, gain: '' }, elevationGain: '900' })).elevationGain, '900')
})

test('KAN-880 rejects malformed, fractional, negative and overflowing drafts instead of coercing them into unknown or zero', async () => {
  const { prepareVerticalPrescriptionSubmission: prepare } = await editor()
  for (const bad of [
    { repetitions: '0' }, { repetitions: '1.5' }, { repetitions: '1e2' },
    { gain: '-1' }, { gain: '1.5' }, { gain: 'NaN' }, { loss: 'abc' },
    { repetitions: '3', gain: '2147483647' },
  ]) {
    assert.equal(prepare({ previous: null, block: { ...complete, ...bad }, elevationGain: '' }).ok, false, JSON.stringify(bad))
  }
  assert.equal(prepare({ previous: null, block: { ...complete, coverage: 'partial' }, elevationGain: '-1' }).ok, false)
})

test('KAN-880 unchanged vertical data is omitted, explicit clear is distinct, and opaque history cannot be rewritten or have D+ changed', async () => {
  const { prepareVerticalPrescriptionSubmission: prepare } = await editor()
  assert.deepEqual(fields(prepare({ previous, elevationGain: '2550' })), { elevationGain: '2550' })
  assert.deepEqual(fields(prepare({ previous, block: null, primaryObjective: null, elevationGain: '2550' })), { elevationGain: '2550', primaryObjective: '', verticalBlockJson: '' })
  assert.deepEqual(fields(prepare({ previous: null, elevationGain: '0' })), { elevationGain: '0' })
  for (const raw of ['{"schemaVersion":2,"opaque":true}', '{broken']) {
    const opaque = { ...previous, verticalBlockJson: raw }
    assert.deepEqual(fields(prepare({ previous: opaque, elevationGain: '2550' })), { elevationGain: '2550' })
    assert.equal(prepare({ previous: opaque, elevationGain: '2500' }).ok, false)
    assert.equal(prepare({ previous: opaque, block: complete, elevationGain: '2550' }).ok, false)
    assert.equal(prepare({ previous: opaque, block: null, elevationGain: '2550' }).ok, false)
  }
})

test('KAN-880 historical adopted track remains historical; omission never emits a manual reinterpretation or a new adopted locator', async () => {
  const { prepareVerticalPrescriptionSubmission: prepare } = await editor()
  const historic = { ...previous, verticalBlockJson: JSON.stringify({ ...block, elevationGainPerRep: { meters: 850, provenance: { kind: 'track_adopted', trackReference: 'historic-track' } } }) }
  const result = prepare({ previous: historic, elevationGain: '2550' })
  // A retained adopted block may be rejected by the existing T3 server guard;
  // the UI must not silently recast it as coach_manual to evade that guard.
  if (result.ok) assert.equal(result.fields.verticalBlockJson, undefined)
  else assert.ok(result.error)
  const manual = fields(prepare({ previous: null, block: complete, elevationGain: '' }))
  assert.equal(JSON.parse(manual.verticalBlockJson!).elevationGainPerRep.provenance.kind, 'coach_manual')
})

test('KAN-880 template application preserves vertical decisions and flags conflicting elevation instead of silently replacing it', async () => {
  const { resolveVerticalTemplateElevation: resolve } = await editor()
  assert.deepEqual(resolve({ previous, currentElevationGain: '2550', templateElevationGain: '100' }), { elevationGain: '2550', conflict: true })
  assert.deepEqual(resolve({ previous: null, block: complete, currentElevationGain: '2550', templateElevationGain: '100' }), { elevationGain: '2550', conflict: true })
  assert.deepEqual(resolve({ previous, currentElevationGain: '2550', templateElevationGain: '2550' }), { elevationGain: '2550', conflict: false })
  assert.deepEqual(resolve({ previous: null, currentElevationGain: '50', templateElevationGain: '100' }), { elevationGain: '100', conflict: false })
})

test('KAN-880 production Coach form calls the draft boundary, handles template conflicts and renders vertical controls for selected scopes', () => {
  const source = readFileSync('features/sessions/components/SessionForm.tsx', 'utf8')
  assert.match(source, /prepareVerticalPrescriptionSubmission/, 'CREATE/EDIT must call executable vertical payload validation')
  assert.match(source, /resolveVerticalTemplateElevation/, 'Template application must use the conflict guard')
  assert.match(source, /VerticalPrescriptionEditor/, 'Selected microcycles need a real Coach editor')
  assert.match(source, /verticalBlockJson/, 'Real FormData must transmit edited v1 fields')
  assert.match(source, /primaryObjective/, 'Real FormData must transmit explicit objective changes')
  assert.match(source, /formAction\(formData\)/, 'Retain the authenticated Server Action path')
  const detail = readFileSync('app/[locale]/dashboard/sessions/[sessionId]/page.tsx', 'utf8')
  assert.match(detail, /VerticalPrescriptionSummary/, 'Coach detail must expose a safe read-only vertical summary')
})

test('KAN-880 localized accessible editor and summary exist in ES/EN with track adoption explicitly unavailable', () => {
  const editorPath = 'features/sessions/components/VerticalPrescriptionEditor.tsx'
  const summaryPath = 'features/sessions/components/VerticalPrescriptionSummary.tsx'
  assert.ok(existsSync(editorPath), 'Editor is not yet implemented')
  assert.ok(existsSync(summaryPath), 'Summary is not yet implemented')
  const source = readFileSync(editorPath, 'utf8')
  assert.match(source, /useTranslations\(/)
  assert.match(source, /<fieldset/)
  assert.match(source, /<legend/)
  assert.match(source, /htmlFor=/)
  assert.match(source, /aria-(?:invalid|describedby|live)/)
  for (const locale of ['es', 'en']) {
    const messages = JSON.parse(readFileSync('messages/' + locale + '/planning/sessions.json', 'utf8'))
    const vertical = messages.Sessions.form.prescriptions.vertical
    assert.ok(vertical, locale + ' missing vertical messages')
    for (const key of ['trackUnavailable', 'unknown', 'complete', 'partial', 'unsupported', 'corrupt', 'templateConflict']) {
      assert.equal(typeof vertical[key], 'string', locale + ' missing ' + key)
      assert.ok(vertical[key].trim())
    }
  }
})
