import type { AthleteCategoryCode, AthleteLevelCode } from '../../types/athlete/athlete.types'
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
