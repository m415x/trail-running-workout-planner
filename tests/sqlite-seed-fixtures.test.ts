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


test('SQLite seed restructuring exposes an explicit groups feature fixture', () => {
  const fixturePath = path.join(seedRoot, 'groups.ts')

  assert.ok(fs.existsSync(fixturePath), 'missing feature seed: groups.ts')
  const fixture = fs.readFileSync(fixturePath, 'utf8')
  assert.match(fixture, /seedGroups/)
  assert.match(fixture, /athleteGroups/)
})


test('SQLite seed restructuring exposes an explicit athletes feature fixture', () => {
  const fixturePath = path.join(seedRoot, 'athletes.ts')

  assert.ok(fs.existsSync(fixturePath), 'missing feature seed: athletes.ts')
  const fixture = fs.readFileSync(fixturePath, 'utf8')
  assert.match(fixture, /seedAthletes/)
  assert.match(fixture, /users/)
  assert.match(fixture, /athleteProfiles/)
  assert.match(fixture, /group/i)
})
