import { AthleteCategoryCode, AthleteGroup, AthleteGroupCode, AthleteLevelCode } from '@/types'

export function buildAthleteGroupCode(group: Pick<AthleteGroup, 'categoryCode' | 'levelCode'>): AthleteGroupCode {
  return `${group.categoryCode}${group.levelCode}`
}

export function parseAthleteGroup(groupCode: AthleteGroupCode) {
  const categoryCode = groupCode[0] as AthleteCategoryCode
  const levelCode = groupCode[1] as AthleteLevelCode

  return {
    code: groupCode,
    categoryCode,
    levelCode,
    shortLabel: groupCode,
  }
}

export function describeAthleteGroup(group: Pick<AthleteGroup, 'categoryCode' | 'levelCode'>) {
  return parseAthleteGroup(buildAthleteGroupCode(group))
}
