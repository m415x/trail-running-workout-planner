'use client'

import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type {
  MicrocycleLoadFocus,
  MicrocycleType,
  TargetElevationSource,
  TargetVolumeSource,
} from '@/types'
import {
  saveLoadProgression,
  type PersistProgressionFormState,
} from '@/app/actions/planning-actions'
import { Badge } from '@ui/badge'
import { Button } from '@ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/card'
import { ChartContainer } from '@ui/chart'

export interface LoadProgressionPoint {
  weekNumber: number
  volumeKm: number
  elevationGain: number | null
  type: MicrocycleType
  loadFocus: MicrocycleLoadFocus
  volumeSource: TargetVolumeSource
  elevationSource: TargetElevationSource
}

interface LoadProgressionPreviewProps {
  points: LoadProgressionPoint[]
  initialVolumeKm: number
  maximumVolumeKm: number
  warnings: string[]
  conflicts: string[]
  planId: string
  macrocycleId: string
  locale: string
}

const initialActionState: PersistProgressionFormState = {}

const loadFocusLabelKeys: Record<MicrocycleLoadFocus, 'balanced' | 'volume' | 'elevation' | 'recovery' | 'race_specific'> = {
  balanced: 'balanced',
  volume: 'volume',
  elevation: 'elevation',
  recovery: 'recovery',
  race_specific: 'race_specific',
}

function getVolumePointAppearance(point: LoadProgressionPoint) {
  if (point.volumeSource === 'manual') {
    return { radius: 5, fill: 'var(--chart-4)', strokeWidth: 2 }
  }

  return { radius: 3, fill: 'var(--color-volume)', strokeWidth: 0 }
}

function getElevationPointAppearance(point: LoadProgressionPoint) {
  if (point.elevationSource === 'manual') {
    return { radius: 5, fill: 'var(--chart-5)', strokeWidth: 2 }
  }

  return { radius: 3, fill: 'var(--color-elevation)', strokeWidth: 0 }
}

export function LoadProgressionPreview({
  points,
  initialVolumeKm,
  maximumVolumeKm,
  warnings,
  conflicts,
  planId,
  macrocycleId,
  locale,
}: LoadProgressionPreviewProps) {
  const t = useTranslations('CoachPlanning')
  const presentationLocale = locale === 'en' ? 'en-US' : 'es-AR'
  const manualVolumePoints = points.filter((point) => point.volumeSource === 'manual')
  const manualElevationPoints = points.filter((point) => point.elevationSource === 'manual')
  const elevationValues = points.flatMap((point) => (
    point.elevationGain === null ? [] : [point.elevationGain]
  ))
  const hasElevation = elevationValues.length > 0
  const [actionState, formAction, isPending] = useActionState(
    saveLoadProgression,
    initialActionState,
  )

  return (
    <Card>
      <CardHeader>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div>
            <CardTitle>{t('loadPreviewTitle')}</CardTitle>
            <CardDescription>
              {t('loadPreview.description')}
            </CardDescription>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Badge variant='outline'>
              <span className='size-2 rounded-full bg-[var(--chart-1)]' />
              {t('loadPreview.volume')}
            </Badge>
            {hasElevation && (
              <Badge variant='outline'>
                <span className='size-2 rounded-full bg-[var(--chart-2)]' />
                {t('loadPreview.elevation')}
              </Badge>
            )}
            {manualVolumePoints.length > 0 && (
              <Badge variant='outline'>
                <span className='size-2 rounded-full bg-[var(--chart-4)]' />
                {t('loadPreview.manualVolume', { count: manualVolumePoints.length })}
              </Badge>
            )}
            {manualElevationPoints.length > 0 && (
              <Badge variant='outline'>
                <span className='size-2 rounded-full bg-[var(--chart-5)]' />
                {t('loadPreview.manualElevation', { count: manualElevationPoints.length })}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className='space-y-5'>
        <ChartContainer
          config={{
            volume: { label: t('loadPreview.volume'), color: 'var(--chart-1)' },
            elevation: { label: t('loadPreview.elevation'), color: 'var(--chart-2)' },
          }}
          className='h-72 w-full aspect-auto'
        >
          <LineChart data={points} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey='weekNumber' tickLine={false} axisLine={false} tickFormatter={(value) => t('loadPreview.week', { count: Number(value) })} />
            <YAxis
              yAxisId='volume'
              unit=' km'
              width={52}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              domain={['dataMin - 5', 'dataMax + 5']}
            />
            {hasElevation && (
              <YAxis
                yAxisId='elevation'
                orientation='right'
                unit=' m'
                width={68}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                domain={[0, 'dataMax + 100']}
              />
            )}
            <Tooltip
              content={({ active, label }) => {
                const point = points.find((candidate) => (
                  candidate.weekNumber === Number(label)
                ))

                if (!active || !point) return null

                return (
                  <div className='space-y-1 rounded-md border bg-background px-3 py-2 text-sm shadow-md'>
                    <p className='font-medium'>{t('loadPreview.week', { count: point.weekNumber })}</p>
                    <p className='text-muted-foreground'>
                      {t(`microcycleType.types.${point.type}`)}
                    </p>
                    <p className='text-muted-foreground'>{t(`loadFocus.${loadFocusLabelKeys[point.loadFocus]}`)}</p>
                    <p className='font-semibold'>
                      {point.volumeKm.toLocaleString(presentationLocale)} km · {point.volumeSource === 'manual' ? t('loadPreview.manual') : t('loadPreview.generated')}
                    </p>
                    {point.elevationGain !== null && (
                      <p className='font-semibold'>
                        +{point.elevationGain.toLocaleString(presentationLocale)} m D+ · {point.elevationSource === 'manual' ? t('loadPreview.manual') : t('loadPreview.generated')}
                      </p>
                    )}
                  </div>
                )
              }}
            />
            <ReferenceLine yAxisId='volume' y={initialVolumeKm} stroke='var(--muted-foreground)' strokeDasharray='4 4' />
            <ReferenceLine yAxisId='volume' y={maximumVolumeKm} stroke='var(--destructive)' strokeDasharray='4 4' />
            <Line
              yAxisId='volume'
              type='monotone'
              dataKey='volumeKm'
              stroke='var(--color-volume)'
              strokeWidth={2}
              dot={(props) => {
                const point = props.payload as LoadProgressionPoint
                const appearance = getVolumePointAppearance(point)

                return (
                  <circle
                    cx={props.cx}
                    cy={props.cy}
                    r={appearance.radius}
                    fill={appearance.fill}
                    stroke={appearance.strokeWidth > 0 ? 'var(--background)' : 'none'}
                    strokeWidth={appearance.strokeWidth}
                  />
                )
              }}
              activeDot={{ r: 5 }}
            />
            {hasElevation && (
              <Line
                yAxisId='elevation'
                type='monotone'
                dataKey='elevationGain'
                stroke='var(--color-elevation)'
                strokeWidth={2}
                dot={(props) => {
                  const point = props.payload as LoadProgressionPoint
                  const appearance = getElevationPointAppearance(point)

                  return (
                    <circle
                      cx={props.cx}
                      cy={props.cy}
                      r={appearance.radius}
                      fill={appearance.fill}
                      stroke={appearance.strokeWidth > 0 ? 'var(--background)' : 'none'}
                      strokeWidth={appearance.strokeWidth}
                    />
                  )
                }}
                activeDot={{ r: 5 }}
              />
            )}
          </LineChart>
        </ChartContainer>

        <div className='flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground'>
          <span>{t('loadPreview.initial')}: {initialVolumeKm.toLocaleString(presentationLocale)} km</span>
          <span>{t('loadPreview.maximum')}: {maximumVolumeKm.toLocaleString(presentationLocale)} km</span>
          {hasElevation && (
            <span>{t('loadPreview.peakElevation')}: {Math.max(...elevationValues).toLocaleString(presentationLocale)} m</span>
          )}
          <span>{t('loadPreview.weeks', { count: points.length })}</span>
        </div>

        {warnings.length > 0 && (
          <div className='space-y-1 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm'>
            {warnings.map((warning) => <p key={warning}>{warning}</p>)}
          </div>
        )}

        {conflicts.length > 0 && (
          <div className='space-y-1 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive'>
            {conflicts.map((conflict) => <p key={conflict}>{conflict}</p>)}
          </div>
        )}

        <form action={formAction} className='flex flex-wrap items-center justify-between gap-3 border-t pt-4'>
          <input type='hidden' name='planId' value={planId} />
          <input type='hidden' name='macrocycleId' value={macrocycleId} />
          <input type='hidden' name='locale' value={locale} />
          <div className='text-sm text-muted-foreground'>
            {actionState.error ? (
              <p className='text-destructive' role='alert'>{actionState.error}</p>
            ) : conflicts.length > 0 ? (
              <p>{t('loadPreview.resolveConflicts')}</p>
            ) : (
              <p>{t('loadPreview.saveHelp')}</p>
            )}
          </div>
          <Button type='submit' disabled={isPending || conflicts.length > 0}>
            {isPending ? t('saving') : t('saveProgression')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
