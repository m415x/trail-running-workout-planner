'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'

import {
  createTrainingGoal,
  type TrainingGoalFormState,
} from '@/app/actions/training-goal-actions'
import { Button, buttonVariants } from '@ui/button'
import { Input } from '@ui/input'

import type { TrainingGoalType } from '@/types'

interface TrainingGoalFormProps {
  athleteId: string
  locale: string
}

const goalTypeOptions: Array<{ value: TrainingGoalType; label: string }> = [
  { value: 'race', label: 'Preparar una carrera' },
  { value: 'performance', label: 'Mejorar rendimiento' },
  { value: 'base', label: 'Desarrollar base aeróbica' },
  { value: 'maintenance', label: 'Mantener condición' },
  { value: 'custom', label: 'Otro objetivo' },
]

const initialState: TrainingGoalFormState = {}

export function TrainingGoalForm({ athleteId, locale }: TrainingGoalFormProps) {
  const [state, formAction, pending] = useActionState(createTrainingGoal, initialState)
  const [goalType, setGoalType] = useState<TrainingGoalType>('race')
  const athletePath = locale === 'es'
    ? `/dashboard/athletes/${athleteId}`
    : `/${locale}/dashboard/athletes/${athleteId}`
  const isRaceGoal = goalType === 'race'

  return (
    <form action={formAction} className='space-y-6'>
      <input type='hidden' name='athleteId' value={athleteId} />
      <input type='hidden' name='locale' value={locale} />

      {state.error && (
        <div role='alert' className='rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive'>
          {state.error}
        </div>
      )}

      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='space-y-1.5'>
          <label htmlFor='type' className='text-sm font-medium'>
            Tipo de objetivo <span className='text-destructive'>*</span>
          </label>
          <select
            id='type'
            name='type'
            value={goalType}
            onChange={(event) => setGoalType(event.target.value as TrainingGoalType)}
            className='h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'
          >
            {goalTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <Field label={isRaceGoal ? 'Fecha de la carrera' : 'Fecha objetivo'} name='targetDate' type='date' required={isRaceGoal} />
      </div>

      <Field label='Título' name='title' placeholder='Ej.: Preparar Patagonia Run 42K' required />

      <TextAreaField
        label='Descripción'
        name='description'
        rows={3}
        maxLength={1000}
        placeholder='Describí el resultado que se espera alcanzar.'
      />

      {isRaceGoal && (
        <fieldset className='space-y-4 rounded-xl border p-4'>
          <div>
            <legend className='font-medium'>Carrera objetivo</legend>
            <p className='text-sm text-muted-foreground'>Datos de la carrera que orienta este objetivo.</p>
          </div>
          <div className='grid gap-4 sm:grid-cols-2'>
            <Field label='Nombre de la carrera' name='raceName' placeholder='Ej.: Patagonia Run' required />
            <Field label='Distancia (km)' name='raceDistanceKm' type='number' min='0.1' step='0.1' required />
            <Field label='Desnivel positivo (m)' name='raceElevationGain' type='number' min='0' step='1' />
          </div>
        </fieldset>
      )}

      <TextAreaField
        label='Notas'
        name='notes'
        rows={4}
        maxLength={2000}
        placeholder='Observaciones internas para el seguimiento del objetivo.'
      />

      <div className='rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground'>
        El objetivo se guardará inicialmente como borrador.
      </div>

      <div className='flex justify-end gap-2'>
        <Link href={athletePath} className={buttonVariants({ variant: 'outline' })}>Cancelar</Link>
        <Button type='submit' disabled={pending}>
          {pending ? 'Guardando…' : 'Crear objetivo'}
        </Button>
      </div>
    </form>
  )
}

interface FieldProps {
  label: string
  name: string
  type?: string
  placeholder?: string
  required?: boolean
  min?: string
  step?: string
}

function Field({ label, name, type = 'text', placeholder, required, min, step }: FieldProps) {
  return (
    <div className='space-y-1.5'>
      <label htmlFor={name} className='text-sm font-medium'>
        {label}{required && <span className='text-destructive'> *</span>}
      </label>
      <Input id={name} name={name} type={type} placeholder={placeholder} required={required} min={min} step={step} />
    </div>
  )
}

interface TextAreaFieldProps {
  label: string
  name: string
  rows: number
  maxLength: number
  placeholder: string
}

function TextAreaField({ label, name, rows, maxLength, placeholder }: TextAreaFieldProps) {
  return (
    <div className='space-y-1.5'>
      <label htmlFor={name} className='text-sm font-medium'>{label}</label>
      <textarea
        id={name}
        name={name}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        className='w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'
      />
    </div>
  )
}
