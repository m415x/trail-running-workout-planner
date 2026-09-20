'use client'

import { useState } from 'react'

import { correctTrack1000mEvidenceAction, createCoachTrack1000mEvidenceAction, reviewCoachTrack1000mEvidenceAction } from '@/app/actions/field-performance-test-actions'
import { buttonVariants } from '@ui/button'

type TestEventOption = { id: string; scheduledAt: string }
type PendingEvidence = { id: string; performedAt: string; elapsedTimeSec: number }
type HistoryEvidence = { id: string; performedAt: string; elapsedTimeSec: number; notes: string | null; testEventId?: string | null; executionContext?: 'official' | 'self_directed'; recordedBy?: 'coach' | 'athlete'; recordedByUserId?: string | null }

export function CoachTrack1000mForm({ athleteId, locale, events, pendingEvidence, history }: { athleteId: string; locale: string; events: TestEventOption[]; pendingEvidence: PendingEvidence[]; history: HistoryEvidence[] }) {
  const es = locale === 'es'
  const [testEventId, setTestEventId] = useState(events[0]?.id ?? '')
  const [elapsedTimeSec, setElapsedTimeSec] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function register(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    const result = await createCoachTrack1000mEvidenceAction({ athleteId, testEventId, elapsedTimeSec: Number(elapsedTimeSec) })
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
    setBusy(true)
    const result = await reviewCoachTrack1000mEvidenceAction({ athleteId, evidenceId, reviewStatus })
    setBusy(false)
    setMessage(result.success ? (es ? 'Revisión guardada.' : 'Review saved.') : result.error)
  }

  return <div className='grid gap-6 lg:grid-cols-2'>
    <form onSubmit={register} className='grid gap-3'><h3 className='font-medium'>{es ? 'Registrar test oficial' : 'Record official test'}</h3><select value={testEventId} onChange={event => setTestEventId(event.target.value)} className='h-10 rounded-md border border-input bg-background px-3'>{events.map(item => <option key={item.id} value={item.id}>{item.scheduledAt.slice(0, 10)}</option>)}</select><input aria-label={es ? 'Tiempo en segundos' : 'Time in seconds'} type='number' min='1' step='0.1' required value={elapsedTimeSec} onChange={event => setElapsedTimeSec(event.target.value)} className='h-10 rounded-md border border-input bg-background px-3' /><button type='submit' disabled={busy || !testEventId || !elapsedTimeSec} className={buttonVariants({ size: 'sm' })}>{es ? 'Registrar' : 'Record'}</button></form>
    <section className='space-y-3'><h3 className='font-medium'>{es ? 'Pendientes de revisión' : 'Pending review'}</h3>{pendingEvidence.length === 0 ? <p className='rounded-lg border border-dashed p-4 text-sm text-muted-foreground'>{es ? 'No hay registros pendientes.' : 'There are no pending submissions.'}</p> : pendingEvidence.map(item => <div key={item.id} className='rounded-lg border p-3'><p className='text-sm'>{item.performedAt} · {item.elapsedTimeSec} s</p><div className='mt-3 flex gap-2'><button type='button' disabled={busy} onClick={() => review(item.id, 'accepted')} className={buttonVariants({ size: 'sm' })}>{es ? 'Aceptar' : 'Accept'}</button><button type='button' disabled={busy} onClick={() => review(item.id, 'rejected')} className={buttonVariants({ variant: 'outline', size: 'sm' })}>{es ? 'Rechazar' : 'Reject'}</button></div></div>)}</section>
    <section className='space-y-3 lg:col-span-2'><h3 className='font-medium'>{es ? 'Histórico corregible' : 'Correctable history'}</h3>{history.length === 0 ? <p className='rounded-lg border border-dashed p-4 text-sm text-muted-foreground'>{es ? 'No hay registros activos.' : 'There are no active records.'}</p> : history.map(item => <div key={item.id} className='flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3'><p className='text-sm'>{item.performedAt} · {item.elapsedTimeSec} s</p><button type='button' disabled={busy} onClick={() => correct(item)} className={buttonVariants({ variant: 'outline', size: 'sm' })}>{es ? 'Corregir' : 'Correct'}</button></div>)}</section>
    {message && <p role='status' className='text-sm text-muted-foreground lg:col-span-2'>{message}</p>}
  </div>
}
