'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { createTrainingGoal, type TrainingGoalFormState } from '@/app/actions/training-goal-actions'
import { RaceCoursePicker } from '@/features/race-catalog/components/RaceCoursePicker'
import type { RaceCourseSearchResult } from '@/lib/race-catalog/catalog-repository'
import { Button, buttonVariants } from '@ui/button'
import { Input } from '@ui/input'
import type { TrainingGoalType } from '@/types'

const initialState: TrainingGoalFormState = {}

export function TrainingGoalForm({ athleteId, locale }: { athleteId: string; locale: string }) {
  const t = useTranslations('TrainingGoalForm')
  const catalog = useTranslations('RaceCatalog')
  const [state, formAction, pending] = useActionState(createTrainingGoal, initialState)
  const [goalType, setGoalType] = useState<TrainingGoalType>('race')
  const [selected, setSelected] = useState<RaceCourseSearchResult | null>(null)
  const athletePath = (locale === 'en' ? '/en' : '') + '/dashboard/athletes/' + athleteId
  const isRaceGoal = goalType === 'race'
  const field = (name: string, type = 'text', required = false) => (
    <div className='space-y-1.5' key={name}>
      <label htmlFor={name} className='text-sm font-medium'>{t('fields.' + name)}</label>
      <Input id={name} name={name} type={type} required={required}
        min={type === 'number' ? name === 'raceDistanceKm' ? '0.01' : '0' : undefined}
        step={type === 'number' ? 'any' : undefined}
        maxLength={type === 'text' ? 120 : undefined}
        aria-invalid={Boolean(state.fieldErrors?.[name])}
        aria-describedby={state.fieldErrors?.[name] ? name + '-error' : undefined} />
      {state.fieldErrors?.[name] && <p id={name + '-error'} className='text-sm text-destructive'>{catalog('errors.invalid')}</p>}
    </div>
  )
  return <form action={formAction} className='space-y-6'>
    <input type='hidden' name='athleteId' value={athleteId} />
    <input type='hidden' name='locale' value={locale} />
    {state.error && <p role='alert' className='text-destructive'>{catalog('errors.' + state.error)}</p>}
    <div className='space-y-2'>
      <label htmlFor='type'>{t('type')}</label>
      <select id='type' name='type' value={goalType}
        onChange={event => { setGoalType(event.target.value as TrainingGoalType); setSelected(null) }}
        className='h-9 w-full rounded-lg border bg-background px-3'>
        {(['race', 'performance', 'base', 'maintenance', 'custom'] as const).map(value =>
          <option key={value} value={value}>{t('types.' + value)}</option>)}
      </select>
    </div>
    {field('title', 'text', true)}
    <div className='space-y-2'>
      <label htmlFor='description'>{t('fields.description')}</label>
      <textarea id='description' name='description' rows={3} maxLength={1000}
        className='w-full rounded-lg border bg-background p-3' />
    </div>
    {isRaceGoal && <RaceCoursePicker selected={selected} onSelect={setSelected} />}
    {(!isRaceGoal || !selected) && field('targetDate', 'date', isRaceGoal)}
    {isRaceGoal && !selected && <fieldset className='grid gap-4 rounded-lg border p-4 sm:grid-cols-2'>
      <legend>{t('manualRace')}</legend>
      {field('raceName', 'text', true)}
      {field('raceDistanceKm', 'number', true)}
      {field('raceElevationGain', 'number')}
    </fieldset>}
    <div className='space-y-2'>
      <label htmlFor='notes'>{t('fields.notes')}</label>
      <textarea id='notes' name='notes' rows={4} maxLength={2000}
        className='w-full rounded-lg border bg-background p-3' />
    </div>
    <p className='text-sm text-muted-foreground'>{t('draftNotice')}</p>
    <div className='flex justify-end gap-2'>
      <Link href={athletePath} className={buttonVariants({ variant: 'outline' })}>{catalog('cancel')}</Link>
      <Button type='submit' disabled={pending}>{pending ? catalog('saving') : t('create')}</Button>
    </div>
  </form>
}
