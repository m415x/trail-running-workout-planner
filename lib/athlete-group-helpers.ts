import { AthleteCategoryCode, AthleteGroupCode, AthleteLevelCode } from '@/types'
import { ATHLETE_CATEGORIES, ATHLETE_LEVELS } from '@/lib/constants'

export function parseAthleteGroup(groupCode: AthleteGroupCode) {
  const catCode = groupCode[0] as AthleteCategoryCode
  const lvlCode = groupCode[1] as AthleteLevelCode

  const category = ATHLETE_CATEGORIES[catCode]
  const level = ATHLETE_LEVELS[lvlCode]

  return {
    code: groupCode,
    categoryName: category?.name ?? '',
    levelName: level?.name ?? '',
    fullName: `${category?.name ?? ''} ${level?.name ?? ''}`, // ej: "Marathon Advance"
    shortLabel: groupCode, // ej: "M1"
  }
}
