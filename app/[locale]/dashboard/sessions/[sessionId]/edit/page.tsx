import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'

import { getSessionById, getSessionFormOptions } from '@/app/actions/session-actions'
import { SessionForm } from '@/features/sessions/components/SessionForm'
import { buttonVariants } from '@ui/button'

interface EditSessionPageProps {
  params: Promise<{ locale: string; sessionId: string }>
}

export default async function EditSessionPage({ params }: EditSessionPageProps) {
  const { locale, sessionId } = await params
  const [session, options] = await Promise.all([getSessionById(sessionId), getSessionFormOptions()])

  if (!session) notFound()

  const sessionPath = locale === 'es'
    ? `/dashboard/sessions/${session.id}`
    : `/${locale}/dashboard/sessions/${session.id}`

  return (
    <div className='mx-auto w-full max-w-4xl space-y-6'>
      <div className='space-y-2'>
        <Link href={sessionPath} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          <ArrowLeft /> Volver al detalle
        </Link>
        <div>
          <h2 className='text-3xl font-bold tracking-tight'>Editar sesión</h2>
          <p className='text-muted-foreground'>Actualizá la sesión y las prescripciones específicas de cada grupo.</p>
        </div>
      </div>

      <SessionForm locale={locale} {...options} session={session} />
    </div>
  )
}
