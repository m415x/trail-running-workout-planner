import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Activity, ArrowLeft } from 'lucide-react'

import { getAthleteById } from '@/app/actions/athlete-actions'
import {
  getAthleteAdherenceAction,
  getAthleteAdherenceTrendAction,
} from '@/app/actions/adherence-actions'
import {
  getAthletePlanRealComparisonAction,
  getRealizedTrainingCalendarForAthleteAction,
  getRealizedTrainingCorrectionsAction,
  getRealizedTrainingHistoryForAthleteAction,
} from '@/app/actions/realized-training-actions'
import { AdherenceSummary } from '@/features/athletes/components/AdherenceSummary'
import { PlanRealComparison } from '@/features/athletes/components/PlanRealComparison'
import { RealizedTrainingCalendar } from '@/features/athletes/components/RealizedTrainingCalendar'
import { RealizedTrainingHistory } from '@/features/athletes/components/RealizedTrainingHistory'
import type { RealizedTrainingCorrectionRecord } from '@/types/training/realized-training-correction.types'
import { buttonVariants } from '@ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@ui/card'

interface AthleteTrainingPageProps {
  params: Promise<{ locale: string; athleteId: string }>
  searchParams: Promise<{ comparison?: string }>
}

function formatISODate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function calendarWindow(today: string) {
  const current = new Date(`${today}T00:00:00Z`)
  const mondayOffset = (current.getUTCDay() + 6) % 7
  const start = new Date(current)
  start.setUTCDate(current.getUTCDate() - mondayOffset - 21)
  const end = new Date(start)
  end.setUTCDate(start.getUTCDate() + 34)
  return { startDate: formatISODate(start), endDate: formatISODate(end) }
}

function comparisonWindow(today: string, kind: 'week' | 'month') {
  const current = new Date(`${today}T00:00:00Z`)

  if (kind === 'month') {
    const start = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1))
    const end = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0))
    return { kind, startDate: formatISODate(start), endDate: formatISODate(end) }
  }

  const mondayOffset = (current.getUTCDay() + 6) % 7
  const start = new Date(current)
  start.setUTCDate(current.getUTCDate() - mondayOffset)
  const end = new Date(start)
  end.setUTCDate(start.getUTCDate() + 6)
  return { kind, startDate: formatISODate(start), endDate: formatISODate(end) }
}

function todayInArgentina() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function athletePath(locale: string, athleteId: string) {
  const base = locale === 'es' ? '/dashboard/athletes' : `/${locale}/dashboard/athletes`
  return `${base}/${athleteId}`
}

export default async function AthleteTrainingPage({ params, searchParams }: AthleteTrainingPageProps) {
  const [{ locale, athleteId }, query] = await Promise.all([params, searchParams])
  const today = todayInArgentina()
  const { startDate, endDate } = calendarWindow(today)
  const comparisonKind = query.comparison === 'month' ? 'month' as const : 'week' as const
  const planRealWindow = comparisonWindow(today, comparisonKind)
  const [athlete, historyResult, calendarResult, comparisonResult, adherenceResult, trendResult] = await Promise.all([
    getAthleteById(athleteId),
    getRealizedTrainingHistoryForAthleteAction(athleteId),
    getRealizedTrainingCalendarForAthleteAction(athleteId, startDate, endDate, today),
    getAthletePlanRealComparisonAction(athleteId, planRealWindow),
    getAthleteAdherenceAction(athleteId, planRealWindow),
    getAthleteAdherenceTrendAction(athleteId, today),
  ])

  if (
    !athlete
    || !historyResult.success
    || !calendarResult.success
    || !comparisonResult.success
    || !adherenceResult.success
    || !trendResult.success
  ) notFound()

  const correctionsEntries = await Promise.all(
    historyResult.data.map(async (record) => {
      const result = await getRealizedTrainingCorrectionsAction(athlete.id, record.id)
      return [record.id, result.success ? result.data : []] as const
    }),
  )
  const correctionsByWorkoutLogId: Readonly<Record<string, readonly RealizedTrainingCorrectionRecord[]>> =
    Object.fromEntries(correctionsEntries)

  const fullName = `${athlete.user.firstName} ${athlete.user.lastName}`
  const detailPath = athletePath(locale, athlete.id)
  const trainingPath = `${detailPath}/training`
  const labels = locale === 'en'
    ? {
        back: 'Back to athlete',
        title: 'Realized training',
        description: `Durable training evidence recorded for ${fullName}. Planned training is shown only as an explicit link, never as performed evidence.`,
      }
    : {
        back: 'Volver al atleta',
        title: 'Entrenamiento realizado',
        description: `Evidencia durable de entrenamiento registrada para ${fullName}. Lo planificado sólo se muestra como vínculo explícito, nunca como evidencia realizada.`,
      }

  return (
    <div className='mx-auto w-full max-w-5xl space-y-6'>
      <div className='flex items-start gap-4'>
        <Link
          href={detailPath}
          aria-label={labels.back}
          className={buttonVariants({ variant: 'ghost', size: 'icon' })}
        >
          <ArrowLeft />
        </Link>
        <div>
          <div className='flex items-center gap-2'>
            <Activity className='size-6' />
            <h2 className='text-3xl font-bold tracking-tight'>{labels.title}</h2>
          </div>
          <p className='mt-1 max-w-3xl text-muted-foreground'>{labels.description}</p>
        </div>
      </div>

      <AdherenceSummary
        adherence={adherenceResult.data}
        trend={trendResult.data}
        locale={locale}
      />

      <PlanRealComparison
        comparison={comparisonResult.data}
        locale={locale}
        weekHref={`${trainingPath}?comparison=week`}
        monthHref={`${trainingPath}?comparison=month`}
      />

      <RealizedTrainingCalendar
        days={calendarResult.data}
        startDate={startDate}
        endDate={endDate}
        today={today}
        locale={locale}
      />

      <Card>
        <CardHeader>
          <CardTitle>{fullName}</CardTitle>
        </CardHeader>
        <CardContent>
          <RealizedTrainingHistory
            records={historyResult.data}
            correctionsByWorkoutLogId={correctionsByWorkoutLogId}
            locale={locale}
          />
        </CardContent>
      </Card>
    </div>
  )
}
