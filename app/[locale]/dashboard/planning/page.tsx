import Link from 'next/link'
import { ArrowRight, CalendarRange } from 'lucide-react'

import { getGroupTrainingPlans } from '@/app/actions/planning-actions'
import { Badge } from '@ui/badge'
import { buttonVariants } from '@ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/card'

interface PlanningPageProps {
  params: Promise<{ locale: string }>
}

const statusLabels = {
  draft: 'Borrador',
  active: 'Activo',
  completed: 'Completado',
  cancelled: 'Cancelado',
} as const

export default async function PlanningPage({ params }: PlanningPageProps) {
  const { locale } = await params
  const plans = await getGroupTrainingPlans()
  const planningPath = locale === 'es' ? '/dashboard/planning' : `/${locale}/dashboard/planning`

  return (
    <div className='space-y-6'>
      <div>
        <h2 className='text-3xl font-bold tracking-tight'>Planificación</h2>
        <p className='text-muted-foreground'>Planes grupales, bloques y volúmenes semanales del equipo.</p>
      </div>

      {plans.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Todavía no hay planificaciones</CardTitle>
            <CardDescription>Las planificaciones generadas para los grupos aparecerán aquí.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
          {plans.map((plan) => {
            const groupCode = `${plan.group.categoryCode}${plan.group.levelCode}`
            const macrocycleCount = plan.macrocycles.length
            const microcycleCount = plan.macrocycles.reduce(
              (total, macrocycle) => total + macrocycle.mesocycles.reduce(
                (subtotal, mesocycle) => subtotal + mesocycle.microcycles.length,
                0,
              ),
              0,
            )

            return (
              <Card key={plan.id}>
                <CardHeader>
                  <div className='flex items-start justify-between gap-3'>
                    <div>
                      <CardTitle>{plan.title}</CardTitle>
                      <CardDescription>Grupo {groupCode}</CardDescription>
                    </div>
                    <Badge variant={plan.status === 'active' ? 'default' : 'secondary'}>
                      {statusLabels[plan.status]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className='space-y-4'>
                  <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                    <CalendarRange className='size-4' />
                    {macrocycleCount} {macrocycleCount === 1 ? 'macrociclo' : 'macrociclos'} · {microcycleCount} semanas
                  </div>
                  <div className='flex justify-end'>
                    <Link href={`${planningPath}/${plan.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                      Ver planificación <ArrowRight />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
