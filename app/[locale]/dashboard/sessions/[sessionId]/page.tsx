import Link from 'next/link'
import { ArrowLeft, CalendarDays, MapPin, Mountain, Route } from 'lucide-react'
import { notFound } from 'next/navigation'

import { getSessionById } from '@/app/actions/session-actions'
import { Badge } from '@ui/badge'
import { buttonVariants } from '@ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/card'

interface SessionDetailPageProps {
  params: Promise<{ locale: string; sessionId: string }>
}

export default async function SessionDetailPage({ params }: SessionDetailPageProps) {
  const { locale, sessionId } = await params
  const session = await getSessionById(sessionId)

  if (!session) notFound()

  const sessionsPath = locale === 'es' ? '/dashboard/sessions' : `/${locale}/dashboard/sessions`
  const structureBlocks = [
    { label: 'Ejercicios preliminares', value: session.structure?.preliminaryExercises },
    { label: 'Entrada en calor', value: session.structure?.warmup },
    { label: 'Bloque principal', value: session.structure?.mainBlock },
    { label: 'Vuelta a la calma', value: session.structure?.cooldown },
  ].filter((block) => block.value)

  return (
    <div className='mx-auto w-full max-w-4xl space-y-6'>
      <Link href={sessionsPath} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
        <ArrowLeft /> Volver al calendario
      </Link>

      <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
        <div>
          <h2 className='text-3xl font-bold tracking-tight'>{session.title}</h2>
          <p className='mt-1 flex items-center gap-2 text-muted-foreground'>
            <CalendarDays className='size-4' /> {formatDate(session.date)}
          </p>
        </div>
        <Badge className='w-fit'>{session.type}</Badge>
      </div>

      <div className='grid gap-4 md:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle>Información general</CardTitle>
            <CardDescription>Datos compartidos de la sesión.</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4 text-sm'>
            <DetailRow icon={MapPin} label='Ubicación' value={session.location?.name} />
            <DetailRow icon={Mountain} label='Plantilla' value={session.workout?.title} />
            <DetailRow icon={Route} label='Track' value={session.trackPath} breakAll />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notas</CardTitle>
            <CardDescription>Indicaciones generales para el entrenamiento.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className='whitespace-pre-wrap text-sm text-muted-foreground'>{session.notes || 'Sin notas generales.'}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Estructura de la sesión</CardTitle>
          <CardDescription>Bloques definidos para desarrollar el entrenamiento.</CardDescription>
        </CardHeader>
        <CardContent>
          {structureBlocks.length === 0 ? (
            <p className='text-sm text-muted-foreground'>Esta sesión no tiene una estructura detallada.</p>
          ) : (
            <div className='grid gap-4 sm:grid-cols-2'>
              {structureBlocks.map((block) => (
                <div key={block.label} className='rounded-lg border bg-muted/20 p-4'>
                  <h3 className='text-sm font-semibold'>{block.label}</h3>
                  <p className='mt-2 whitespace-pre-wrap text-sm text-muted-foreground'>{block.value}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

interface DetailRowProps {
  icon: typeof MapPin
  label: string
  value?: string | null
  breakAll?: boolean
}

function DetailRow({ icon: Icon, label, value, breakAll = false }: DetailRowProps) {
  return (
    <div className='flex items-start gap-3'>
      <Icon className='mt-0.5 size-4 shrink-0 text-muted-foreground' />
      <div className='min-w-0'>
        <p className='font-medium'>{label}</p>
        <p className={breakAll ? 'break-all text-muted-foreground' : 'text-muted-foreground'}>{value || 'Sin especificar'}</p>
      </div>
    </div>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}
