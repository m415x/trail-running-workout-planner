import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import Database from 'better-sqlite3'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import {
  athleteProfiles,
  groupHistoryRecords,
  planningCohortMemberships,
} from '@/db/schema'
import { assignAthleteToGroupSynchronously } from '@/lib/athletes/group-assignment'
import { createAthleteGroupAssignmentAction } from '@/lib/athletes/group-assignment-action'
import { resolveAthleteGroupOnDate } from '@/lib/planning-cohorts/planning-resolution'

function createDatabase() {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  sqlite.exec(`
    CREATE TABLE teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'athlete',
      user_name TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL
    );

    CREATE TABLE athlete_groups (
      id TEXT PRIMARY KEY,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      category_code TEXT NOT NULL,
      level_code TEXT NOT NULL,
      team_id TEXT NOT NULL REFERENCES teams(id),
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE athlete_profiles (
      id TEXT PRIMARY KEY,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
      team_id TEXT NOT NULL REFERENCES teams(id),
      group_id TEXT REFERENCES athlete_groups(id),
      is_active INTEGER NOT NULL DEFAULT 1,
      nick_name TEXT,
      dni TEXT NOT NULL,
      birthday TEXT,
      phone TEXT,
      emergency_contact TEXT,
      emergency_phone TEXT,
      physiology TEXT,
      medical TEXT
    );

    CREATE TABLE planning_cohorts (
      id TEXT PRIMARY KEY,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      team_id TEXT NOT NULL REFERENCES teams(id),
      group_id TEXT NOT NULL REFERENCES athlete_groups(id),
      name TEXT NOT NULL,
      purpose TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active'
    );

    CREATE TABLE planning_cohort_memberships (
      id TEXT PRIMARY KEY,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      planning_cohort_id TEXT NOT NULL REFERENCES planning_cohorts(id),
      athlete_profile_id TEXT NOT NULL REFERENCES athlete_profiles(id),
      start_date TEXT NOT NULL,
      end_date TEXT,
      assigned_by_user_id TEXT REFERENCES users(id),
      assignment_reason TEXT,
      ended_by_user_id TEXT REFERENCES users(id),
      end_reason TEXT
    );

    CREATE TABLE group_history_records (
      id TEXT PRIMARY KEY,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      athlete_id TEXT NOT NULL REFERENCES athlete_profiles(id),
      date TEXT NOT NULL,
      previous_group_id TEXT REFERENCES athlete_groups(id),
      new_group_id TEXT NOT NULL REFERENCES athlete_groups(id),
      changed_by_user_id TEXT REFERENCES users(id),
      reason TEXT
    );
  `)

  const now = '2026-09-01T00:00:00.000Z'
  const insert = sqlite.prepare.bind(sqlite)

  insert(`INSERT INTO teams VALUES ('team_1', 'Team 1', 0, ?, ?)`).run(now, now)
  insert(`INSERT INTO teams VALUES ('team_2', 'Team 2', 0, ?, ?)`).run(now, now)

  insert(`
    INSERT INTO users (
      id, is_deleted, created_at, updated_at, role, user_name, email, first_name, last_name
    ) VALUES ('user-athlete', 0, ?, ?, 'athlete', 'athlete', 'athlete@example.com', 'Ana', 'Trail')
  `).run(now, now)

  const insertGroup = sqlite.prepare(`
    INSERT INTO athlete_groups (
      id, is_deleted, created_at, updated_at, category_code, level_code, team_id, description, is_active
    ) VALUES (?, 0, ?, ?, 'M', '1', ?, NULL, 1)
  `)
  insertGroup.run('group-old', now, now, 'team_1')
  insertGroup.run('group-new', now, now, 'team_1')
  insertGroup.run('group-other-team', now, now, 'team_2')

  insert(`
    INSERT INTO athlete_profiles (
      id, is_deleted, created_at, updated_at, user_id, team_id, group_id, is_active, dni
    ) VALUES ('athlete-1', 0, ?, ?, 'user-athlete', 'team_1', 'group-old', 1, '12345678')
  `).run(now, now)

  insert(`
    INSERT INTO planning_cohorts (
      id, is_deleted, created_at, updated_at, team_id, group_id, name, purpose, status
    ) VALUES ('cohort-old-a', 0, ?, ?, 'team_1', 'group-old', 'Old A', 'Race A', 'active')
  `).run(now, now)
  insert(`
    INSERT INTO planning_cohorts (
      id, is_deleted, created_at, updated_at, team_id, group_id, name, purpose, status
    ) VALUES ('cohort-old-b', 0, ?, ?, 'team_1', 'group-old', 'Old B', 'Race B', 'active')
  `).run(now, now)

  return {
    sqlite,
    db: drizzle(sqlite),
    insertMembership(input: {
      id: string
      cohortId?: string
      startDate: string
      endDate?: string | null
    }) {
      insert(`
        INSERT INTO planning_cohort_memberships (
          id, is_deleted, created_at, updated_at, planning_cohort_id, athlete_profile_id,
          start_date, end_date, assigned_by_user_id, assignment_reason, ended_by_user_id, end_reason
        ) VALUES (?, 0, ?, ?, ?, 'athlete-1', ?, ?, NULL, NULL, NULL, NULL)
      `).run(input.id, now, now, input.cohortId ?? 'cohort-old-a', input.startDate, input.endDate ?? null)
    },
  }
}

function runAssignment(
  db: ReturnType<typeof drizzle>,
  overrides: Partial<Parameters<typeof assignAthleteToGroupSynchronously>[0]['input']> = {},
) {
  let id = 0
  return assignAthleteToGroupSynchronously({
    db,
    createId: () => `generated-${++id}`,
    now: () => '2026-09-28T15:00:00.000Z',
    input: {
      teamId: 'team_1',
      athleteId: 'athlete-1',
      newGroupId: 'group-new',
      effectiveDate: '2026-09-20',
      today: '2026-09-28',
      reason: 'Cambio de grupo',
      changedByUserId: null,
      ...overrides,
    },
  })
}

function authorizedActionDependencies() {
  return {
    requireAccess: async () => ({
      status: 'authenticated' as const,
      userId: 'user-athlete',
    }),
    authorize: async (
      _access: { status: 'authenticated'; userId: string },
      request: { resource: { teamId: string } },
    ) => ({
      allowed: true,
      teamId: request.resource.teamId,
    }),
  }
}

describe('assignAthleteToGroup SQLite integration', () => {
  it('closes every open previous-group cohort at D-1, preserves closed history and changes the group atomically', () => {
    const fixture = createDatabase()
    try {
      fixture.insertMembership({ id: 'historic', startDate: '2026-05-01', endDate: '2026-05-31' })
      fixture.insertMembership({ id: 'open-a', startDate: '2026-06-01' })
      fixture.insertMembership({ id: 'open-b', cohortId: 'cohort-old-b', startDate: '2026-07-01' })

      const result = runAssignment(fixture.db)

      assert.deepEqual(result, {
        changed: true,
        previousGroupId: 'group-old',
        newGroupId: 'group-new',
        closedMembershipIds: ['open-a', 'open-b'],
      })

      const athlete = fixture.db
        .select({ groupId: athleteProfiles.groupId })
        .from(athleteProfiles)
        .where(eq(athleteProfiles.id, 'athlete-1'))
        .get()
      assert.deepEqual(athlete, { groupId: 'group-new' })

      const memberships = fixture.db
        .select({
          id: planningCohortMemberships.id,
          endDate: planningCohortMemberships.endDate,
          endReason: planningCohortMemberships.endReason,
        })
        .from(planningCohortMemberships)
        .all()
        .sort((a, b) => a.id.localeCompare(b.id))

      assert.deepEqual(memberships, [
        { id: 'historic', endDate: '2026-05-31', endReason: null },
        { id: 'open-a', endDate: '2026-09-19', endReason: 'Cambio de grupo' },
        { id: 'open-b', endDate: '2026-09-19', endReason: 'Cambio de grupo' },
      ])

      const changes = fixture.db.select().from(groupHistoryRecords).all()
      assert.equal(changes.length, 1)
      assert.equal(changes[0]?.date, '2026-09-20')
      assert.equal(changes[0]?.previousGroupId, 'group-old')
      assert.equal(changes[0]?.newGroupId, 'group-new')

      const groupChanges = changes.map((change) => ({
        id: change.id,
        date: change.date,
        previousGroupId: change.previousGroupId,
        newGroupId: change.newGroupId,
        isDeleted: change.isDeleted,
      }))
      assert.equal(resolveAthleteGroupOnDate('group-new', groupChanges, '2026-09-19').groupId, 'group-old')
      assert.equal(resolveAthleteGroupOnDate('group-new', groupChanges, '2026-09-20').groupId, 'group-new')
      assert.equal(resolveAthleteGroupOnDate('group-new', groupChanges, '2026-09-21').groupId, 'group-new')
    } finally {
      fixture.sqlite.close()
    }
  })

  it('treats the current group as a no-op without closing memberships or appending history', () => {
    const fixture = createDatabase()
    try {
      fixture.insertMembership({ id: 'open-a', startDate: '2026-06-01' })

      const result = runAssignment(fixture.db, { newGroupId: 'group-old' })

      assert.deepEqual(result, {
        changed: false,
        previousGroupId: 'group-old',
        newGroupId: 'group-old',
        closedMembershipIds: [],
      })
      assert.equal(
        fixture.db.select().from(groupHistoryRecords).all().length,
        0,
      )
      assert.equal(
        fixture.db.select({ endDate: planningCohortMemberships.endDate })
          .from(planningCohortMemberships)
          .get()?.endDate,
        null,
      )
    } finally {
      fixture.sqlite.close()
    }
  })

  it('rejects future scheduling, cross-team destinations and cohort periods that cannot be closed without rewriting history', () => {
    const cases: Array<{
      name: string
      prepare?: (fixture: ReturnType<typeof createDatabase>) => void
      overrides: Partial<Parameters<typeof assignAthleteToGroupSynchronously>[0]['input']>
      error: RegExp
    }> = [
      {
        name: 'future',
        overrides: { effectiveDate: '2026-09-29' },
        error: /futura/i,
      },
      {
        name: 'cross-team',
        overrides: { newGroupId: 'group-other-team' },
        error: /grupo/i,
      },
      {
        name: 'starts-on-change-date',
        prepare: (fixture) => fixture.insertMembership({
          id: 'scheduled-old-group',
          startDate: '2026-09-20',
        }),
        overrides: {},
        error: /historia|intervalo|cohorte/i,
      },
      {
        name: 'closed-after-change-date',
        prepare: (fixture) => fixture.insertMembership({
          id: 'closed-overlap',
          startDate: '2026-09-01',
          endDate: '2026-09-25',
        }),
        overrides: {},
        error: /historia|intervalo|cohorte/i,
      },
    ]

    for (const scenario of cases) {
      const fixture = createDatabase()
      try {
        scenario.prepare?.(fixture)
        assert.throws(
          () => runAssignment(fixture.db, scenario.overrides),
          scenario.error,
          scenario.name,
        )
        assert.equal(
          fixture.db.select({ groupId: athleteProfiles.groupId })
            .from(athleteProfiles)
            .get()?.groupId,
          'group-old',
          scenario.name,
        )
        assert.equal(fixture.db.select().from(groupHistoryRecords).all().length, 0, scenario.name)
      } finally {
        fixture.sqlite.close()
      }
    }
  })

  it('rolls back cohort closures and athlete mutation when the history append fails', () => {
    const fixture = createDatabase()
    try {
      fixture.insertMembership({ id: 'open-a', startDate: '2026-06-01' })
      fixture.sqlite.exec(`
        CREATE TRIGGER fail_group_history_insert
        BEFORE INSERT ON group_history_records
        BEGIN
          SELECT RAISE(ABORT, 'forced history failure');
        END;
      `)

      assert.throws(() => runAssignment(fixture.db), /forced history failure/)

      assert.equal(
        fixture.db.select({ groupId: athleteProfiles.groupId })
          .from(athleteProfiles)
          .get()?.groupId,
        'group-old',
      )
      assert.equal(
        fixture.db.select({ endDate: planningCohortMemberships.endDate })
          .from(planningCohortMemberships)
          .get()?.endDate,
        null,
      )
      assert.equal(fixture.db.select().from(groupHistoryRecords).all().length, 0)
    } finally {
      fixture.sqlite.close()
    }
  })
})


describe('assignAthleteToGroup Server Action boundary', () => {
  it('returns to the destination sporting group when the group workflow supplies matching context', async () => {
    const fixture = createDatabase()
    const effects: string[] = []

    try {
      const action = createAthleteGroupAssignmentAction({
        db: fixture.db,
        ...authorizedActionDependencies(),
        createId: () => 'history-group-return',
        now: () => '2026-09-28T15:00:00.000Z',
        today: () => '2026-09-28',
        revalidatePath: (path) => effects.push(`revalidate:${path}`),
        redirect: (path) => effects.push(`redirect:${path}`),
      })

      const formData = new FormData()
      formData.set('athleteId', 'athlete-1')
      formData.set('newGroupId', 'group-new')
      formData.set('effectiveDate', '2026-09-20')
      formData.set('reason', 'Traslado desde grupo')
      formData.set('locale', 'en')
      formData.set('returnContext', 'group:group-new')

      const result = await action({}, formData)

      assert.deepEqual(result, {})
      assert.equal(
        fixture.db.select({ groupId: athleteProfiles.groupId })
          .from(athleteProfiles)
          .get()?.groupId,
        'group-new',
      )
      assert.deepEqual(effects, [
        'revalidate:/en/dashboard/athletes',
        'revalidate:/en/dashboard/athletes/athlete-1',
        'revalidate:/en/dashboard/groups',
        'revalidate:/en/dashboard/groups/group-new',
        'redirect:/en/dashboard/groups/group-new',
      ])
    } finally {
      fixture.sqlite.close()
    }
  })

  it('ignores an inconsistent sporting-group return context for authorization and falls back to athlete navigation', async () => {
    const fixture = createDatabase()
    const effects: string[] = []

    try {
      const action = createAthleteGroupAssignmentAction({
        db: fixture.db,
        ...authorizedActionDependencies(),
        createId: () => 'history-invalid-return',
        now: () => '2026-09-28T15:00:00.000Z',
        today: () => '2026-09-28',
        revalidatePath: (path) => effects.push(`revalidate:${path}`),
        redirect: (path) => effects.push(`redirect:${path}`),
      })

      const formData = new FormData()
      formData.set('athleteId', 'athlete-1')
      formData.set('newGroupId', 'group-new')
      formData.set('effectiveDate', '2026-09-20')
      formData.set('reason', 'Contexto inconsistente')
      formData.set('locale', 'en')
      formData.set('returnContext', 'group:group-old')

      const result = await action({}, formData)

      assert.deepEqual(result, {})
      assert.equal(
        fixture.db.select({ groupId: athleteProfiles.groupId })
          .from(athleteProfiles)
          .get()?.groupId,
        'group-new',
      )
      assert.deepEqual(effects, [
        'revalidate:/en/dashboard/athletes',
        'revalidate:/en/dashboard/athletes/athlete-1',
        'redirect:/en/dashboard/athletes/athlete-1',
      ])
    } finally {
      fixture.sqlite.close()
    }
  })

  it('routes validated form input through the canonical SQLite assignment and preserves navigation side effects', async () => {
    const fixture = createDatabase()
    const effects: string[] = []

    try {
      fixture.insertMembership({ id: 'open-action', startDate: '2026-06-01' })

      const action = createAthleteGroupAssignmentAction({
        db: fixture.db,
        ...authorizedActionDependencies(),
        createId: () => 'history-action',
        now: () => '2026-09-28T15:00:00.000Z',
        today: () => '2026-09-28',
        revalidatePath: (path) => effects.push(`revalidate:${path}`),
        redirect: (path) => effects.push(`redirect:${path}`),
      })

      const formData = new FormData()
      formData.set('athleteId', 'athlete-1')
      formData.set('newGroupId', 'group-new')
      formData.set('effectiveDate', '2026-09-20')
      formData.set('reason', 'Cambio desde la acción')
      formData.set('locale', 'en')

      const result = await action({}, formData)

      assert.deepEqual(result, {})
      assert.equal(
        fixture.db.select({ groupId: athleteProfiles.groupId })
          .from(athleteProfiles)
          .get()?.groupId,
        'group-new',
      )
      assert.equal(
        fixture.db.select({ endDate: planningCohortMemberships.endDate })
          .from(planningCohortMemberships)
          .where(eq(planningCohortMemberships.id, 'open-action'))
          .get()?.endDate,
        '2026-09-19',
      )
      assert.deepEqual(effects, [
        'revalidate:/en/dashboard/athletes',
        'revalidate:/en/dashboard/athletes/athlete-1',
        'redirect:/en/dashboard/athletes/athlete-1',
      ])
    } finally {
      fixture.sqlite.close()
    }
  })
})
