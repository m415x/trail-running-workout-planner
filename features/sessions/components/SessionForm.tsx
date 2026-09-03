'use client'

import { useActionState } from 'react'
import Link from 'next/link'

import { createSession, type SessionFormState } from '@/app/actions/session-actions'
import { Button, buttonVariants } from '@ui/button'
import { Input } from '@ui/input'

interface SessionFormProps {
  locale: string
  workouts: Array<{ id: string; title: string; type: string }>
  locations: Array<{ key: string; name: string }>
}

const initialState: SessionFormState = {}

export function SessionForm({ locale, workouts, locations }: SessionFormProps) {
  const [state, formAction, pending] = useActionState(createSession, initialState)
  const sessionsPath = locale === 'es' ? '/dashboard/sessions' : `/${locale}/dashboard/sessions`

  return (
    <form action={formAction} className='space-y-6'>
      <input type='hidden' name='locale' value={locale} />

      {state.error && (
        <div role='alert' className='rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive'>
          {state.error}
        </div>
      )}

      <div className='grid gap-4 sm:grid-cols-2'>
        <Field label='Fecha' name='date' type='date' required />
        <Field label='Título' name='title' placeholder='Ej.: Fondo de montaña' required />
      </div>

      <div className='grid gap-4 sm:grid-cols-2'>
        <SelectField label='Plantilla de entrenamiento' name='workoutId'>
          <option value=''>Sin plantilla</option>
          {workouts.map((workout) => (
            <option key={workout.id} value={workout.id}>{workout.title} · {workout.type}</option>
          ))}
        </SelectField>

        <SelectField label='Ubicación' name='locationKey'>
          <option value=''>Sin ubicación</option>
          {locations.map((location) => (
            <option key={location.key} value={location.key}>{location.name}</option>
          ))}
        </SelectField>
      </div>

      <Field label='Track' name='trackPath' placeholder='Ruta o referencia del track (opcional)' />

      <div className='space-y-1.5'>
        <label htmlFor='notes' className='text-sm font-medium'>Notas</label>
        <textarea
          id='notes'
          name='notes'
          rows={4}
          placeholder='Indicaciones generales de la sesión…'
          className='border-input bg-background w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]'
        />
      </div>

      <p className='text-sm text-muted-foreground'>Las indicaciones específicas de cada grupo se asignarán por separado.</p>

      <div className='flex justify-end gap-2'>
        <Link href={sessionsPath} className={buttonVariants({ variant: 'outline' })}>Cancelar</Link>
        <Button type='submit' disabled={pending}>{pending ? 'Guardando…' : 'Crear sesión'}</Button>
      </div>
    </form>
  )
}

function Field({ label, name, type = 'text', placeholder, required }: { label: string; name: string; type?: string; placeholder?: string; required?: boolean }) {
  return (
    <div className='space-y-1.5'>
      <label htmlFor={name} className='text-sm font-medium'>{label}{required && <span className='text-destructive'> *</span>}</label>
      <Input id={name} name={name} type={type} placeholder={placeholder} required={required} />
    </div>
  )
}

function SelectField({ label, name, children }: { label: string; name: string; children: React.ReactNode }) {
  return (
    <div className='space-y-1.5'>
      <label htmlFor={name} className='text-sm font-medium'>{label}</label>
      <select id={name} name={name} className='border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]'>
        {children}
      </select>
    </div>
  )
}
