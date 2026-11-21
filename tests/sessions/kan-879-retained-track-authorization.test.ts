import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'

import { writeVerticalBlockJson } from '../../lib/sessions/vertical-prescription-json'
import type { VerticalBlockV1 } from '../../lib/sessions/vertical-prescription'

const adopted: VerticalBlockV1 = {
  schemaVersion: 1,
  direction: 'ascent',
  repetitions: 2,
  coverage: 'complete',
  elevationGainPerRep: { meters: 400, provenance: { kind: 'track_adopted', trackReference: 'track-prior' } },
  elevationLossPerRep: { meters: null, provenance: { kind: 'unknown' } },
}

test('KAN-879 RED-14 legacy edit cannot preserve and write a previously adopted unauthorized track', async () => {
  const modulePath = fileURLToPath(new URL('../../lib/sessions/authorized-vertical-track-references.ts', import.meta.url))
  const imported = await import(pathToFileURL(modulePath).href)
  const authorizeEffective = Reflect.get(imported, 'assertAuthorizedEffectiveVerticalTrackReferences') as
    | ((input: {
      prescriptions: Array<{
        groupId: string
        microcycleId: string
        verticalBlock?: VerticalBlockV1 | null
      }>
      previous: Array<{
        microcycleId: string
        verticalBlockJson: string | null
      }>
      authorizeTrack(scope: { groupId: string; trackReference: string }): Promise<boolean>
    }) => Promise<void>)
    | undefined

  assert.equal(typeof authorizeEffective, 'function',
    'RED-14: effective persisted vertical provenance authorization boundary missing')
  if (!authorizeEffective) return

  const previous = [{ microcycleId: 'week-a', verticalBlockJson: writeVerticalBlockJson(adopted) }]
  let checked = 0
  await assert.rejects(() => authorizeEffective({
    previous,
    prescriptions: [{ groupId: 'group-a', microcycleId: 'week-a' }],
    authorizeTrack: async ({ groupId, trackReference }) => {
      checked++
      assert.deepEqual([groupId, trackReference], ['group-a', 'track-prior'])
      return false
    },
  }), /track|authoriz|denied|forbidden/i,
  'Omitting verticalBlockJson must not bypass track authorization for the effective retained dose')
  assert.equal(checked, 1)

  await assert.doesNotReject(() => authorizeEffective({
    previous,
    prescriptions: [{ groupId: 'group-a', microcycleId: 'week-a' }],
    authorizeTrack: async () => true,
  }), 'A verified authorized retained track may survive a legacy-only edit')

  const manual: VerticalBlockV1 = {
    ...adopted,
    elevationGainPerRep: { meters: 400, provenance: { kind: 'coach_manual' } },
  }
  await assert.doesNotReject(() => authorizeEffective({
    previous,
    prescriptions: [{ groupId: 'group-a', microcycleId: 'week-a', verticalBlock: manual }],
    authorizeTrack: async () => { throw new Error('No track lookup expected for explicit coach_manual replacement') },
  }), 'Explicit replacement must validate the new effective block, not an obsolete retained track')

  await assert.doesNotReject(() => authorizeEffective({
    previous,
    prescriptions: [{ groupId: 'group-a', microcycleId: 'week-a', verticalBlock: null }],
    authorizeTrack: async () => { throw new Error('Cleared track must not be authorized') },
  }))
})

test('KAN-879 RED-14 updateSession authorizes effective retained track provenance before mutation', () => {
  const source = readFileSync('app/actions/session-actions.ts', 'utf8')
  const start = source.indexOf('export async function updateSession(')
  const end = source.indexOf('function validatePrescriptionReferences(', start)
  assert.ok(start >= 0 && end > start)
  const update = source.slice(start, end)
  assert.match(update, /await assertAuthorizedEffectiveVerticalTrackReferences\(/,
    'The update action must authorize submitted and retained effective vertical provenance')
  const check = update.indexOf('await assertAuthorizedEffectiveVerticalTrackReferences(')
  const firstWrite = update.indexOf('tx.update(sessions)')
  assert.ok(check >= 0 && firstWrite > check,
    'Effective track authorization must run before Session/prescriptions/audit mutation')
  assert.ok(update.indexOf('const existingPrescriptions =') < check,
    'Read existing active rows before validating retained provenance')
  assert.match(update, /eq\(groupSessionPrescriptions\.isDeleted, false\)/,
    'Do not reauthorize historical deleted prescriptions')
})
