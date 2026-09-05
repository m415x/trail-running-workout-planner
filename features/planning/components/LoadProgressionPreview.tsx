'use client'

import { useActionState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { MicrocycleType, TargetVolumeSource } from '@/types'
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
  source: TargetVolumeSource
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

const microcycleLabels: Record<MicrocycleType, string> = {
  base: 'Base',
  development: 'Desarrollo',
  shock: 'Carga',
  deload: 'Descarga',
  tapering: 'Taper',
  race: 'Carrera',
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
  const manualPoints = points.filter((point) => point.source === 'manual')
  const [actionState, formAction, isPending] = useActionState(
    saveLoadProgression,
    initialActionState,
  )

  return (
    <Card>
      <CardHeader>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div>
            <CardTitle>Vista previa de carga</CardTitle>
            <CardDescription>
              Propuesta semanal calculada desde la estrategia y el horizonte guardados.
            </CardDescription>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Badge variant='secondary'>Generado</Badge>
            {manualPoints.length > 0 && <Badge variant='outline'>Manual: {manualPoints.length}</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className='space-y-5'>
        <ChartContainer
          config={{ volume: { label: 'Volumen', color: 'var(--chart-1)' } }}
          className='h-72 w-full aspect-auto'
        >
          <LineChart data={points} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey='weekNumber' tickLine={false} axisLine={false} tickFormatter={(value) => `S${value}`} />
            <YAxis
              unit=' km'
              width={52}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              domain={['dataMin - 5', 'dataMax + 5']}
            />
            <Tooltip
              content={({ active, label }) => {
                const point = points.find((candidate) => (
                  candidate.weekNumber === Number(label)
                ))

                if (!active || !point) return null

                return (
                  <div className='space-y-1 rounded-md border bg-background px-3 py-2 text-sm shadow-md'>
                    <p className='font-medium'>Semana {point.weekNumber}</p>
                    <p className='text-muted-foreground'>
                      {microcycleLabels[point.type]} · {point.source === 'manual' ? 'Manual' : 'Generado'}
                    </p>
                    <p className='font-semibold'>{point.volumeKm.toLocaleString('es-AR')} km</p>
                    {point.elevationGain !== null && (
                      <p className='font-semibold'>+{point.elevationGain.toLocaleString('es-AR')} m D+</p>
                    )}
                  </div>
                )
              }}
            />
            <ReferenceLine y={initialVolumeKm} stroke='var(--muted-foreground)' strokeDasharray='4 4' />
            <ReferenceLine y={maximumVolumeKm} stroke='var(--destructive)' strokeDasharray='4 4' />
            <Line
              type='monotone'
              dataKey='volumeKm'
              stroke='var(--color-volume)'
              strokeWidth={2}
              dot={(props) => {
                const point = props.payload as LoadProgressionPoint

                return (
                  <circle
                    cx={props.cx}
                    cy={props.cy}
                    r={point.source === 'manual' ? 5 : 3}
                    fill={point.source === 'manual' ? 'var(--chart-4)' : 'var(--color-volume)'}
                    stroke={point.source === 'manual' ? 'var(--background)' : 'none'}
                    strokeWidth={point.source === 'manual' ? 2 : 0}
                  />
                )
              }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ChartContainer>

        <div className='flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground'>
          <span>Inicio: {initialVolumeKm.toLocaleString('es-AR')} km</span>
          <span>Máximo: {maximumVolumeKm.toLocaleString('es-AR')} km</span>
          <span>{points.length} semanas</span>
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
              <p>Resolvé los conflictos antes de guardar la propuesta.</p>
            ) : (
              <p>El guardado conservará los volúmenes marcados como manuales.</p>
            )}
          </div>
          <Button type='submit' disabled={isPending || conflicts.length > 0}>
            {isPending ? 'Guardando…' : 'Guardar progresión'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
