'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

import { createTrainingGoal, type TrainingGoalFormState } from '@/app/actions/training-goal-actions'
import { RaceCoursePicker } from '@/features/race-catalog/components/RaceCoursePicker'
import type { RaceCourseSearchResult } from '@/lib/race-catalog/catalog-repository'
import type { TrainingGoalType } from '@/types'
import { Button, buttonVariants } from '@ui/button'
import { Input } from '@ui/input'

interface TrainingGoalFormProps {
  athleteId: string
  locale: string
}

const initialState: TrainingGoalFormState = {}

export function TrainingGoalForm({ athleteId, locale }: TrainingGoalFormProps) {
  const t = useTranslations('TrainingGoalForm')
  const catalog = useTranslations('RaceCatalog')
  const [state, formAction, pending] = useActionState(createTrainingGoal, initialState)
  const [goalType, setGoalType] = useState<TrainingGoalType>('race')
  const [selected, setSelected] = useState<RaceCourseSearchResult | null>(null)
  const athletePath = locale === 'es'
    ? `/dashboard/athletes/${athleteId}`
    : `/${locale}/dashboard/athletes/${athleteId}`
  const isRaceGoal = goalType === 'race'
  const fieldError = (name: string) => state.fieldErrors?.[name]?.[0]
  const catalogTitle = selected ? `${selected.event.name} — ${selected.course.label}` : ''

  return (
    <form action={formAction} className='space-y-6'>
      <input type='hidden' name='athleteId' value={athleteId} />
      <input type='hidden' name='locale' value={locale} />

      {state.error && (
        <div role='alert' className='rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive'>
          {catalog(`errors.${state.error}`)}
        </div>
      )}

      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='space-y-1.5'>
          <label htmlFor='type' className='text-sm font-medium'>
            {t('type')} <span className='text-destructive'>*</span>
          </label>
          <select
            id='type'
            name='type'
            value={goalType}
            onChange={(event) => {
              setGoalType(event.target.value as TrainingGoalType)
              setSelected(null)
            }}
            aria-invalid={Boolean(fieldError('type'))}
            aria-describedby={fieldError('type') ? 'type-error' : undefined}
            className='h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'
          >
            {(['race', 'performance', 'base', 'maintenance', 'custom'] as const).map((value) => (
              <option key={value} value={value}>{t(`types.${value}`)}</option>
            ))}
          </select>
          <FieldError id='type-error' message={fieldError('type')} />
        </div>

        {(!isRaceGoal || !selected) && (
          <Field
            label={t('fields.targetDate')}
            name='targetDate'
            type='date'
            required={isRaceGoal}
            error={fieldError('targetDate')}
          />
        )}
      </div>

      {selected && isRaceGoal ? (
        <input type='hidden' name='title' value={catalogTitle} />
      ) : (
        <Field
          label={t('fields.title')}
          name='title'
          required
          error={fieldError('title')}
        />
      )}

      <TextAreaField
        label={t('fields.description')}
        name='description'
        rows={3}
        maxLength={1000}
        error={fieldError('description')}
      />

      {isRaceGoal && (
        <fieldset className='space-y-4 rounded-xl border p-4'>
          <div>
            <legend className='font-medium'>{t('manualRace')}</legend>
            <p className='text-sm text-muted-foreground'>{catalog('snapshotNotice')}</p>
          </div>

          <RaceCoursePicker selected={selected} onSelect={setSelected} />

          {!selected && (
            <div className='grid gap-4 border-t pt-4 sm:grid-cols-2'>
              <Field label={t('fields.raceName')} name='raceName' required error={fieldError('raceName')} />
              <Field label={t('fields.raceDistanceKm')} name='raceDistanceKm' type='number' min='0.01' step='any' required error={fieldError('raceDistanceKm')} />
              <Field label={t('fields.raceElevationGain')} name='raceElevationGain' type='number' min='0' step='any' error={fieldError('raceElevationGain')} />
            </div>
          )}
        </fieldset>
      )}

      <TextAreaField
        label={t('fields.notes')}
        name='notes'
        rows={4}
        maxLength={2000}
        error={fieldError('notes')}
      />

      <div className='rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground'>
        {t('draftNotice')}
      </div>

      <div className='flex justify-end gap-2'>
        <Link href={athletePath} className={buttonVariants({ variant: 'outline' })}>{catalog('cancel')}</Link>
        <Button type='submit' disabled={pending}>
          {pending ? catalog('saving') : t('create')}
        </Button>
      </div>
    </form>
  )
}

interface FieldProps {
  label: string
  name: string
  type?: string
  required?: boolean
  min?: string
  step?: string
  error?: string
}

function Field({ label, name, type = 'text', required, min, step, error }: FieldProps) {
  return (
    <div className='space-y-1.5'>
      <label htmlFor={name} className='text-sm font-medium'>
        {label}{required && <span className='text-destructive'> *</span>}
      </label>
      <Input
        id={name}
        name={name}
        type={type}
        required={required}
        min={min}
        step={step}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
      />
      <FieldError id={`${name}-error`} message={error} />
    </div>
  )
}

interface TextAreaFieldProps {
  label: string
  name: string
  rows: number
  maxLength: number
  error?: string
}

function TextAreaField({ label, name, rows, maxLength, error }: TextAreaFieldProps) {
  return (
    <div className='space-y-1.5'>
      <label htmlFor={name} className='text-sm font-medium'>{label}</label>
      <textarea
        id={name}
        name={name}
        rows={rows}
        maxLength={maxLength}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
        className='w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'
      />
      <FieldError id={`${name}-error`} message={error} />
    </div>
  )
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return <p id={id} className='text-xs text-destructive'>{message}</p>
}
