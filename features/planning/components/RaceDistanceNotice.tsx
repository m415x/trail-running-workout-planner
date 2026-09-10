'use client'

import { useFormatter, useTranslations } from 'next-intl'
import type { CategoryRaceDistanceResult } from '@/types/athlete/category-race-distance.types'

/** Presents advisory policy results; never controls submission or changes load. */
export function RaceDistanceNotice({ result, groupCode, distanceKm }: {
  result: CategoryRaceDistanceResult
  groupCode: string
  distanceKm?: number | null
}) {
  const t = useTranslations('RaceDistancePolicy')
  const format = useFormatter()
  const number = (value: number) => format.number(value, { maximumFractionDigits: 6 })
  if (result.status === 'compatible' || result.status === 'unrestricted' || result.status === 'not_applicable') return null

  if (result.status === 'invalid') {
    return <p role='status' className='text-sm text-destructive'>{t('invalid')}</p>
  }
  if (result.status === 'policy_not_defined') {
    return <p role='status' className='rounded-md border p-3 text-sm text-muted-foreground'>{t('pending', { group: groupCode })}</p>
  }
  if (result.status !== 'incompatible') return null
  const range = result.minKm !== null && result.maxKm !== null
    ? t('range', { min: number(result.minKm), max: number(result.maxKm) })
    : result.minKm !== null
      ? t('minimum', { min: number(result.minKm) })
      : t('maximum', { max: number(result.maxKm!) })
  return (
    <div role='status' className='space-y-1 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300'>
      <p className='font-medium'>{t('warning', { group: groupCode, distance: number(distanceKm ?? 0) })}</p>
      <p>{t('bounds', { range, tolerance: number(result.tolerancePercent) })}</p>
      <p>{t('continue')}</p>
    </div>
  )
}
