import { Activity, CircleHelp, TrendingUp } from 'lucide-react'

import type { AthleteTrainingLoadState } from '@/types'
import { Badge } from '@ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@ui/card'

interface TrainingLoadSummaryProps {
  load: AthleteTrainingLoadState
  locale: string
}

function au(value: number | null, locale: 'es' | 'en') {
  if (value === null) return '—'
  return `${new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es-AR', {
    maximumFractionDigits: 1,
  }).format(value)} AU`
}

function percent(value: number | null, locale: 'es' | 'en') {
  if (value === null) return '—'
  return `${new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es-AR', {
    maximumFractionDigits: 0,
  }).format(value * 100)}%`
}

export function TrainingLoadSummary({ load, locale }: TrainingLoadSummaryProps) {
  const language: 'es' | 'en' = locale === 'en' ? 'en' : 'es'
  const labels = language === 'en'
    ? {
        title: 'Estimated training load',
        description: 'Internal load estimated from reliable realized training. It is a mathematical trend, not a direct physiological measurement.',
        daily: 'Latest daily load',
        short: 'Short-term estimated load',
        long: 'Long-term estimated load',
        balance: 'Estimated load balance',
        coverage: 'Evidence coverage',
        streak: 'Reliable streak',
        days: 'days',
        warming: 'Warming up',
        insufficient: 'Insufficient data',
        available: 'Available',
        method: 'Method',
        formula: 'session RPE × duration',
        caveat: 'Distance and elevation are contextual only and do not multiply AU in v1.',
      }
    : {
        title: 'Carga de entrenamiento estimada',
        description: 'Carga interna estimada desde entrenamiento realizado confiable. Es una tendencia matemática, no una medición fisiológica directa.',
        daily: 'Última carga diaria',
        short: 'Carga estimada de corto plazo',
        long: 'Carga estimada de largo plazo',
        balance: 'Balance de carga estimado',
        coverage: 'Cobertura de evidencia',
        streak: 'Racha confiable',
        days: 'días',
        warming: 'En calentamiento',
        insufficient: 'Datos insuficientes',
        available: 'Disponible',
        method: 'Método',
        formula: 'RPE de sesión × duración',
        caveat: 'Distancia y desnivel son contexto y no multiplican las AU en la v1.',
      }

  const statusLabel = load.status === 'available'
    ? labels.available
    : load.status === 'warming_up'
      ? labels.warming
      : labels.insufficient

  const latest = load.latest

  return (
    <Card>
      <CardHeader className='pb-3'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div>
            <CardTitle className='flex items-center gap-2'>
              <TrendingUp className='size-5' />
              {labels.title}
            </CardTitle>
            <p className='mt-1 max-w-3xl text-sm text-muted-foreground'>{labels.description}</p>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Badge variant='outline'>{statusLabel}</Badge>
            <Badge variant='outline'>{load.ruleVersion}</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className='space-y-4'>
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
          <div className='rounded-lg border p-4'>
            <p className='text-xs text-muted-foreground'>{labels.daily}</p>
            <p className='mt-1 text-xl font-semibold'>{au(latest?.dailyLoadAu ?? null, language)}</p>
          </div>
          <div className='rounded-lg border p-4'>
            <p className='text-xs text-muted-foreground'>{labels.short}</p>
            <p className='mt-1 text-xl font-semibold'>{au(latest?.shortTermLoadAu ?? null, language)}</p>
          </div>
          <div className='rounded-lg border p-4'>
            <p className='text-xs text-muted-foreground'>{labels.long}</p>
            <p className='mt-1 text-xl font-semibold'>{au(latest?.longTermLoadAu ?? null, language)}</p>
          </div>
          <div className='rounded-lg border p-4'>
            <p className='text-xs text-muted-foreground'>{labels.balance}</p>
            <p className='mt-1 text-xl font-semibold'>{au(latest?.loadBalanceAu ?? null, language)}</p>
          </div>
        </div>

        <div className='flex flex-wrap gap-2 text-xs'>
          <Badge variant='outline'>{labels.coverage}: {percent(load.coverage.coverageRatio, language)}</Badge>
          <Badge variant='outline'>{labels.streak}: {load.coverage.currentUsableStreakDays} {labels.days}</Badge>
          <Badge variant='outline'>{labels.method}: {labels.formula}</Badge>
        </div>

        <div className='flex gap-2 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground'>
          <CircleHelp className='mt-0.5 size-4 shrink-0' />
          <span>{labels.caveat}</span>
        </div>

        {load.status !== 'available' && (
          <div className='flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300'>
            <Activity className='size-4' />
            {statusLabel}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
