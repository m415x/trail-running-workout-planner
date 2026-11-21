import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'

import type { VerticalBlockV1 } from '../../lib/sessions/vertical-prescription'

function block(trackReference: string): VerticalBlockV1 {
  return {
    schemaVersion: 1,
    direction: 'ascent',
    repetitions: 2,
    coverage: 'complete',
    elevationGainPerRep: {
      meters: 400,
      provenance: { kind: 'track_adopted', trackReference },
    },
    elevationLossPerRep: { meters: null, provenance: { kind: 'unknown' } },
  }
}

test('KAN-879 RED-13 adopted vertical metrics require server-owned track authorization for each affected group', async () => {
  const modulePath = fileURLToPath(new URL('../../lib/sessions/authorized-vertical-track-references.ts', import.meta.url))
  const imported = await import(pathToFileURL(modulePath).href).catch(() => ({}))
  const authorize = Reflect.get(imported, 'assertAuthorizedVerticalTrackReferences') as
    | ((input: {
      prescriptions: Array<{ groupId: string; verticalBlock?: VerticalBlockV1 | null }>
      authorizeTrack: (input: { groupId: string; trackReference: string }) => Promise<boolean>
    }) => Promise<void>)
    | undefined
  assert.equal(typeof authorize, 'function', 'RED-13: server-owned track authorization boundary is absent')
  if (!authorize) return

  const checked: string[] = []
  const authorizeTrack = async ({ groupId, trackReference }: { groupId: string; trackReference: string }) => {
    checked.push(groupId + ':' + trackReference)
    return groupId === 'group-a' && trackReference === 'track-a'
  }

  await assert.doesNotReject(() => authorize({
    prescriptions: [{ groupId: 'group-a', verticalBlock: block('track-a') }],
    authorizeTrack,
  }))
  assert.deepEqual(checked, ['group-a:track-a'])

  await assert.rejects(() => authorize({
    prescriptions: [{ groupId: 'group-b', verticalBlock: block('track-a') }],
    authorizeTrack,
  }), /track|authoriz|denied|forbidden/i,
  'A real track reference valid for another Group must fail closed')

  await assert.rejects(() => authorize({
    prescriptions: [{ groupId: 'group-a', verticalBlock: block('foreign-track') }],
    authorizeTrack,
  }), /track|authoriz|denied|forbidden/i,
  'Arbitrary nonblank references must not be trusted merely because JSON schema validation succeeds')

  const before = checked.length
  await assert.doesNotReject(() => authorize({
    prescriptions: [{
      groupId: 'group-a',
      verticalBlock: { ...block('ignored'), elevationGainPerRep: { meters: 400, provenance: { kind: 'coach_manual' } } },
    }],
    authorizeTrack,
  }))
  assert.equal(checked.length, before, 'Coach-manual metrics must not be treated as adopted tracks')
})

test('KAN-879 RED-13 both mutation Server Actions must authorize track adoption before first write', () => {
  const source = readFileSync('app/actions/session-actions.ts', 'utf8')
  assert.match(source, /import \{ assertAuthorizedVerticalTrackReferences \} from ['"]@\/lib\/sessions\/authorized-vertical-track-references['"]/)
  const create = source.slice(source.indexOf('export async function createSession('),
    source.indexOf('export async function updateSession('))
  const update = source.slice(source.indexOf('export async function updateSession('),
    source.indexOf('function validatePrescriptionReferences('))
  assert.match(create, /await assertAuthorizedVerticalTrackReferences\(/,
    'createSession must reject untrusted track provenance before any insert')
  assert.match(update, /await assertAuthorizedVerticalTrackReferences\(/,
    'updateSession must reject explicit track adoption before any update or audit')
  assert.ok(create.indexOf('await assertAuthorizedVerticalTrackReferences(') < create.indexOf('tx.insert(sessions)'))
  assert.ok(update.indexOf('await assertAuthorizedVerticalTrackReferences(') < update.indexOf('tx.update(sessions)'))
})
