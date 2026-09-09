import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CalendarRange, Eye, LogOut, Pencil, UserPlus, UsersRound } from 'lucide-react'

import { getPlanningCohortDetail } from '@/app/actions/planning-cohort-actions'
import { classifyPlanningCohortMembership } from '@/lib/planning-cohorts/membership-view'
import { Badge } from '@ui/badge'
import { buttonVariants } from '@ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ui/table'

interface PlanningCohortDetailPageProps {
  params: Promise<{ locale: string; cohortId: string }>
}

type CohortMembership = NonNullable<Awaited<ReturnType<typeof getPlanningCohortDetail>>>['memberships'][number]

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

function MembershipTable({
  memberships,
  athletesPath,
  cohortPath,
  allowClose,
}: {
  memberships: CohortMembership[]
  athletesPath: string
  cohortPath: string
  allowClose: boolean
}) {
  return (
    <div className='overflow-hidden rounded-lg border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Atleta</TableHead>
            <TableHead>Período</TableHead>
            <TableHead>Motivo</TableHead>
            <TableHead className='w-28'><span className='sr-only'>Acciones</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {memberships.map((membership) => {
            const athlete = membership.athleteProfile
            const fullName = `${athlete.user.firstName} ${athlete.user.lastName}`

            return (
              <TableRow key={membership.id}>
                <TableCell>
                  <p className='font-medium'>{fullName}</p>
                  {athlete.nickName && <p className='text-xs text-muted-foreground'>“{athlete.nickName}”</p>}
                </TableCell>
                <TableCell>
                  <p>{formatDate(membership.startDate)}</p>
                  <p className='text-xs text-muted-foreground'>
                    {membership.endDate === null ? 'Sin fecha de fin' : `hasta ${formatDate(membership.endDate)}`}
                  </p>
                </TableCell>
                <TableCell className='max-w-72'>
                  <p className='truncate'>{membership.assignmentReason ?? 'Sin motivo de asignación'}</p>
                  {membership.endReason && <p className='truncate text-xs text-muted-foreground'>Cierre: {membership.endReason}</p>}
                </TableCell>
                <TableCell>
                  <div className='flex justify-end gap-1'>
                    <Link href={`${athletesPath}/${athlete.id}`} aria-label={`Ver detalle de ${fullName}`} className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}><Eye /></Link>
                    {allowClose && membership.endDate === null && (
                      <Link href={`${cohortPath}/members/${membership.id}/close`} aria-label={`Retirar a ${fullName} de la cohorte`} className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}><LogOut /></Link>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
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
  const cohortPath = `${cohortsPath}/${cohort.id}`
  const currentMemberships = cohort.memberships.filter((membership) => classifyPlanningCohortMembership(membership, today) === 'current')
  const scheduledMemberships = cohort.memberships.filter((membership) => classifyPlanningCohortMembership(membership, today) === 'scheduled')
  const historicalMemberships = cohort.memberships.filter((membership) => classifyPlanningCohortMembership(membership, today) === 'historical')

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
        <div className='min-w-0 flex-1'>
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
        <Link href={`${cohortsPath}/${cohort.id}/edit`} className={buttonVariants({ variant: 'outline' })}>
          <Pencil /> {cohort.status === 'active' ? 'Editar' : 'Ver archivo'}
        </Link>
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
          <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
            <div>
              <CardTitle className='flex items-center gap-2'><UsersRound className='size-5' /> Integrantes vigentes</CardTitle>
              <CardDescription>
                {currentMemberships.length === 0
                  ? 'No hay atletas siguiendo esta planificación hoy.'
                  : `${currentMemberships.length} ${currentMemberships.length === 1 ? 'atleta sigue' : 'atletas siguen'} esta planificación hoy.`}
              </CardDescription>
            </div>
            {cohort.status === 'active' && (
              <Link href={`${cohortPath}/members/new`} className={buttonVariants({ size: 'sm' })}><UserPlus /> Asignar atleta</Link>
            )}
          </div>
        </CardHeader>
        {currentMemberships.length > 0 && <CardContent><MembershipTable memberships={currentMemberships} athletesPath={athletesPath} cohortPath={cohortPath} allowClose={cohort.status === 'active'} /></CardContent>}
      </Card>

      {scheduledMemberships.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Próximas incorporaciones <Badge variant='outline'>{scheduledMemberships.length}</Badge></CardTitle>
            <CardDescription>Atletas cuyo período en la cohorte todavía no comenzó.</CardDescription>
          </CardHeader>
          <CardContent><MembershipTable memberships={scheduledMemberships} athletesPath={athletesPath} cohortPath={cohortPath} allowClose={cohort.status === 'active'} /></CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Historial de membresías <Badge variant='secondary'>{historicalMemberships.length}</Badge></CardTitle>
          <CardDescription>Períodos finalizados que se conservan para trazabilidad.</CardDescription>
        </CardHeader>
        {historicalMemberships.length > 0
          ? <CardContent><MembershipTable memberships={historicalMemberships} athletesPath={athletesPath} cohortPath={cohortPath} allowClose={false} /></CardContent>
          : <CardContent><p className='text-sm text-muted-foreground'>Todavía no hay períodos finalizados.</p></CardContent>}
      </Card>
    </div>
  )
}
