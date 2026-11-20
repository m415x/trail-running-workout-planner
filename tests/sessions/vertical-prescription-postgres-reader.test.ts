import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

test('KAN-878 RED-13 PostgreSQL reader keeps Session + microcycle identity and vertical JSON states', async () => {
  const modulePath = fileURLToPath(new URL('../../lib/sessions/vertical-prescription-postgres-reader.ts', import.meta.url))
  const module = await import(pathToFileURL(modulePath).href).catch(() => ({}))
  const read = Reflect.get(module, 'readVerticalPrescriptionPostgres')
  assert.equal(typeof read, 'function', 'KAN-878 RED-13: scoped PostgreSQL vertical prescription reader is missing')

  const block = {
    schemaVersion: 1,
    direction: 'ascent',
    repetitions: 2,
    coverage: 'complete',
    elevationGainPerRep: { meters: 400, provenance: { kind: 'coach_manual' } },
    elevationLossPerRep: { meters: null, provenance: { kind: 'unknown' } },
  }

  const rows = new Map<string, {
    id: string
    elevationGain: number | null
    primaryObjective: string | null
    verticalBlockJson: string | null
  }>([
    ['session-a::microcycle-a', {
      id: 'prescription-a',
      elevationGain: 650,
      primaryObjective: null,
      verticalBlockJson: null,
    }],
  ])
  const statements: string[] = []
  const tx = async (strings: TemplateStringsArray, ...params: unknown[]) => {
    const sql = strings.join('?')
    statements.push(sql)
    assert.match(sql, /group_session_prescriptions/i)
    assert.match(sql, /session_id/i)
    assert.match(sql, /microcycle_id/i)
    assert.match(sql, /is_deleted/i)
    assert.equal(params.length, 2, 'Both identity dimensions must be parameters')
    return rows.has(`${params[0]}::${params[1]}`) ? [rows.get(`${params[0]}::${params[1]}`)] : []
  }

  const scope = { sessionId: 'session-a', microcycleId: 'microcycle-a' }
  const legacy = await read(tx, scope)
  assert.deepEqual(legacy, {
    status: 'found',
    prescriptionId: 'prescription-a',
    primaryObjective: null,
    elevationGain: 650,
    verticalBlock: { status: 'absent' },
  })
  assert.deepEqual(await read(tx, { sessionId: 'session-a', microcycleId: 'other' }), { status: 'not_found' })

  rows.set('session-a::microcycle-a', {
    id: 'prescription-a',
    elevationGain: 800,
    primaryObjective: 'elevation_gain',
    verticalBlockJson: JSON.stringify(block),
  })
  assert.deepEqual(await read(tx, scope), {
    status: 'found',
    prescriptionId: 'prescription-a',
    primaryObjective: 'elevation_gain',
    elevationGain: 800,
    verticalBlock: { status: 'valid', block },
  })

  rows.get('session-a::microcycle-a')!.verticalBlockJson = JSON.stringify({ ...block, schemaVersion: 2 })
  assert.deepEqual((await read(tx, scope)).verticalBlock, { status: 'unsupported', schemaVersion: 2 })
  rows.get('session-a::microcycle-a')!.verticalBlockJson = '{bad'
  assert.deepEqual((await read(tx, scope)).verticalBlock, { status: 'corrupt' })
  assert.equal(statements.length, 5)
})
