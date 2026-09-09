import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CalendarRange, Eye, UsersRound } from 'lucide-react'

import { getPlanningCohortDetail } from '@/app/actions/planning-cohort-actions'
import { isPlanningCohortMembershipActiveOn } from '@/lib/planning-cohorts/membership-view'
import { Badge } from '@ui/badge'
import { buttonVariants } from '@ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ui/table'

interface PlanningCohortDetailPageProps {
  params: Promise<{ locale: string; cohortId: string }>
}

function todayInArgentina() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function formatDate(value: string | null) {
  if (value === null) return 'Sin fecha de fin'
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

export default async function PlanningCohortDetailPage({ params }: PlanningCohortDetailPageProps) {
  const { locale, cohortId } = await params
  const cohort = await getPlanningCohortDetail(cohortId)

  if (!cohort) {
    notFound()
  }

  const cohortsPath = locale === 'es' ? '/dashboard/cohorts' : `/${locale}/dashboard/cohorts`
  const athletesPath = locale === 'es' ? '/dashboard/athletes' : `/${locale}/dashboard/athletes`
  const planningPath = locale === 'es' ? '/dashboard/planning' : `/${locale}/dashboard/planning`
  const groupCode = `${cohort.group.categoryCode}${cohort.group.levelCode}`
  const today = todayInArgentina()
  const visibleMemberships = cohort.memberships
  const activeMembers = visibleMemberships.filter((membership) => (
    isPlanningCohortMembershipActiveOn(membership, today)
  )).length

  return (
    <div className='space-y-6'>
      <div className='flex items-start gap-3'>
        <Link
          href={cohortsPath}
          aria-label='Volver al listado de cohortes'
          className={buttonVariants({ variant: 'ghost', size: 'icon' })}
        >
          <ArrowLeft />
        </Link>
        <div>
          <div className='flex flex-wrap items-center gap-2'>
            <h2 className='text-3xl font-bold tracking-tight'>{cohort.name}</h2>
            <Badge variant={cohort.status === 'active' ? 'default' : 'secondary'}>
              {cohort.status === 'active' ? 'Activa' : 'Archivada'}
            </Badge>
            <Badge variant='outline'>Grupo {groupCode}</Badge>
          </div>
          <p className='text-muted-foreground'>{cohort.purpose}</p>
          {cohort.description && <p className='mt-2 max-w-3xl text-sm'>{cohort.description}</p>}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <CalendarRange className='size-5' />
            Variante de planificación
          </CardTitle>
          <CardDescription>
            Plan compartido por las membresías vigentes de esta cohorte.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cohort.planningVariant ? (
            <div className='flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between'>
              <div>
                <p className='font-medium'>{cohort.planningVariant.title}</p>
                <p className='text-sm text-muted-foreground'>
                  Estado: {cohort.planningVariant.status} · Origen: {cohort.planningVariant.sourceGroupTrainingPlan?.title ?? 'No disponible'}
                </p>
              </div>
              <Link
                href={`${planningPath}/${cohort.planningVariant.id}`}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                <Eye /> Abrir planificación
              </Link>
            </div>
          ) : (
            <p className='rounded-lg border border-dashed p-4 text-sm text-muted-foreground'>
              Esta cohorte todavía no tiene una variante de planificación asociada.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <UsersRound className='size-5' />
            Integrantes e historial
          </CardTitle>
          <CardDescription>
            {visibleMemberships.length === 0
              ? 'Esta cohorte todavía no tiene membresías registradas.'
              : `${visibleMemberships.length} ${visibleMemberships.length === 1 ? 'período registrado' : 'períodos registrados'} · ${activeMembers} ${activeMembers === 1 ? 'vigente' : 'vigentes'} hoy`}
          </CardDescription>
        </CardHeader>

        {visibleMemberships.length > 0 && (
          <CardContent>
            <div className='overflow-hidden rounded-lg border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Atleta</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className='w-16'><span className='sr-only'>Acciones</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleMemberships.map((membership) => {
                    const athlete = membership.athleteProfile
                    const fullName = `${athlete.user.firstName} ${athlete.user.lastName}`
                    const isCurrent = isPlanningCohortMembershipActiveOn(membership, today)

                    return (
                      <TableRow key={membership.id}>
                        <TableCell>
                          <p className='font-medium'>{fullName}</p>
                          {athlete.nickName && (
                            <p className='text-xs text-muted-foreground'>“{athlete.nickName}”</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <p>{formatDate(membership.startDate)}</p>
                          <p className='text-xs text-muted-foreground'>
                            {membership.endDate === null
                              ? 'Sin fecha de fin'
                              : `hasta ${formatDate(membership.endDate)}`}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={isCurrent ? 'default' : 'outline'}>
                            {isCurrent ? 'Vigente' : 'Histórica'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`${athletesPath}/${athlete.id}`}
                            aria-label={`Ver detalle de ${fullName}`}
                            className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
                          >
                            <Eye />
                          </Link>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
