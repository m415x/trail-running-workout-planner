import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'

import { writeVerticalBlockJson } from '../../lib/sessions/vertical-prescription-json'
import type { VerticalBlockV1 } from '../../lib/sessions/vertical-prescription'

const valid: VerticalBlockV1 = {
  schemaVersion: 1,
  direction: 'ascent',
  repetitions: 2,
  coverage: 'complete',
  elevationGainPerRep: { meters: 400, provenance: { kind: 'coach_manual' } },
  elevationLossPerRep: { meters: null, provenance: { kind: 'unknown' } },
}

test('KAN-879 RED-9 read projection differentiates valid, absent, future and corrupt vertical data without rewriting bytes', async () => {
  const modulePath = fileURLToPath(new URL('../../lib/sessions/session-vertical-read-projection.ts', import.meta.url))
  const imported = await import(pathToFileURL(modulePath).href).catch(() => ({}))
  const project = Reflect.get(imported, 'projectVerticalPrescriptionRead') as
    | ((input: { primaryObjective: string | null; verticalBlockJson: string | null }) => {
      primaryObjective: string | null
      verticalBlockJson: string | null
      verticalBlock: { status: string; block?: VerticalBlockV1; schemaVersion?: number }
    })
    | undefined

  assert.equal(typeof project, 'function', 'RED-9: safe vertical read projection is absent')
  if (!project) return

  const serialized = writeVerticalBlockJson(valid)
  assert.ok(serialized)
  const accepted = project({ primaryObjective: 'elevation_gain', verticalBlockJson: serialized })
  assert.equal(accepted.primaryObjective, 'elevation_gain')
  assert.equal(accepted.verticalBlockJson, serialized)
  assert.equal(accepted.verticalBlock.status, 'valid')
  assert.deepEqual(accepted.verticalBlock.block, valid)

  assert.deepEqual(project({ primaryObjective: null, verticalBlockJson: null }).verticalBlock, {
    status: 'absent',
  })

  const future = '{"schemaVersion":99,"other":"future"}'
  const unsupported = project({ primaryObjective: 'elevation_gain', verticalBlockJson: future })
  assert.equal(unsupported.verticalBlock.status, 'unsupported')
  assert.equal(unsupported.verticalBlock.schemaVersion, 99)
  assert.equal(unsupported.verticalBlockJson, future)
  assert.equal(unsupported.verticalBlock.block, undefined,
    'Never represent a future format as a valid v1 block')

  const corrupt = '{corrupt'
  const invalid = project({ primaryObjective: 'elevation_gain', verticalBlockJson: corrupt })
  assert.equal(invalid.verticalBlock.status, 'corrupt')
  assert.equal(invalid.verticalBlockJson, corrupt)
  assert.equal(invalid.verticalBlock.block, undefined,
    'Never expose corrupt bytes as a supported block')
})

test('KAN-879 RED-9 getSessionById remains authorized and exposes safe vertical read projection', () => {
  const source = readFileSync('app/actions/session-actions.ts', 'utf8')
  assert.match(source, /import \{ projectVerticalPrescriptionRead \} from ['"]@\/lib\/sessions\/session-vertical-read-projection['"]/)
  const start = source.indexOf('export async function getSessionById(')
  const end = source.indexOf('export async function getSessionGenerationExplanationReview(', start)
  const read = source.slice(start, end)
  assert.match(read, /planningReadAccess\(\)/)
  assert.match(read, /authorizeSessionRead\(sessionId, planningAccess\)/)
  assert.match(read, /eq\(sessions\.teamId, planningAccess\.teamId\)/)
  assert.match(read, /projectVerticalPrescriptionRead\(/,
    'Authorized Session read must classify stored vertical JSON rather than return untyped v1 assumptions')
})
