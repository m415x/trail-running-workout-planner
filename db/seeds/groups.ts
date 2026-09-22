import type { db as sqliteDb } from '@/db/index'
import { athleteGroups } from '@/db/schema'
import { team } from '@/data/data'

import type { AthleteCategoryCode, AthleteGroupCode, AthleteLevelCode } from '@/types'

type SeedDb = typeof sqliteDb

export interface SeededAthleteGroup {
  id: string
  teamId: string
  categoryCode: AthleteCategoryCode
  levelCode: AthleteLevelCode
  description: string
  isActive: boolean
}

export const seedGroupCodes: AthleteGroupCode[] = ['M1', 'S2', 'B3']

function splitGroupCode(groupCode: AthleteGroupCode): {
  categoryCode: AthleteCategoryCode
  levelCode: AthleteLevelCode
} {
  return {
    categoryCode: groupCode[0] as AthleteCategoryCode,
    levelCode: groupCode[1] as AthleteLevelCode,
  }
}

export function buildSeedGroups(teamId = String(team.id || 'team_1')): SeededAthleteGroup[] {
  return seedGroupCodes.map((groupCode) => {
    const { categoryCode, levelCode } = splitGroupCode(groupCode)

    return {
      id: `${teamId}_${groupCode}`,
      teamId,
      categoryCode,
      levelCode,
      description: `Grupo ${groupCode}`,
      isActive: true,
    }
  })
}

export async function seedGroups(db: SeedDb): Promise<SeededAthleteGroup[]> {
  const rows = buildSeedGroups()

  await db
    .insert(athleteGroups)
    .values(rows)
    .onConflictDoNothing()
    .run()

  return rows
}
