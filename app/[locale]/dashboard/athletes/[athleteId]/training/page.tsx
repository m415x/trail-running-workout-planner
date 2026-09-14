import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Activity, ArrowLeft } from 'lucide-react'

import { getAthleteById } from '@/app/actions/athlete-actions'
import { getRealizedTrainingHistoryForAthleteAction } from '@/app/actions/realized-training-actions'
import { RealizedTrainingHistory } from '@/features/athletes/components/RealizedTrainingHistory'
import { buttonVariants } from '@ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@ui/card'

interface AthleteTrainingPageProps {
  params: Promise<{ locale: string; athleteId: string }>
}

function athletePath(locale: string, athleteId: string) {
  const base = locale === 'es' ? '/dashboard/athletes' : `/${locale}/dashboard/athletes`
  return `${base}/${athleteId}`
}

export default async function AthleteTrainingPage({ params }: AthleteTrainingPageProps) {
  const { locale, athleteId } = await params
  const [athlete, historyResult] = await Promise.all([
    getAthleteById(athleteId),
    getRealizedTrainingHistoryForAthleteAction(athleteId),
  ])

  if (!athlete || !historyResult.success) notFound()

  const fullName = `${athlete.user.firstName} ${athlete.user.lastName}`
  const detailPath = athletePath(locale, athlete.id)
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

      <Card>
        <CardHeader>
          <CardTitle>{fullName}</CardTitle>
        </CardHeader>
        <CardContent>
          <RealizedTrainingHistory records={historyResult.data} locale={locale} />
        </CardContent>
      </Card>
    </div>
  )
}
