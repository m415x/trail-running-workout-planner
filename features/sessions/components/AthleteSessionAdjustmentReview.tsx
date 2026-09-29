'use client'

import { useActionState } from 'react'

import {
  saveAthleteSessionAdjustment,
  type SessionAthleteAdjustmentReviewItem,
} from '@/app/actions/athlete-session-adjustment-actions'
import { WORKOUT_TYPES } from '@/types/training/workout.types'
import { Button } from '@ui/button'
import { Input } from '@ui/input'

export function AthleteSessionAdjustmentReview({
  sessionId,
  items,
}: {
  sessionId: string
  items: SessionAthleteAdjustmentReviewItem[]
}) {
  return (
    <div className='space-y-4'>
      {items.map((item) => (
        <AthleteAdjustmentForm key={item.athleteId} sessionId={sessionId} item={item} />
      ))}
    </div>
  )
}

function AthleteAdjustmentForm({
  sessionId,
  item,
}: {
  sessionId: string
  item: SessionAthleteAdjustmentReviewItem
}) {
  const [state, action, pending] = useActionState(saveAthleteSessionAdjustment, {})

  return (
    <form action={action} className='space-y-4 rounded-lg border p-4'>
      <input type='hidden' name='sessionId' value={sessionId} />
      <input type='hidden' name='athleteId' value={item.athleteId} />
      <input type='hidden' name='sourcePrescriptionId' value={item.sourcePrescriptionId} />

      <div className='flex items-center justify-between gap-3'>
        <strong>{item.athleteName}</strong>
        {item.omitted && <span className='text-xs text-muted-foreground'>omitted</span>}
      </div>

      <div className='space-y-2'>
        <p className='text-sm font-medium'>Dose individual</p>
        <div className='grid gap-3 sm:grid-cols-3'>
          <LabeledInput
            label='Distancia'
            name='distanceKm'
            type='number'
            step='0.1'
            min='0'
            defaultValue={item.distanceKm ?? ''}
            placeholder={formatInherited(item.inheritedDistanceKm)}
          />
          <LabeledInput
            label='Duración'
            name='durationMin'
            type='number'
            step='1'
            min='0'
            defaultValue={item.durationMin ?? ''}
            placeholder={formatInherited(item.inheritedDurationMin)}
          />
          <LabeledInput
            label='Desnivel'
            name='elevationGain'
            type='number'
            step='1'
            min='0'
            defaultValue={item.elevationGain ?? ''}
            placeholder={formatInherited(item.inheritedElevationGain)}
          />
        </div>
      </div>

      <div className='grid gap-3 sm:grid-cols-3'>
        <label className='space-y-1.5 text-sm'>
          <span className='font-medium'>Intensidad</span>
          <select
            name='intensityMethod'
            defaultValue={item.intensityMethod ?? ''}
            className='border-input bg-background h-9 w-full rounded-md border px-3 text-sm'
          >
            <option value=''>Heredar ({item.inheritedIntensity ?? 'sin intensidad'})</option>
            <option value='clear'>Sin intensidad individual</option>
            <option value='hr_zone'>Zona FC</option>
            <option value='reference_percentage'>Porcentaje de referencia</option>
          </select>
        </label>

        <label className='space-y-1.5 text-sm'>
          <span className='font-medium'>Zona</span>
          <select
            name='zone'
            defaultValue={item.zone ?? ''}
            className='border-input bg-background h-9 w-full rounded-md border px-3 text-sm'
          >
            <option value=''>Seleccionar</option>
            {['Z1', 'Z2', 'Z3', 'Z4', 'Z5'].map(zone => (
              <option key={zone} value={zone}>{zone}</option>
            ))}
          </select>
        </label>

        <LabeledInput
          label='Porcentaje de referencia'
          name='referencePercentage'
          type='number'
          min='1'
          step='1'
          defaultValue={item.referencePercentage ?? ''}
        />
      </div>

      <div className='space-y-2'>
        <p className='text-sm font-medium'>Assignment individual</p>
        <div className='grid gap-3 sm:grid-cols-3'>
          <LabeledInput
            label='Reprogramar'
            name='rescheduled'
            type='date'
            defaultValue={item.rescheduled ?? ''}
          />
          <LabeledInput
            label='Stimulus'
            name='stimulus'
            defaultValue={item.stimulus ?? ''}
            placeholder='Workout ID'
          />
          <label className='space-y-1.5 text-sm'>
            <span className='font-medium'>Tipo de stimulus</span>
            <select
              name='stimulusType'
              defaultValue={item.stimulusType ?? ''}
              className='border-input bg-background h-9 w-full rounded-md border px-3 text-sm'
            >
              <option value=''>Heredar</option>
              {WORKOUT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
        </div>

        <label className='flex items-center gap-2 text-sm'>
          <input name='omitted' type='checkbox' defaultChecked={item.omitted} />
          Omitir para este atleta
        </label>
      </div>

      <LabeledInput
        label='Motivo'
        name='reason'
        placeholder='Motivo del ajuste individual'
      />

      {state.error && <p className='text-sm text-destructive'>{state.error}</p>}
      <Button type='submit' disabled={pending}>
        {pending ? 'Guardando…' : 'Guardar ajuste individual'}
      </Button>
    </form>
  )
}

function LabeledInput({
  label,
  name,
  ...props
}: React.ComponentProps<typeof Input> & { label: string; name: string }) {
  return (
    <label className='space-y-1.5 text-sm'>
      <span className='font-medium'>{label}</span>
      <Input name={name} {...props} />
    </label>
  )
}

function formatInherited(value: number | null) {
  return value === null ? 'Heredar: sin valor' : `Heredar: ${value}`
}
