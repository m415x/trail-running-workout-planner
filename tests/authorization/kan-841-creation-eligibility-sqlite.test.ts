import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { eq } from 'drizzle-orm'

import { athleteGroups, teamMemberships } from '@/db/schema'
import { createH4aAuthorizationAdapter } from '@/lib/authorization/h4a-authorization-adapter'
import { createPlanningCreationEligibility } from '@/lib/planning/planning-creation-eligibility'

const NOW = '2026-10-20T12:00:00.000Z'

test('KAN-841/T2 creation CTA uses the same shared server-owned eligibility core', () => {
  const action = readFileSync('app/actions/load-strategy-actions.ts', 'utf8')
  const begin = action.indexOf('export async function getCoachPlanningCreationEligibility()')
  const end = action.indexOf('export async function createGroupPlanWithLoadStrategy(', begin)
  assert.ok(begin >= 0 && end > begin)
  assert.match(action.slice(begin, end), /createPlanningCreationEligibility\(/)
})

test('KAN-841/T2 CTA eligibility uses persisted active groups and effective H4A; denies without writes', async () => {
  const sqlite = new Database(':memory:')
  try {
    sqlite.exec(`
      CREATE TABLE athlete_groups (
        id TEXT PRIMARY KEY, team_id TEXT NOT NULL, category_code TEXT NOT NULL,
        level_code TEXT NOT NULL, description TEXT, is_active INTEGER NOT NULL DEFAULT 1,
        is_deleted INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE team_memberships (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, team_id TEXT NOT NULL,
        preset TEXT NOT NULL, effective_from TEXT NOT NULL, effective_until TEXT,
        is_active INTEGER NOT NULL DEFAULT 1, is_deleted INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
    `)
    const db = drizzle(sqlite, { schema: { athleteGroups, teamMemberships } })
    for (const group of [
      { id: 'active', teamId: 'a', categoryCode: 'M', levelCode: '1', isActive: true, isDeleted: false, createdAt: NOW, updatedAt: NOW },
      { id: 'inactive', teamId: 'a', categoryCode: 'S', levelCode: '2', isActive: false, isDeleted: false, createdAt: NOW, updatedAt: NOW },
      { id: 'foreign', teamId: 'b', categoryCode: 'B', levelCode: '3', isActive: true, isDeleted: false, createdAt: NOW, updatedAt: NOW },
    ] as (typeof athleteGroups.$inferInsert)[]) db.insert(athleteGroups).values(group).run()
    for (const [userId, preset] of [['athlete', 'athlete'], ['coach', 'coach']] as const) {
      db.insert(teamMemberships).values({
        id: userId, userId, teamId: 'a', preset, effectiveFrom: '2026-01-01T00:00:00.000Z',
        effectiveUntil: null, isActive: true, isDeleted: false, createdAt: NOW, updatedAt: NOW,
      }).run()
    }
    const h4a = createH4aAuthorizationAdapter({
      async loadMemberships(userId, teamId) {
        return db.select().from(teamMemberships).where(eq(teamMemberships.userId, userId)).all()
          .filter(row => row.teamId === teamId).map(row => ({
            userId: row.userId, teamId: row.teamId, preset: row.preset,
            effectiveFrom: row.effectiveFrom, effectiveUntil: row.effectiveUntil, isActive: row.isActive,
          }))
      },
      async loadAthleteProfiles() { return [] },
      async loadGrants() { return [] },
    })
    let userId = 'athlete'
    let context: 'resolved' | 'selection_required' | 'invalid_context' = 'resolved'
    let groupReads = 0
    const seenGroups: string[] = []
    const snapshot = () => JSON.stringify({
      groups: sqlite.prepare('SELECT * FROM athlete_groups ORDER BY id').all(),
      memberships: sqlite.prepare('SELECT * FROM team_memberships ORDER BY id').all(),
    })
    const eligibility = createPlanningCreationEligibility({
      authenticate: async () => ({ status: 'authenticated' as const, userId }),
      resolveActiveTeam: async () => context === 'resolved'
        ? { status: 'resolved' as const, teamId: 'a', source: 'persisted' as const }
        : { status: context },
      listActiveGroups: async teamId => {
        groupReads++
        return db.select().from(athleteGroups).where(eq(athleteGroups.teamId, teamId)).all()
          .filter(group => group.isActive && !group.isDeleted)
      },
      authorize: async (access, request) => {
        seenGroups.push(request.resource.sportingGroupId ?? '')
        return h4a.authorize(access, request)
      },
      now: () => NOW,
    })
    const initial = snapshot()
    assert.equal(await eligibility.check(), false)
    assert.equal(groupReads, 1)
    assert.equal(snapshot(), initial)
    userId = 'coach'
    assert.equal(await eligibility.check(), true)
    assert.ok(seenGroups.includes('active'))
    assert.ok(!seenGroups.includes('inactive') && !seenGroups.includes('foreign'))
    context = 'selection_required'
    const beforeInvalid = groupReads
    assert.equal(await eligibility.check(), false)
    context = 'invalid_context'
    assert.equal(await eligibility.check(), false)
    assert.equal(groupReads, beforeInvalid)
    context = 'resolved'
    db.update(teamMemberships).set({ isActive: false }).where(eq(teamMemberships.userId, 'coach')).run()
    assert.equal(await eligibility.check(), false)
  } finally {
    sqlite.close()
  }
})
