import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { after, describe, it } from 'node:test'

// Bootstrap canonical SQLite before importing any repository that loads @/db.
const workspace = mkdtempSync(join(tmpdir(), 'kan-681-registration-'))
const databasePath = join(workspace, 'test.sqlite')
const previousScenarioMode = process.env.SQLITE_SCENARIO_MODE
const previousDatabasePath = process.env.SQLITE_DATABASE_PATH
process.env.SQLITE_SCENARIO_MODE = '1'
process.env.SQLITE_DATABASE_PATH = databasePath

let closeDatabase: (() => void) | undefined
try {
  const upgrade = spawnSync(
    process.execPath,
    [resolve('node_modules/tsx/dist/cli.mjs'), resolve('scripts/upgrade-sqlite.ts')],
    {
      env: process.env,
      encoding: 'utf8',
      timeout: 120_000,
      maxBuffer: 8 * 1024 * 1024,
    },
  )
  assert.equal(upgrade.error, undefined, upgrade.error?.message)
  assert.equal(upgrade.status, 0, `Canonical SQLite bootstrap failed:\n${upgrade.stdout}\n${upgrade.stderr}`)
} catch (error) {
  rmSync(workspace, { recursive: true, force: true })
  throw error
}

const { createRaceCourse, createRaceEdition, createRaceEvent } = await import('@/lib/race-catalog/catalog-repository')
const { createRaceRegistration, findRaceRegistrationInEdition, getRaceRegistration } =
  await import('@/lib/competitions/race-registration-repository')
const { db } = await import('@/db')
closeDatabase = () => db.$client.close()

after(() => {
  closeDatabase?.()
  if (previousScenarioMode === undefined) delete process.env.SQLITE_SCENARIO_MODE
  else process.env.SQLITE_SCENARIO_MODE = previousScenarioMode
  if (previousDatabasePath === undefined) delete process.env.SQLITE_DATABASE_PATH
  else process.env.SQLITE_DATABASE_PATH = previousDatabasePath
  rmSync(workspace, { recursive: true, force: true })
})

function catalog() {
  const event = createRaceEvent({ name: `Ansilta XK ${randomUUID()}` })
  const edition = createRaceEdition({
    raceEventId: event.id,
    label: 'Ansilta XK 2026',
    startDate: '2026-10-18',
    status: 'published',
  })
  const course = createRaceCourse({
    raceEditionId: edition.id,
    label: '30K',
    distanceKm: 30,
    elevationGainM: 1650,
    status: 'published',
  })
  return { event, edition, course }
}

describe('race registration SQLite repository', () => {
  it('round-trips registration, snapshot, participation and result facts', () => {
    const { event, edition, course } = catalog()
    const id = randomUUID()
    const teamId = `team-${randomUUID()}`
    const athleteProfileId = `athlete-${randomUUID()}`

    createRaceRegistration({
      id,
      teamId,
      athleteProfileId,
      course: { raceEventId: event.id, raceEditionId: edition.id, raceCourseId: course.id },
      registrationStatus: 'registered',
      participationStatus: 'finished',
      snapshot: {
        eventName: event.name,
        editionLabel: edition.label,
        editionDate: edition.startDate,
        courseLabel: course.label,
        nominalDistanceKm: course.distanceKm,
        nominalElevationGainM: course.elevationGainM,
      },
      result: { actualDistanceKm: 30.4, elapsedTimeSeconds: 10_800 },
    })

    assert.deepEqual(getRaceRegistration(id), {
      id,
      teamId,
      athleteProfileId,
      course: { raceEventId: event.id, raceEditionId: edition.id, raceCourseId: course.id },
      registrationStatus: 'registered',
      participationStatus: 'finished',
      snapshot: {
        eventName: event.name,
        editionLabel: edition.label,
        editionDate: edition.startDate,
        courseLabel: course.label,
        nominalDistanceKm: 30,
        nominalElevationGainM: 1650,
      },
      result: { actualDistanceKm: 30.4, elapsedTimeSeconds: 10_800 },
    })
  })

  it('finds the current registration by team + athlete + edition', () => {
    const { event, edition, course } = catalog()
    const teamId = `team-${randomUUID()}`
    const athleteProfileId = `athlete-${randomUUID()}`
    const id = randomUUID()

    createRaceRegistration({
      id,
      teamId,
      athleteProfileId,
      course: { raceEventId: event.id, raceEditionId: edition.id, raceCourseId: course.id },
      registrationStatus: 'registered',
      participationStatus: 'unknown',
      snapshot: {
        eventName: event.name,
        editionLabel: edition.label,
        editionDate: edition.startDate,
        courseLabel: course.label,
        nominalDistanceKm: course.distanceKm,
        nominalElevationGainM: course.elevationGainM,
      },
      result: null,
    })

    assert.deepEqual(findRaceRegistrationInEdition({ teamId, athleteProfileId, raceEditionId: edition.id }), {
      registrationId: id,
      courseLabel: '30K',
      registrationStatus: 'registered',
    })
    assert.equal(findRaceRegistrationInEdition({
      teamId,
      athleteProfileId,
      raceEditionId: `${edition.id}-other`,
    }), null)
  })

  it('rejects a registration whose supplied ancestry does not match the selected catalog course', () => {
    const { event, edition, course } = catalog()

    assert.throws(() => createRaceRegistration({
      id: randomUUID(),
      teamId: `team-${randomUUID()}`,
      athleteProfileId: `athlete-${randomUUID()}`,
      course: { raceEventId: event.id, raceEditionId: `${edition.id}-wrong`, raceCourseId: course.id },
      registrationStatus: 'registered',
      participationStatus: 'unknown',
      snapshot: {
        eventName: event.name,
        editionLabel: edition.label,
        editionDate: edition.startDate,
        courseLabel: course.label,
        nominalDistanceKm: course.distanceKm,
        nominalElevationGainM: course.elevationGainM,
      },
      result: null,
    }), /catalog hierarchy/i)
  })

  it('lets the database reject a second registration for the same team + athlete + edition', () => {
    const { event, edition, course } = catalog()
    const teamId = `team-${randomUUID()}`
    const athleteProfileId = `athlete-${randomUUID()}`
    const base = {
      teamId,
      athleteProfileId,
      course: { raceEventId: event.id, raceEditionId: edition.id, raceCourseId: course.id },
      registrationStatus: 'registered' as const,
      participationStatus: 'unknown' as const,
      snapshot: {
        eventName: event.name,
        editionLabel: edition.label,
        editionDate: edition.startDate,
        courseLabel: course.label,
        nominalDistanceKm: course.distanceKm,
        nominalElevationGainM: course.elevationGainM,
      },
      result: null,
    }

    createRaceRegistration({ id: randomUUID(), ...base })
    assert.throws(() => createRaceRegistration({ id: randomUUID(), ...base }), /unique|constraint/i)
  })
})
