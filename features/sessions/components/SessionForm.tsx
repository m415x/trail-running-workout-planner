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

const workoutTypes = ['Base', 'Long', 'Intervals', 'Trail', 'Speed', 'Fartlek', 'PAM', 'Hills', 'Rest', 'Race'] as const
const initialState: SessionFormState = {}

export function SessionForm({ locale, workouts, locations }: SessionFormProps) {
  const [state, formAction, pending] = useActionState(createSession, initialState)
  const sessionsPath = locale === 'es' ? '/dashboard/sessions' : `/${locale}/dashboard/sessions`

  return (
    <form action={formAction} className='space-y-6'>
      <input type='hidden' name='locale' value={locale} />
      {state.error && <div role='alert' className='rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive'>{state.error}</div>}

      <div className='grid gap-4 sm:grid-cols-2'>
        <Field label='Fecha' name='date' type='date' required />
        <Field label='Título' name='title' placeholder='Ej.: Fondo de montaña' required />
      </div>

      <div className='grid gap-4 sm:grid-cols-2'>
        <SelectField label='Tipo de entrenamiento' name='type' required>
          <option value=''>Seleccionar tipo</option>
          {workoutTypes.map((type) => <option key={type} value={type}>{type}</option>)}
        </SelectField>
        <SelectField label='Plantilla de entrenamiento' name='workoutId'>
          <option value=''>Sin plantilla</option>
          {workouts.map((workout) => <option key={workout.id} value={workout.id}>{workout.title} · {workout.type}</option>)}
        </SelectField>
      </div>

      <SelectField label='Ubicación' name='locationKey'>
        <option value=''>Sin ubicación</option>
        {locations.map((location) => <option key={location.key} value={location.key}>{location.name}</option>)}
      </SelectField>

      <Field label='Track' name='trackPath' placeholder='Ruta o referencia del track (opcional)' />

      <fieldset className='space-y-4 rounded-lg border p-4'>
        <legend className='px-1 text-sm font-medium'>Estructura de la sesión</legend>
        <p className='text-sm text-muted-foreground'>Todos los bloques son opcionales. Completá sólo los que correspondan al entrenamiento.</p>
        <TextAreaField label='Ejercicios preliminares' name='preliminaryExercises' rows={2} placeholder='Movilidad, activación, técnica…' />
        <TextAreaField label='Entrada en calor' name='warmup' rows={2} placeholder='Ej.: 15 min suaves + movilidad dinámica' />
        <TextAreaField label='Bloque principal' name='mainBlock' rows={3} placeholder='Ej.: 6 × 800 m con recuperación de 2 min' />
        <TextAreaField label='Vuelta a la calma' name='cooldown' rows={2} placeholder='Ej.: 10 min suaves + elongación' />
      </fieldset>

      <TextAreaField label='Notas' name='notes' rows={4} placeholder='Indicaciones generales de la sesión…' />

      <p className='text-sm text-muted-foreground'>El tipo y la estructura describen la sesión compartida. El volumen, la intensidad y las indicaciones específicas de cada grupo se asignan por separado.</p>
      <div className='flex justify-end gap-2'>
        <Link href={sessionsPath} className={buttonVariants({ variant: 'outline' })}>Cancelar</Link>
        <Button type='submit' disabled={pending}>{pending ? 'Guardando…' : 'Crear sesión'}</Button>
      </div>
    </form>
  )
}

function Field({ label, name, type = 'text', placeholder, required }: { label: string; name: string; type?: string; placeholder?: string; required?: boolean }) {
  return <div className='space-y-1.5'><label htmlFor={name} className='text-sm font-medium'>{label}{required && <span className='text-destructive'> *</span>}</label><Input id={name} name={name} type={type} placeholder={placeholder} required={required} /></div>
}

function TextAreaField({ label, name, rows, placeholder }: { label: string; name: string; rows: number; placeholder?: string }) {
  return <div className='space-y-1.5'><label htmlFor={name} className='text-sm font-medium'>{label}</label><textarea id={name} name={name} rows={rows} placeholder={placeholder} className='border-input bg-background w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]' /></div>
}

function SelectField({ label, name, required, children }: { label: string; name: string; required?: boolean; children: React.ReactNode }) {
  return <div className='space-y-1.5'><label htmlFor={name} className='text-sm font-medium'>{label}{required && <span className='text-destructive'> *</span>}</label><select id={name} name={name} required={required} className='border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]'>{children}</select></div>
}
