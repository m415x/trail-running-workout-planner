import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { getAthleteById } from '@/app/actions/athlete-actions'
import { TrainingGoalForm } from '@/features/training-goals/components/TrainingGoalForm'
import { buttonVariants } from '@ui/button'
import { Card, CardContent } from '@ui/card'

interface NewTrainingGoalPageProps {
  params: Promise<{ locale: string; athleteId: string }>
}

export default async function NewTrainingGoalPage({ params }: NewTrainingGoalPageProps) {
  const { locale, athleteId } = await params
  const athlete = await getAthleteById(athleteId)

  if (!athlete) {
    notFound()
  }

  const athletePath = locale === 'es'
    ? `/dashboard/athletes/${athlete.id}`
    : `/${locale}/dashboard/athletes/${athlete.id}`
  const athleteName = `${athlete.user.firstName} ${athlete.user.lastName}`

  return (
    <div className='mx-auto w-full max-w-3xl space-y-6'>
      <div className='flex items-start gap-3'>
        <Link
          href={athletePath}
          aria-label='Volver al detalle del atleta'
          className={buttonVariants({ variant: 'ghost', size: 'icon' })}
        >
          <ArrowLeft />
        </Link>
        <div>
          <h2 className='text-3xl font-bold tracking-tight'>Nuevo objetivo</h2>
          <p className='text-muted-foreground'>Creá un objetivo de entrenamiento para {athleteName}.</p>
        </div>
      </div>

      <Card>
        <CardContent>
          <TrainingGoalForm athleteId={athlete.id} locale={locale} />
        </CardContent>
      </Card>
    </div>
  )
}
