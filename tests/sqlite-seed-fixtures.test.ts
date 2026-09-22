import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const seedRoot = path.join(process.cwd(), 'db', 'seeds')

test('SQLite seed restructuring starts with an explicit team-and-coach feature fixture', () => {
  assert.ok(fs.existsSync(path.join(seedRoot, 'team-and-coach.ts')))
  const fixture = fs.readFileSync(path.join(seedRoot, 'team-and-coach.ts'), 'utf8')
  assert.match(fixture, /seedTeamAndCoach/)
  assert.match(fixture, /trainingLocations/)
  assert.match(fixture, /teams/)
})
