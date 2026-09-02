import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { getActiveAthleteGroups, getAthleteById } from '@/app/actions/athlete-actions'
import { AthleteGroupForm } from '@/features/athletes/components/AthleteGroupForm'
import { Badge } from '@ui/badge'
import { buttonVariants } from '@ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@ui/card'

interface AthleteGroupPageProps {
  params: Promise<{ locale: string; athleteId: string }>
}

function detailPath(locale: string, athleteId: string) {
  const base = locale === 'es' ? '/dashboard/athletes' : `/${locale}/dashboard/athletes`
  return `${base}/${athleteId}`
}

function currentDate() {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

export default async function AthleteGroupPage({ params }: AthleteGroupPageProps) {
  const { locale, athleteId } = await params
  const [athlete, groups] = await Promise.all([
    getAthleteById(athleteId),
    getActiveAthleteGroups(),
  ])

  if (!athlete) {
    notFound()
  }

  const athleteName = `${athlete.user.firstName} ${athlete.user.lastName}`
  const groupCode = athlete.group
    ? `${athlete.group.categoryCode}${athlete.group.levelCode}`
    : null

  return (
    <div className='mx-auto w-full max-w-2xl space-y-6'>
      <div className='flex items-start gap-3'>
        <Link
          href={detailPath(locale, athlete.id)}
          aria-label='Volver al detalle del atleta'
          className={buttonVariants({ variant: 'ghost', size: 'icon' })}
        >
          <ArrowLeft />
        </Link>
        <div>
          <h2 className='text-3xl font-bold tracking-tight'>
            {groupCode ? 'Cambiar grupo' : 'Asignar a grupo'}
          </h2>
          <p className='text-muted-foreground'>Definí el grupo operativo actual de {athleteName}.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className='flex flex-wrap items-center gap-2 text-lg'>
            Grupo actual
            {groupCode
              ? <Badge variant='secondary'>{groupCode}</Badge>
              : <Badge variant='outline'>Sin grupo</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AthleteGroupForm
            athleteId={athlete.id}
            athleteName={athleteName}
            currentGroupId={athlete.groupId}
            groups={groups}
            locale={locale}
            defaultEffectiveDate={currentDate()}
          />
        </CardContent>
      </Card>
    </div>
  )
}
