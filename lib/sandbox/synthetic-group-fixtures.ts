import type { AthleteCategoryCode, AthleteLevelCode } from '../../types/athlete/group.types'
import { inspectSandboxDestination } from './sandbox-destination'

type SyntheticTeamFixture = Readonly<{ id: string; name: string }>
type SyntheticGroupFixture = Readonly<{
  id: string
  teamId: string
  categoryCode: AthleteCategoryCode
  levelCode: AthleteLevelCode
}>

/**
 * Static, synthetic rows for pure contract tests. No database, filesystem,
 * transaction, SQL statement or insertion API is exposed by this module.
 * These fixtures are not evidence that PostgreSQL constraints have been tested.
 */
export function buildSyntheticGroupFixtureInventory(): {
  teams: SyntheticTeamFixture[]
  groups: SyntheticGroupFixture[]
} {
  const team: SyntheticTeamFixture = {
    id: 'sandbox_fixture_team_alpha',
    name: 'Synthetic Fixture Team Alpha',
  }
  return {
    teams: [team],
    groups: [
      {
        id: 'sandbox_fixture_group_e1',
        teamId: team.id,
        categoryCode: 'E',
        levelCode: '1',
      },
      {
        id: 'sandbox_fixture_group_u2',
        teamId: team.id,
        categoryCode: 'U',
        levelCode: '2',
      },
    ],
  }
}

/** Pure structural destination check, not permission to seed or proof of cluster identity. */
export function validateSyntheticGroupFixtureTarget(directUrl?: string) {
  return inspectSandboxDestination({ kind: 'local', directUrl })
}

/**
 * Pure model of the declared PK, FK and composite UNIQUE constraints.
 * It intentionally does not insert records or claim actual PostgreSQL enforcement.
 */
export function validateSyntheticGroupFixtureInventory(inventory: {
  teams: readonly SyntheticTeamFixture[]
  groups: readonly SyntheticGroupFixture[]
}): { valid: true } {
  if (!inventory || !Array.isArray(inventory.teams) || !Array.isArray(inventory.groups)) {
    throw new Error('Invalid synthetic fixture inventory')
  }

  const teamIds = new Set<string>()
  for (const team of inventory.teams) {
    if (!team || typeof team.id !== 'string' || !team.id || typeof team.name !== 'string' || !team.name) {
      throw new Error('Invalid synthetic team fixture')
    }
    if (teamIds.has(team.id)) {
      throw new Error('Duplicate synthetic team identity')
    }
    teamIds.add(team.id)
  }

  const groupIds = new Set<string>()
  const combinations = new Set<string>()
  for (const group of inventory.groups) {
    if (!group || typeof group.id !== 'string' || !group.id) {
      throw new Error('Invalid synthetic group identity')
    }
    if (groupIds.has(group.id)) {
      throw new Error('Duplicate synthetic group identity')
    }
    groupIds.add(group.id)

    if (!teamIds.has(group.teamId)) {
      throw new Error('Synthetic group references missing team')
    }
    if (
      !['E', 'U', 'M', 'H', 'S', 'B'].includes(group.categoryCode)
      || !['1', '2', '3'].includes(group.levelCode)
    ) {
      throw new Error('Invalid synthetic group category or level')
    }
    const uniqueKey = JSON.stringify([group.teamId, group.categoryCode, group.levelCode])
    if (combinations.has(uniqueKey)) {
      throw new Error('Duplicate synthetic group combination')
    }
    combinations.add(uniqueKey)
  }

  return { valid: true }
}
