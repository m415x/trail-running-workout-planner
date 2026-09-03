import Link from 'next/link'
import { CalendarDays, MapPin, Plus } from 'lucide-react'

import { getSessionsByTeam } from '@/app/actions/session-actions'
import { Badge } from '@ui/badge'
import { buttonVariants } from '@ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/card'

interface SessionsPageProps { params: Promise<{ locale: string }> }

export default async function SessionsPage({ params }: SessionsPageProps) {
  const { locale } = await params
  const sessions = await getSessionsByTeam()
  const sessionsPath = locale === 'es' ? '/dashboard/sessions' : `/${locale}/dashboard/sessions`

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
        <div><h2 className='text-3xl font-bold tracking-tight'>Sesiones</h2><p className='text-muted-foreground'>Entrenamientos programados para el equipo.</p></div>
        <Link href={`${sessionsPath}/new`} className={buttonVariants()}><Plus /> Nueva sesión</Link>
      </div>

      {sessions.length === 0 ? (
        <Card><CardHeader><CardTitle>Todavía no hay sesiones</CardTitle><CardDescription>Programá la primera sesión para comenzar a construir el calendario de entrenamiento.</CardDescription></CardHeader></Card>
      ) : (
        <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
          {sessions.map((session) => (
            <Card key={session.id}>
              <CardHeader>
                <div className='flex items-start justify-between gap-3'><CardTitle>{session.title}</CardTitle>{session.type && <Badge variant='secondary'>{session.type}</Badge>}</div>
                <CardDescription className='flex items-center gap-1.5'><CalendarDays className='size-4' /> {formatDate(session.date)}</CardDescription>
              </CardHeader>
              <CardContent className='space-y-2 text-sm'>
                {session.location && <p className='flex items-center gap-1.5 text-muted-foreground'><MapPin className='size-4' /> {session.location.name}</p>}
                {session.notes && <p className='line-clamp-2 text-muted-foreground'>{session.notes}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(year, month - 1, day))
}
