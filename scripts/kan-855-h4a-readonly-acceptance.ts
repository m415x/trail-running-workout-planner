import assert from 'node:assert/strict'
import { existsSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, resolve, sep } from 'node:path'
import Database from 'better-sqlite3'

import { authorizeEffectiveCapability } from '@/lib/authorization/effective-authorization'

assert.notEqual(process.env.NODE_ENV, 'production')
assert.notEqual(process.env.CI, 'true')
assert.equal(process.env.SQLITE_SCENARIO_MODE, '1')
assert.equal(process.env.EPT_IDENTITY_BACKEND, 'sqlite')

const source = process.env.SQLITE_DATABASE_PATH
assert.ok(source && existsSync(source), 'Accredited SQLite fixture required')

const path = realpathSync(source)
const parent = realpathSync(dirname(path))
const temporaryRoot = realpathSync(tmpdir())
const canonical = (value: string) => process.platform === 'win32' ? value.toLowerCase() : value

assert.ok(canonical(parent).startsWith(canonical(temporaryRoot) + sep), 'Fixture outside system temp')
assert.ok(basename(parent).startsWith('trail-running-sqlite-base-seed-kan855-'), 'Wrong KAN-855 fixture')
assert.notEqual(canonical(path), canonical(resolve('sqlite.db')), 'Developer database forbidden')

const sqlite = new Database(path, { readonly: true, fileMustExist: true })

try {
  const linked = sqlite.prepare(`
    SELECT u.id AS userId
    FROM external_identity_links AS l
    JOIN users AS u ON u.id = l.user_id
    WHERE l.id = ? AND l.provider = 'supabase'
      AND l.is_deleted = 0 AND u.is_deleted = 0
  `).all('kan855-ssr-authenticated-link') as { userId: string }[]

  assert.equal(linked.length, 1, 'Expected one accredited EPT identity')
  assert.equal(linked[0]?.userId, 'kan855-ssr-authenticated-coach')

  const rows = sqlite.prepare(`
    SELECT user_id AS userId, team_id AS teamId, preset,
      effective_from AS effectiveFrom, effective_until AS effectiveUntil,
      is_active AS isActive
    FROM team_memberships
    WHERE user_id = ? AND is_deleted = 0
  `).all(linked[0].userId) as Array<{
    userId: string
    teamId: string
    preset: string
    effectiveFrom: string
    effectiveUntil: string | null
    isActive: number
  }>

  assert.equal(rows.length, 1, 'Ambiguous membership')
  assert.equal(rows[0]?.teamId, 'team_1')
  assert.equal(rows[0]?.preset, 'coach')

  const membership = rows.map((row) => ({
    userId: row.userId,
    teamId: row.teamId,
    preset: 'coach' as const,
    effectiveFrom: row.effectiveFrom,
    effectiveUntil: row.effectiveUntil,
    isActive: row.isActive === 1,
  }))

  const base = {
    authenticatedUserId: linked[0].userId,
    teamId: 'team_1',
    resource: { teamId: 'team_1' },
    at: new Date().toISOString(),
    memberships: membership,
    athleteProfiles: [],
    grants: [],
    requiredScope: 'team' as const,
  }

  const allow = authorizeEffectiveCapability({ ...base, capability: 'athlete.admin.manage' })
  const deny = authorizeEffectiveCapability({ ...base, capability: 'team_membership.manage' })

  assert.equal(allow.allowed, true, 'Coach athlete administration should ALLOW')
  assert.equal(deny.allowed, false, 'Coach structural Team membership management must DENY')
  console.log(JSON.stringify({
    status: 'PASS',
    scenario: 'KAN-855 authenticated-Coach H4A read-only contract',
    allow: 'athlete.admin.manage',
    deny: 'team_membership.manage',
    database: 'verified-disposable-sqlite',
    mutated: false,
  }))
} finally {
  sqlite.close()
}
