import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CalendarDays } from 'lucide-react'

import { getGroupTrainingPlanById } from '@/app/actions/planning-actions'
import { MicrocycleVolumeForm } from '@/features/planning/components/MicrocycleVolumeForm'
import { Badge } from '@ui/badge'
import { buttonVariants } from '@ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ui/table'

interface PlanningDetailPageProps {
  params: Promise<{ locale: string; planId: string }>
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-AR', { timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
}

export default async function PlanningDetailPage({ params }: PlanningDetailPageProps) {
  const { locale, planId } = await params
  const plan = await getGroupTrainingPlanById(planId)

  if (!plan) {
    notFound()
  }

  const planningPath = locale === 'es' ? '/dashboard/planning' : `/${locale}/dashboard/planning`
  const groupCode = `${plan.group.categoryCode}${plan.group.levelCode}`

  return (
    <div className='space-y-6'>
      <div className='flex items-start gap-3'>
        <Link
          href={planningPath}
          aria-label='Volver a planificaciones'
          className={buttonVariants({ variant: 'ghost', size: 'icon' })}
        >
          <ArrowLeft />
        </Link>
        <div>
          <div className='flex flex-wrap items-center gap-2'>
            <h2 className='text-3xl font-bold tracking-tight'>{plan.title}</h2>
            <Badge variant='secondary'>Grupo {groupCode}</Badge>
          </div>
          <p className='text-muted-foreground'>Editá el volumen objetivo de cada semana sin regenerar la planificación.</p>
        </div>
      </div>

      {plan.macrocycles.map((macrocycle) => (
        <div key={macrocycle.id} className='space-y-4'>
          <div className='flex flex-wrap items-center gap-2'>
            <CalendarDays className='size-5 text-muted-foreground' />
            <h3 className='text-xl font-semibold'>{macrocycle.title}</h3>
            <span className='text-sm text-muted-foreground'>
              {formatDate(macrocycle.startDate)} – {formatDate(macrocycle.endDate)}
            </span>
          </div>

          {macrocycle.mesocycles.map((mesocycle) => (
            <Card key={mesocycle.id}>
              <CardHeader>
                <CardTitle>{mesocycle.title}</CardTitle>
                <CardDescription>{mesocycle.objective}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className='overflow-hidden rounded-lg border'>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Semana</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Fechas</TableHead>
                        <TableHead>Desnivel</TableHead>
                        <TableHead className='text-right'>Volumen objetivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mesocycle.microcycles.map((microcycle) => (
                        <TableRow key={microcycle.id}>
                          <TableCell className='font-medium'>{microcycle.weekNumber}</TableCell>
                          <TableCell><Badge variant='outline'>{microcycle.type}</Badge></TableCell>
                          <TableCell>{formatDate(microcycle.startDate)} – {formatDate(microcycle.endDate)}</TableCell>
                          <TableCell>
                            {microcycle.targetElevationGain == null ? '—' : `${microcycle.targetElevationGain} m`}
                          </TableCell>
                          <TableCell>
                            <div className='flex justify-end'>
                              <MicrocycleVolumeForm
                                microcycleId={microcycle.id}
                                planId={plan.id}
                                locale={locale}
                                currentVolumeKm={microcycle.targetVolumeKm}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ))}
    </div>
  )
}
