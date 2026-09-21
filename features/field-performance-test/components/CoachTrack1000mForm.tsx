'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { correctTrack1000mEvidenceAction, createCoachTrack1000mEvidenceAction, reviewCoachTrack1000mEvidenceAction } from '@/app/actions/field-performance-test-actions'
import { buttonVariants } from '@ui/button'

type TestEventOption = { id: string; scheduledAt: string }
type PendingEvidence = { id: string; performedAt: string; elapsedTimeSec: number }
type HistoryEvidence = { id: string; performedAt: string; elapsedTimeSec: number; notes: string | null; testEventId?: string | null; executionContext?: 'official' | 'self_directed'; recordedBy?: 'coach' | 'athlete'; recordedByUserId?: string | null }

export function CoachTrack1000mForm({ athleteId, locale, events, pendingEvidence, history, eventsError = false, pendingError = false }: { athleteId: string; locale: string; events: TestEventOption[]; pendingEvidence: PendingEvidence[]; history: HistoryEvidence[]; eventsError?: boolean; pendingError?: boolean }) {
  const es = locale === 'es'
  const router = useRouter()
  const [testEventId, setTestEventId] = useState(events[0]?.id ?? '')
  const [minutes, setMinutes] = useState('')
  const [seconds, setSeconds] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [reviewingEvidenceId, setReviewingEvidenceId] = useState<string | null>(null)
  const elapsedTimeSec = Number(minutes) * 60 + Number(seconds)
  const hasTime = minutes !== '' && seconds !== '' && elapsedTimeSec > 0

  async function register(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    const result = await createCoachTrack1000mEvidenceAction({ athleteId, testEventId, elapsedTimeSec })
    setBusy(false)
    setMessage(result.success ? (es ? 'Test oficial registrado.' : 'Official test recorded.') : result.error)
  }

  async function correct(evidence: HistoryEvidence) {
    const nextElapsedTime = window.prompt(
      es ? 'Nuevo tiempo en segundos' : 'New time in seconds',
      String(evidence.elapsedTimeSec),
    )
    if (nextElapsedTime === null) return

    setBusy(true)
    const result = await correctTrack1000mEvidenceAction({
      athleteId,
      evidenceId: evidence.id,
      replacement: {
        performedAt: evidence.performedAt,
        elapsedTimeSec: Number(nextElapsedTime),
        ...(evidence.notes === null ? {} : { notes: evidence.notes }),
        ...(evidence.testEventId == null ? {} : { testEventId: evidence.testEventId }),
        ...(evidence.executionContext === undefined ? {} : { executionContext: evidence.executionContext }),
        ...(evidence.recordedBy === undefined ? {} : { recordedBy: evidence.recordedBy }),
        ...(evidence.recordedByUserId == null ? {} : { recordedByUserId: evidence.recordedByUserId }),
      },
    })
    setBusy(false)
    setMessage(result.success ? (es ? 'Corrección guardada.' : 'Correction saved.') : result.error)
  }

  async function review(evidenceId: string, reviewStatus: 'accepted' | 'rejected') {
    setReviewingEvidenceId(evidenceId)
    const result = await reviewCoachTrack1000mEvidenceAction({ athleteId, evidenceId, reviewStatus })
    setReviewingEvidenceId(null)
    setMessage(result.success ? (es ? 'Revisión guardada.' : 'Review saved.') : result.error)
    if (result.success) router.refresh()
  }

  return <div className='grid gap-6 lg:grid-cols-2'>
    <form onSubmit={register} className='grid gap-3'>
      <h3 className='font-medium'>{es ? 'Registrar test oficial' : 'Record official test'}</h3>
      {eventsError ? <p role='alert' className='text-sm text-destructive'>{es ? 'No se pudieron cargar las instancias oficiales.' : 'Official test events could not be loaded.'}</p> : events.length === 0 ? <p className='rounded-lg border border-dashed p-3 text-sm text-muted-foreground'>{es ? 'No hay instancias oficiales disponibles.' : 'No official test events are available.'}</p> : <label className='grid gap-1'><span className='text-xs text-muted-foreground'>{es ? 'Instancia oficial' : 'Official test event'}</span><select value={testEventId} onChange={event => setTestEventId(event.target.value)} className='h-10 rounded-md border border-input bg-background px-3'>{events.map(item => <option key={item.id} value={item.id}>{item.scheduledAt.slice(0, 10)}</option>)}</select></label>}
      <div className='grid grid-cols-2 gap-3'>
        <label className='grid gap-1'><span className='text-xs text-muted-foreground'>{es ? 'Minutos' : 'Minutes'}</span><input aria-label={es ? 'Minutos' : 'Minutes'} type='number' min='0' step='1' required value={minutes} onChange={event => setMinutes(event.target.value)} className='h-10 rounded-md border border-input bg-background px-3' /></label>
        <label className='grid gap-1'><span className='text-xs text-muted-foreground'>{es ? 'Segundos' : 'Seconds'}</span><input aria-label={es ? 'Segundos' : 'Seconds'} type='number' min='0' max='59' step='1' required value={seconds} onChange={event => setSeconds(event.target.value)} className='h-10 rounded-md border border-input bg-background px-3' /></label>
      </div>
      <button type='submit' disabled={busy || !testEventId || !hasTime} className={buttonVariants({ size: 'sm' })}>{es ? 'Registrar' : 'Record'}</button>
    </form>
    <section className='space-y-3'><h3 className='font-medium'>{es ? 'Pendientes de revisión' : 'Pending review'}</h3>{pendingError ? <p role='alert' className='text-sm text-destructive'>{es ? 'No se pudieron cargar los pendientes.' : 'Pending submissions could not be loaded.'}</p> : pendingEvidence.length === 0 ? <p className='rounded-lg border border-dashed p-4 text-sm text-muted-foreground'>{es ? 'No hay registros pendientes.' : 'There are no pending submissions.'}</p> : pendingEvidence.map(item => <div key={item.id} className='rounded-lg border p-3'><p className='text-sm'>{item.performedAt} · {item.elapsedTimeSec} s</p><div className='mt-3 flex gap-2'><button type='button' disabled={reviewingEvidenceId === item.id} onClick={() => review(item.id, 'accepted')} className={buttonVariants({ size: 'sm' })}>{es ? 'Aceptar' : 'Accept'}</button><button type='button' disabled={reviewingEvidenceId === item.id} onClick={() => review(item.id, 'rejected')} className={buttonVariants({ variant: 'outline', size: 'sm' })}>{es ? 'Rechazar' : 'Reject'}</button></div></div>)}</section>
    <section className='space-y-3 lg:col-span-2'><h3 className='font-medium'>{es ? 'Histórico corregible' : 'Correctable history'}</h3>{history.length === 0 ? <p className='rounded-lg border border-dashed p-4 text-sm text-muted-foreground'>{es ? 'No hay registros activos.' : 'There are no active records.'}</p> : history.map(item => <div key={item.id} className='flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3'><p className='text-sm'>{item.performedAt} · {item.elapsedTimeSec} s</p><button type='button' disabled={busy} onClick={() => correct(item)} className={buttonVariants({ variant: 'outline', size: 'sm' })}>{es ? 'Corregir' : 'Correct'}</button></div>)}</section>
    {message && <p role='status' className='text-sm text-muted-foreground lg:col-span-2'>{message}</p>}
  </div>
}
