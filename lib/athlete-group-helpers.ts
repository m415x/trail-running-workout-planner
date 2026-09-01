import { AthleteCategoryCode, AthleteGroup, AthleteGroupCode, AthleteLevelCode } from '@/types'
import { ATHLETE_CATEGORIES, ATHLETE_LEVELS } from '@/lib/constants'

export function buildAthleteGroupCode(group: Pick<AthleteGroup, 'categoryCode' | 'levelCode'>): AthleteGroupCode {
  return `${group.categoryCode}${group.levelCode}`
}

export function parseAthleteGroup(groupCode: AthleteGroupCode) {
  const categoryCode = groupCode[0] as AthleteCategoryCode
  const levelCode = groupCode[1] as AthleteLevelCode

  const category = ATHLETE_CATEGORIES[categoryCode]
  const level = ATHLETE_LEVELS[levelCode]

  return {
    code: groupCode,
    categoryCode,
    levelCode,
    categoryName: category?.name ?? '',
    levelName: level?.name ?? '',
    fullName: `${category?.name ?? ''} ${level?.name ?? ''}`.trim(),
    shortLabel: groupCode,
  }
}

export function describeAthleteGroup(group: Pick<AthleteGroup, 'categoryCode' | 'levelCode'>) {
  return parseAthleteGroup(buildAthleteGroupCode(group))
}
