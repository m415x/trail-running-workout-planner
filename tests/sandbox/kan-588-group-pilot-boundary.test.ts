import assert from 'node:assert/strict'
import test from 'node:test'
import { inspectGroupPilotIntent } from '../../lib/groups/group-pilot-intent'

const local = 'postgresql://postgres:fixture-not-a-secret@127.0.0.1:54322/postgres'

test('KAN-588/G1 permits only explicit isolated synthetic Group pilot intent', () => {
  assert.deepEqual(inspectGroupPilotIntent({
    surface: 'synthetic_test',
    operation: 'getGroupsByTeam',
    directUrl: local,
  }), { accepted: true, operation: 'getGroupsByTeam' })
})

test('KAN-588/G1 rejects non-pilot operations, production surface, and implicit or remote target', () => {
  for (const request of [
    { surface: 'synthetic_test', operation: 'getGroupWithMembers', directUrl: local },
    { surface: 'synthetic_test', operation: 'getEligibleAthletesForGroup', directUrl: local },
    { surface: 'product', operation: 'createGroup', directUrl: local },
    { surface: 'synthetic_test', operation: 'updateGroup' },
    { surface: 'synthetic_test', operation: 'getGroupById', directUrl: 'postgresql://postgres:fiction@localhost:54322/postgres' },
    { surface: 'synthetic_test', operation: 'getGroupById', directUrl: 'postgresql://postgres:fiction@db.example.supabase.co:5432/postgres' },
  ]) {
    assert.throws(() => inspectGroupPilotIntent(request), /sandbox|intent|operation|destination|endpoint|surface/i)
  }
})

test('KAN-588/G1 scope gate is purely declarative and cannot return a driver or execute operation', () => {
  const inspected = inspectGroupPilotIntent({
    surface: 'synthetic_test',
    operation: 'updateGroup',
    directUrl: local,
  })
  assert.deepEqual(Object.keys(inspected).sort(), ['accepted', 'operation'])
})
