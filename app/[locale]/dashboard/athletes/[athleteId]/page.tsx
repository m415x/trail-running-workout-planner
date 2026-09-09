import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CalendarRange, Mail, Pencil, Phone, ShieldAlert, Target, UsersRound } from 'lucide-react'

import { getAthleteById } from '@/app/actions/athlete-actions'
import { getAthletePlanningResolutionOnDate } from '@/app/actions/planning-cohort-actions'
import { Avatar, AvatarFallback, AvatarImage } from '@ui/avatar'
import { Badge } from '@ui/badge'
import { buttonVariants } from '@ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@ui/card'

interface AthleteDetailPageProps {
  params: Promise<{ locale: string; athleteId: string }>
}

function athletePath(locale: string, suffix = '') {
  const base = locale === 'es' ? '/dashboard/athletes' : `/${locale}/dashboard/athletes`
  return `${base}${suffix}`
}

function getInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

function formatDate(value: string | null) {
  if (!value) return 'No informado'

  return new Intl.DateTimeFormat('es-AR', { timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
}

function todayInArgentina() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function DetailItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className='text-sm text-muted-foreground'>{label}</dt>
      <dd className='mt-1 font-medium'>{value || 'No informado'}</dd>
    </div>
  )
}

export default async function AthleteDetailPage({ params }: AthleteDetailPageProps) {
  const { locale, athleteId } = await params
  const today = todayInArgentina()
  const [athlete, planningResult] = await Promise.all([
    getAthleteById(athleteId),
    getAthletePlanningResolutionOnDate(athleteId, today),
  ])

  if (!athlete) {
    notFound()
  }

  const fullName = `${athlete.user.firstName} ${athlete.user.lastName}`
  const groupCode = athlete.group
    ? `${athlete.group.categoryCode}${athlete.group.levelCode}`
    : null
  const listPath = athletePath(locale)
  const editPath = athletePath(locale, `/${athlete.id}/edit`)
  const groupPath = athletePath(locale, `/${athlete.id}/group`)
  const newGoalPath = athletePath(locale, `/${athlete.id}/goals/new`)
  const planningBasePath = locale === 'es' ? '/dashboard/planning' : `/${locale}/dashboard/planning`

  return (
    <div className='mx-auto w-full max-w-5xl space-y-6'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex items-center gap-4'>
          <Link
            href={listPath}
            aria-label='Volver al listado de atletas'
            className={buttonVariants({ variant: 'ghost', size: 'icon' })}
          >
            <ArrowLeft />
          </Link>

          <Avatar className='size-14'>
            <AvatarImage src={athlete.user.avatar ?? undefined} alt={fullName} />
            <AvatarFallback>{getInitials(athlete.user.firstName, athlete.user.lastName)}</AvatarFallback>
          </Avatar>

          <div>
            <div className='flex flex-wrap items-center gap-2'>
              <h2 className='text-3xl font-bold tracking-tight'>{fullName}</h2>
              {athlete.isActive ? (
                <Badge variant='outline' className='border-emerald-500/40 text-emerald-700 dark:text-emerald-400'>Activo</Badge>
              ) : (
                <Badge variant='outline' className='text-muted-foreground'>Inactivo</Badge>
              )}
            </div>
            <p className='text-muted-foreground'>{athlete.nickName ? `“${athlete.nickName}”` : 'Perfil del atleta'}</p>
          </div>
        </div>

        <div className='flex flex-wrap gap-2'>
          <Link href={newGoalPath} className={buttonVariants({ variant: 'outline' })}>
            <Target />
            Nuevo objetivo
          </Link>
          <Link href={groupPath} className={buttonVariants({ variant: 'outline' })}>
            <UsersRound />
            {athlete.groupId ? 'Cambiar grupo' : 'Asignar grupo'}
          </Link>
          <Link href={editPath} className={buttonVariants()}>
            <Pencil />
            Editar atleta
          </Link>
        </div>
      </div>

      <div className='grid gap-6 md:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle>Datos personales</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className='grid gap-5 sm:grid-cols-2'>
              <DetailItem label='DNI' value={athlete.dni} />
              <DetailItem label='Fecha de nacimiento' value={formatDate(athlete.birthday)} />
              <DetailItem label='Apodo' value={athlete.nickName} />
              <div>
                <dt className='text-sm text-muted-foreground'>Grupo</dt>
                <dd className='mt-1'>
                  {groupCode ? <Badge variant='secondary'>{groupCode}</Badge> : <Badge variant='outline'>Sin grupo</Badge>}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contacto</CardTitle>
          </CardHeader>
          <CardContent className='space-y-5'>
            <div className='flex gap-3'>
              <Mail className='mt-0.5 size-4 text-muted-foreground' />
              <div>
                <p className='text-sm text-muted-foreground'>Email</p>
                <p className='font-medium'>{athlete.user.email}</p>
              </div>
            </div>

            <div className='flex gap-3'>
              <Phone className='mt-0.5 size-4 text-muted-foreground' />
              <div>
                <p className='text-sm text-muted-foreground'>Teléfono</p>
                <p className='font-medium'>{athlete.phone || 'No informado'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className='md:col-span-2'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <CalendarRange className='size-5' />
              Planificación aplicable hoy
            </CardTitle>
          </CardHeader>
          <CardContent>
            {planningResult?.resolution.status === 'resolved' ? (
              <div className='flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between'>
                <div>
                  <div className='flex flex-wrap items-center gap-2'>
                    <p className='font-medium'>{planningResult.planTitle ?? 'Planificación sin título disponible'}</p>
                    <Badge variant={planningResult.resolution.source === 'cohort' ? 'default' : 'secondary'}>
                      {planningResult.resolution.source === 'cohort' ? 'Cohorte' : 'Plan grupal'}
                    </Badge>
                  </div>
                  <p className='mt-1 text-sm text-muted-foreground'>
                    {planningResult.resolution.source === 'cohort'
                      ? `Variante compartida por ${planningResult.cohortName ?? 'la cohorte aplicable'}.`
                      : 'Se usa el plan base del grupo porque no existe una variante de cohorte aplicable.'}
                  </p>
                </div>
                <Link href={`${planningBasePath}/${planningResult.resolution.planId}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  Ver planificación
                </Link>
              </div>
            ) : planningResult?.resolution.status === 'conflict' ? (
              <div role='alert' className='rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive'>
                No se pudo resolver una planificación única. Revisá las membresías de cohorte y los planes que cubren esta fecha.
              </div>
            ) : (
              <p className='rounded-lg border border-dashed p-4 text-sm text-muted-foreground'>
                No hay una planificación activa que cubra la fecha actual para el grupo del atleta.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className='md:col-span-2'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <ShieldAlert className='size-5' />
              Contacto de emergencia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className='grid gap-5 sm:grid-cols-2'>
              <DetailItem label='Contacto' value={athlete.emergencyContact} />
              <DetailItem label='Teléfono' value={athlete.emergencyPhone} />
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
