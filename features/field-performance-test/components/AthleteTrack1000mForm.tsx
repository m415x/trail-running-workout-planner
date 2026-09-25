'use client'

import { useState } from 'react'

import { getCurrentAthleteTrack1000mEvidenceAction } from '@/app/actions/field-performance-test-actions'
import { buttonVariants } from '@ui/button'

type TestEventOption = { id: string; scheduledAt: string }

export function AthleteTrack1000mForm({ locale, events }: { locale: string; events: TestEventOption[] }) {
  const es = locale === 'es'
  const [executionContext, setExecutionContext] = useState<'official' | 'self_directed'>(events.length ? 'official' : 'self_directed')
  const [testEventId, setTestEventId] = useState(events[0]?.id ?? '')
  const [performedAt, setPerformedAt] = useState('')
  const [minutes, setMinutes] = useState('')
  const [seconds, setSeconds] = useState('')
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const elapsedTimeSec = Number(minutes) * 60 + Number(seconds)
  const hasTime = minutes !== '' && seconds !== '' && elapsedTimeSec > 0

  function localizeError(error: string) {
    if (error === 'test_event_not_yet_occurred') {
      return es ? 'Este test oficial todavía no ocurrió.' : 'This official test has not occurred yet.'
    }
    if (error === 'official_evidence_already_exists') {
      return es
        ? 'Ya registraste un resultado para esta instancia oficial.'
        : 'You already recorded a result for this official test event.'
    }
    return error
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setMessage(null)
    const result = await getCurrentAthleteTrack1000mEvidenceAction({
      executionContext,
      ...(executionContext === 'official' ? { testEventId } : { performedAt }),
      elapsedTimeSec,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    })
    setPending(false)
    setMessage(result.success
      ? executionContext === 'self_directed'
        ? es ? 'Registro enviado para revisión del coach.' : 'Submission sent for coach review.'
        : es ? 'Test oficial registrado.' : 'Official test recorded.'
      : localizeError(result.error))
  }

  return <form onSubmit={submit} className='mt-4 grid gap-3'>
    <label className='grid gap-1'><span className='text-xs text-muted-foreground'>{es ? 'Tipo de registro' : 'Registration type'}</span><select value={executionContext} onChange={event => setExecutionContext(event.target.value as 'official' | 'self_directed')} className='h-10 rounded-md border border-input bg-background px-3'><option value='official' disabled={events.length === 0}>{es ? 'Test oficial' : 'Official test'}</option><option value='self_directed'>{es ? 'Autogestionado' : 'Self-directed'}</option></select></label>
    {events.length === 0 && <p className='rounded-lg border border-dashed p-3 text-sm text-muted-foreground'>{es ? 'No hay instancias oficiales disponibles. Podés registrar un intento autogestionado.' : 'No official test events are available. You can record a self-directed attempt.'}</p>}
    {executionContext === 'official' ? <label className='grid gap-1'><span className='text-xs text-muted-foreground'>{es ? 'Instancia oficial' : 'Official test'}</span><select value={testEventId} onChange={event => setTestEventId(event.target.value)} className='h-10 rounded-md border border-input bg-background px-3'>{events.map(item => <option key={item.id} value={item.id}>{item.scheduledAt.slice(0, 10)}</option>)}</select></label> : <label className='grid gap-1'><span className='text-xs text-muted-foreground'>{es ? 'Fecha realizada' : 'Performed date'}</span><input type='date' required value={performedAt} onChange={event => setPerformedAt(event.target.value)} className='h-10 rounded-md border border-input bg-background px-3' /></label>}
    <div className='grid grid-cols-2 gap-3'>
      <label className='grid gap-1'><span className='text-xs text-muted-foreground'>{es ? 'Minutos' : 'Minutes'}</span><input aria-label={es ? 'Minutos' : 'Minutes'} type='number' min='0' step='1' required value={minutes} onChange={event => setMinutes(event.target.value)} className='h-10 rounded-md border border-input bg-background px-3' /></label>
      <label className='grid gap-1'><span className='text-xs text-muted-foreground'>{es ? 'Segundos' : 'Seconds'}</span><input aria-label={es ? 'Segundos' : 'Seconds'} type='number' min='0' max='59' step='1' required value={seconds} onChange={event => setSeconds(event.target.value)} className='h-10 rounded-md border border-input bg-background px-3' /></label>
    </div>
    <label className='grid gap-1'><span className='text-xs text-muted-foreground'>{es ? 'Notas (opcional)' : 'Notes (optional)'}</span><textarea value={notes} onChange={event => setNotes(event.target.value)} className='min-h-20 rounded-md border border-input bg-background p-3' /></label>
    <button type='submit' disabled={pending || !hasTime || (executionContext === 'official' && !testEventId)} className={buttonVariants({ size: 'sm' })}>{pending ? (es ? 'Guardando…' : 'Saving…') : (es ? 'Registrar test' : 'Record test')}</button>
    {message && <p role='status' className='text-sm text-muted-foreground'>{message}</p>}
  </form>
}
