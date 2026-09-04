import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { getActiveAthleteGroups } from '@/app/actions/athlete-actions'
import { LoadStrategyForm } from '@/features/planning/components/LoadStrategyForm'
import type { AthleteGroupCode } from '@/types'
import { buttonVariants } from '@ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@ui/card'

interface NewPlanningPageProps {
  params: Promise<{ locale: string }>
}

export default async function NewPlanningPage({ params }: NewPlanningPageProps) {
  const { locale } = await params
  const groups = await getActiveAthleteGroups()
  const planningPath = locale === 'es' ? '/dashboard/planning' : `/${locale}/dashboard/planning`

  return (
    <div className='mx-auto w-full max-w-5xl space-y-6'>
      <div className='space-y-2'>
        <Link href={planningPath} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          <ArrowLeft /> Volver a planificación
        </Link>
        <div>
          <h2 className='text-3xl font-bold tracking-tight'>Nueva estrategia de carga</h2>
          <p className='text-muted-foreground'>Configurá el punto de partida para la planificación del grupo.</p>
        </div>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No hay grupos activos</CardTitle>
            <CardDescription>Activá o creá un grupo antes de configurar su estrategia de carga.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <LoadStrategyForm
          locale={locale}
          groups={groups.map((group) => ({
            id: group.id,
            code: `${group.categoryCode}${group.levelCode}` as AthleteGroupCode,
            description: group.description,
          }))}
        />
      )}
    </div>
  )
}
