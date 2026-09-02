'use client'

import { useActionState } from 'react'
import Link from 'next/link'

import {
  createAthlete,
  updateAthlete,
  type AthleteFormState,
} from '@/app/actions/athlete-actions'
import { buttonVariants, Button } from '@ui/button'
import { Input } from '@ui/input'

interface AthleteGroupOption {
  id: string
  categoryCode: string
  levelCode: string
}

interface AthleteFormValues {
  id?: string
  firstName: string
  lastName: string
  email: string
  dni: string
  nickName?: string | null
  birthday?: string | null
  phone?: string | null
  emergencyContact?: string | null
  emergencyPhone?: string | null
  groupId?: string | null
}

interface AthleteFormProps {
  locale: string
  groups: AthleteGroupOption[]
  athlete?: AthleteFormValues
}

const initialState: AthleteFormState = {}

export function AthleteForm({ locale, groups, athlete }: AthleteFormProps) {
  const action = athlete ? updateAthlete : createAthlete
  const [state, formAction, pending] = useActionState(action, initialState)
  const athletesPath = locale === 'es' ? '/dashboard/athletes' : `/${locale}/dashboard/athletes`

  return (
    <form action={formAction} className='space-y-6'>
      <input type='hidden' name='locale' value={locale} />
      {athlete?.id && <input type='hidden' name='athleteId' value={athlete.id} />}

      {state.error && (
        <div role='alert' className='rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive'>
          {state.error}
        </div>
      )}

      <div className='grid gap-4 sm:grid-cols-2'>
        <Field label='Nombre' name='firstName' defaultValue={athlete?.firstName} required />
        <Field label='Apellido' name='lastName' defaultValue={athlete?.lastName} required />
        <Field label='Email' name='email' type='email' defaultValue={athlete?.email} required />
        <Field label='DNI' name='dni' defaultValue={athlete?.dni} required />
        <Field label='Apodo' name='nickName' defaultValue={athlete?.nickName} />
        <Field label='Fecha de nacimiento' name='birthday' type='date' defaultValue={athlete?.birthday} />
        <Field label='Teléfono' name='phone' type='tel' defaultValue={athlete?.phone} />

        <div className='space-y-1.5'>
          <label htmlFor='groupId' className='text-sm font-medium'>Grupo</label>
          <select
            id='groupId'
            name='groupId'
            defaultValue={athlete?.groupId ?? ''}
            className='h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'
          >
            <option value=''>Sin grupo</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.categoryCode}{group.levelCode}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className='space-y-4 rounded-xl border p-4'>
        <div>
          <h3 className='font-medium'>Contacto de emergencia</h3>
          <p className='text-sm text-muted-foreground'>Opcional. Puede completarse o modificarse más adelante.</p>
        </div>
        <div className='grid gap-4 sm:grid-cols-2'>
          <Field label='Nombre del contacto' name='emergencyContact' defaultValue={athlete?.emergencyContact} />
          <Field label='Teléfono de emergencia' name='emergencyPhone' type='tel' defaultValue={athlete?.emergencyPhone} />
        </div>
      </div>

      <div className='flex justify-end gap-2'>
        <Link href={athletesPath} className={buttonVariants({ variant: 'outline' })}>
          Cancelar
        </Link>
        <Button type='submit' disabled={pending}>
          {pending ? 'Guardando…' : athlete ? 'Guardar cambios' : 'Crear atleta'}
        </Button>
      </div>
    </form>
  )
}

interface FieldProps {
  label: string
  name: string
  type?: string
  defaultValue?: string | null
  required?: boolean
}

function Field({ label, name, type = 'text', defaultValue, required }: FieldProps) {
  return (
    <div className='space-y-1.5'>
      <label htmlFor={name} className='text-sm font-medium'>
        {label}{required && <span className='text-destructive'> *</span>}
      </label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue ?? ''} required={required} />
    </div>
  )
}
