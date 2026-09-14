import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Activity, ArrowLeft } from 'lucide-react'

import { getAthleteById } from '@/app/actions/athlete-actions'
import { getAthleteAdherenceTrendAction } from '@/app/actions/adherence-actions'
import {
  getAthletePlanRealComparisonAction,
  getRealizedTrainingCalendarForAthleteAction,
  getRealizedTrainingCorrectionsAction,
  getRealizedTrainingHistoryForAthleteAction,
} from '@/app/actions/realized-training-actions'
import { getAthleteTrainingLoadAction } from '@/app/actions/training-load-actions'
import { AdherenceSummary } from '@/features/athletes/components/AdherenceSummary'
import { PlanRealComparison } from '@/features/athletes/components/PlanRealComparison'
import { RealizedTrainingCalendar } from '@/features/athletes/components/RealizedTrainingCalendar'
import { RealizedTrainingHistory } from '@/features/athletes/components/RealizedTrainingHistory'
import { TrainingLoadSummary } from '@/features/athletes/components/TrainingLoadSummary'
import { deriveAthleteAdherence } from '@/lib/adherence/athlete-adherence'
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

function trainingLoadWindow(today: string) {
  const end = new Date(`${today}T00:00:00Z`)
  const start = new Date(end)
  start.setUTCDate(end.getUTCDate() - 83)
  return { startDate: formatISODate(start), endDate: today }
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
  const loadWindow = trainingLoadWindow(today)
  const comparisonKind = query.comparison === 'month' ? 'month' as const : 'week' as const
  const planRealWindow = comparisonWindow(today, comparisonKind)
  const [athlete, historyResult, calendarResult, comparisonResult, trendResult, loadResult] = await Promise.all([
    getAthleteById(athleteId),
    getRealizedTrainingHistoryForAthleteAction(athleteId),
    getRealizedTrainingCalendarForAthleteAction(athleteId, startDate, endDate, today),
    getAthletePlanRealComparisonAction(athleteId, planRealWindow),
    getAthleteAdherenceTrendAction(athleteId, today),
    getAthleteTrainingLoadAction(athleteId, loadWindow.startDate, loadWindow.endDate),
  ])

  if (
    !athlete
    || !historyResult.success
    || !calendarResult.success
    || !comparisonResult.success
    || !comparisonResult.data
    || !trendResult.success
    || !trendResult.data
    || !loadResult.success
    || !loadResult.data
  ) notFound()

  const adherence = deriveAthleteAdherence(comparisonResult.data)
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

      <TrainingLoadSummary load={loadResult.data} locale={locale} />

      <AdherenceSummary
        adherence={adherence}
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
