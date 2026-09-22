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


test('SQLite seed restructuring exposes an explicit competitions feature fixture', () => {
  const fixturePath = path.join(seedRoot, 'competitions.ts')

  assert.ok(fs.existsSync(fixturePath), 'missing feature seed: competitions.ts')
  const fixture = fs.readFileSync(fixturePath, 'utf8')
  assert.match(fixture, /seedCompetitions/)
  assert.match(fixture, /fieldPerformanceTestEvents|competition/i)
  assert.match(fixture, /group/i)
})


test('SQLite seed restructuring exposes an explicit cohorts feature fixture', () => {
  const fixturePath = path.join(seedRoot, 'cohorts.ts')

  assert.ok(fs.existsSync(fixturePath), 'missing feature seed: cohorts.ts')
  const fixture = fs.readFileSync(fixturePath, 'utf8')
  assert.match(fixture, /seedCohorts/)
  assert.match(fixture, /planningCohorts/)
  assert.match(fixture, /planningCohortMemberships/)
  assert.match(fixture, /group/i)
  assert.match(fixture, /athlete/i)
})


test('SQLite seed restructuring exposes an explicit planning templates and sessions feature fixture', () => {
  const fixturePath = path.join(seedRoot, 'planning-templates-and-sessions.ts')

  assert.ok(fs.existsSync(fixturePath), 'missing feature seed: planning-templates-and-sessions.ts')
  const fixture = fs.readFileSync(fixturePath, 'utf8')
  assert.match(fixture, /seedPlanningTemplatesAndSessions/)
  assert.match(fixture, /groupTrainingPlans/)
  assert.match(fixture, /macrocycles/)
  assert.match(fixture, /microcycles/)
  assert.match(fixture, /sessions/)
})


test('full SQLite seed composes the approved feature fixtures in dependency order', () => {
  const seed = fs.readFileSync(path.join(process.cwd(), 'db', 'seed.ts'), 'utf8')

  const calls = [
    'seedTeamAndCoach',
    'seedGroups',
    'seedAthletes',
    'seedCompetitions',
    'seedCohorts',
    'seedPlanningTemplatesAndSessions',
  ]

  let previous = -1
  for (const call of calls) {
    assert.match(seed, new RegExp(`import[\\s\\S]*${call}`))
    const index = seed.indexOf(`${call}(`)
    assert.ok(index > previous, `${call} must be composed after its dependencies`)
    previous = index
  }
})


test('full SQLite seed delegates extracted feature ownership instead of duplicating it', () => {
  const seed = fs.readFileSync(path.join(process.cwd(), 'db', 'seed.ts'), 'utf8')
  const compositionStart = seed.indexOf('await seedTeamAndCoach(db)')
  assert.ok(compositionStart >= 0, 'missing feature-seed composition')

  const legacyBody = seed.slice(seed.indexOf('const relativeWeekDays', compositionStart))

  assert.doesNotMatch(legacyBody, /db\.insert\(trainingLocations\)/)
  assert.doesNotMatch(legacyBody, /db\.insert\(teams\)/)
  assert.doesNotMatch(legacyBody, /db\.insert\(athleteGroups\)/)
  assert.doesNotMatch(legacyBody, /db\.insert\(users\)/)
  assert.doesNotMatch(legacyBody, /db\.insert\(athleteProfiles\)/)
  assert.doesNotMatch(legacyBody, /db\.insert\(fieldPerformanceTestEvents\)/)
  assert.doesNotMatch(legacyBody, /db\.insert\(planningCohorts\)/)
  assert.doesNotMatch(legacyBody, /db\.insert\(planningCohortMemberships\)/)
})
