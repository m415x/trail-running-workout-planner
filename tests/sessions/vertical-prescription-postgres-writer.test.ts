import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

test('KAN-878 RED-14 PostgreSQL vertical manual writer uses caller transaction, before/after audit, no mutation on DENY and idempotence', async () => {
  const modulePath = fileURLToPath(new URL('../../lib/sessions/vertical-prescription-postgres-writer.ts', import.meta.url))
  const importedModule = await import(pathToFileURL(modulePath).href).catch(() => ({}))
  const persist = Reflect.get(importedModule, 'persistVerticalPrescriptionPostgres')
  assert.equal(typeof persist, 'function', 'KAN-878 RED-14: caller-transaction PostgreSQL writer missing')

  const block = {
    schemaVersion: 1,
    direction: 'ascent',
    repetitions: 2,
    coverage: 'complete',
    elevationGainPerRep: { meters: 400, provenance: { kind: 'coach_manual' } },
    elevationLossPerRep: { meters: null, provenance: { kind: 'unknown' } },
  }
  const command = {
    sessionId: 'session-a', microcycleId: 'microcycle-a', planId: 'plan-a',
    userId: 'coach-a', now: '2026-11-20T00:00:00Z', authorized: true,
    primaryObjective: 'elevation_gain', elevationGain: 800, verticalBlock: block,
  }
  const row = {
    id: 'prescription-a',
    elevationGain: 650 as number | string | null,
    primaryObjective: null as string | null,
    verticalBlockJson: null as string | null,
  }
  const audits: Array<{ before: unknown; after: unknown; action: string; ownership: string }> = []
  const statements: string[] = []
  let injectAuditError = false
  const tx = async (strings: TemplateStringsArray, ...params: unknown[]): Promise<Array<Record<string, unknown>>> => {
    const sql = strings.join('?').replace(/\\s+/g, ' ').trim()
    statements.push(sql)
    if (/^SELECT /i.test(sql)) {
      assert.match(sql, /group_session_prescriptions/)
      assert.match(sql, /FOR UPDATE/i, 'Writer must lock the target prescription in caller transaction')
      assert.match(sql, /session_id/i)
      assert.match(sql, /microcycle_id/i)
      assert.match(sql, /is_deleted/i)
      assert.match(sql, /generation_ownership/i)
      assert.deepEqual(params, ['session-a', 'microcycle-a'])
      return [{ ...row }]
    }
    if (/^UPDATE /i.test(sql)) {
      assert.match(sql, /group_session_prescriptions/)
      assert.match(sql, /primary_objective/)
      assert.match(sql, /vertical_block_json/)
      assert.match(sql, /elevation_gain/)
      assert.match(sql, /RETURNING/i, 'Mutation must verify affected row')
      assert.ok(params.includes('prescription-a'))
      row.elevationGain = 800
      row.primaryObjective = 'elevation_gain'
      row.verticalBlockJson = JSON.stringify(block)
      return [{ id: row.id }]
    }
    if (/^INSERT /i.test(sql)) {
      assert.match(sql, /session_generation_modification_records/)
      assert.match(sql, /manual_modified/)
      assert.match(sql, /manual/)
      if (injectAuditError) throw new Error('injected audit failure')
      const json = params.filter((v): v is string => typeof v === 'string' && v.startsWith('{'))
      assert.equal(json.length, 2, 'Both before/after snapshots must be passed to SQL')
      audits.push({
        before: JSON.parse(json[0]),
        after: JSON.parse(json[1]),
        action: 'manual_modified',
        ownership: 'manual',
      })
      return []
    }
    throw new Error(`Unexpected PostgreSQL operation: ${sql}`)
  }

  assert.equal(await persist(tx, command), 'updated')
  assert.equal(statements.length, 3, 'One SELECT, one UPDATE and one audit INSERT')
  assert.deepEqual(audits, [{
    before: { elevationGain: 650, primaryObjective: null, verticalBlockJson: null },
    after: { elevationGain: 800, primaryObjective: 'elevation_gain', verticalBlockJson: JSON.stringify(block) },
    action: 'manual_modified', ownership: 'manual',
  }])

  assert.equal(await persist(tx, command), 'unchanged')
  assert.equal(statements.length, 4, 'Replay must read but not mutate or duplicate audit')
  assert.equal(audits.length, 1)

  const beforeDeny = statements.length
  await assert.rejects(() => persist(tx, { ...command, authorized: false }), /authoriz|denied|forbidden/i)
  assert.equal(statements.length, beforeDeny, 'DENY must not issue SQL')
  injectAuditError = true
  await assert.rejects(
    () => persist(tx, { ...command, elevationGain: 900, verticalBlock: { ...block, coverage: 'partial' } }),
    /injected audit failure/,
  )
  assert.equal(audits.length, 1, 'Failed audit must not be reported as committed')
  // A double SQL cannot establish rollback. That requires a separate real PG transaction test.
})
