'use client'

import { useActionState } from 'react'
import { useTranslations } from 'next-intl'

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
  workouts,
}: {
  sessionId: string
  items: SessionAthleteAdjustmentReviewItem[]
  workouts: Array<{ id: string; title: string; type: typeof WORKOUT_TYPES[number] }>
}) {
  return (
    <div className='space-y-4'>
      {items.map((item) => (
        <AthleteAdjustmentForm
          key={`${item.athleteId}:${item.revisionId ?? 'none'}`}
          sessionId={sessionId}
          item={item}
          workouts={workouts}
        />
      ))}
    </div>
  )
}

function AthleteAdjustmentForm({
  sessionId,
  item,
  workouts,
}: {
  sessionId: string
  item: SessionAthleteAdjustmentReviewItem
  workouts: Array<{ id: string; title: string; type: typeof WORKOUT_TYPES[number] }>
}) {
  const t = useTranslations('Sessions')
  const workoutTypeT = useTranslations('Workouts')
  const [state, action, pending] = useActionState(saveAthleteSessionAdjustment, {})

  return (
    <form action={action} className='space-y-4 rounded-lg border p-4'>
      <input type='hidden' name='sessionId' value={sessionId} />
      <input type='hidden' name='athleteId' value={item.athleteId} />
      <input type='hidden' name='sourcePrescriptionId' value={item.sourcePrescriptionId} />

      <div className='flex items-center justify-between gap-3'>
        <strong>{item.athleteName}</strong>
        <div className='flex items-center gap-2'>
          {item.reviewRequired && (
            <span className='text-xs font-medium text-destructive'>
              {t('adjustments.reviewRequired')}
            </span>
          )}
          {item.omitted && (
            <span className='text-xs text-muted-foreground'>
              {t('adjustments.omitted')}
            </span>
          )}
        </div>
      </div>

      <div className='space-y-2'>
        <p className='text-sm font-medium'>{t('adjustments.doseTitle')}</p>
        <div className='grid gap-3 sm:grid-cols-3'>
          <LabeledInput
            label={t('adjustments.distance')}
            name='distanceKm'
            type='number'
            step='0.1'
            min='0'
            defaultValue={item.distanceKm ?? ''}
            placeholder={item.inheritedDistanceKm === null
              ? t('adjustments.inheritNoValue')
              : t('adjustments.inheritValue', { value: item.inheritedDistanceKm })}
          />
          <LabeledInput
            label={t('adjustments.duration')}
            name='durationMin'
            type='number'
            step='1'
            min='0'
            defaultValue={item.durationMin ?? ''}
            placeholder={item.inheritedDurationMin === null
              ? t('adjustments.inheritNoValue')
              : t('adjustments.inheritValue', { value: item.inheritedDurationMin })}
          />
          <LabeledInput
            label={t('adjustments.elevationGain')}
            name='elevationGain'
            type='number'
            step='1'
            min='0'
            defaultValue={item.elevationGain ?? ''}
            placeholder={item.inheritedElevationGain === null
              ? t('adjustments.inheritNoValue')
              : t('adjustments.inheritValue', { value: item.inheritedElevationGain })}
          />
        </div>
      </div>

      <div className='grid gap-3 sm:grid-cols-3'>
        <label className='space-y-1.5 text-sm'>
          <span className='font-medium'>{t('adjustments.intensity')}</span>
          <select
            name='intensityMethod'
            defaultValue={item.intensityMethod ?? ''}
            className='border-input bg-background h-9 w-full rounded-md border px-3 text-sm'
          >
            <option value=''>
              {t('adjustments.inheritIntensity', {
                value: item.inheritedIntensity ?? t('adjustments.noIntensity'),
              })}
            </option>
            <option value='clear'>{t('adjustments.clearIntensity')}</option>
            <option value='hr_zone'>{t('adjustments.hrZone')}</option>
            <option value='reference_percentage'>{t('adjustments.referencePercentage')}</option>
          </select>
        </label>

        <label className='space-y-1.5 text-sm'>
          <span className='font-medium'>{t('adjustments.zone')}</span>
          <select
            name='zone'
            defaultValue={item.zone ?? ''}
            className='border-input bg-background h-9 w-full rounded-md border px-3 text-sm'
          >
            <option value=''>{t('adjustments.selectZone')}</option>
            {['Z1', 'Z2', 'Z3', 'Z4', 'Z5'].map(zone => (
              <option key={zone} value={zone}>{zone}</option>
            ))}
          </select>
        </label>

        <LabeledInput
          label={t('adjustments.referencePercentage')}
          name='referencePercentage'
          type='number'
          min='1'
          step='1'
          defaultValue={item.referencePercentage ?? ''}
        />
      </div>

      <div className='space-y-2'>
        <p className='text-sm font-medium'>{t('adjustments.assignmentTitle')}</p>

        <label className='space-y-1.5 text-sm'>
          <span className='font-medium'>{t('adjustments.assignmentMode')}</span>
          <select
            name='assignmentMode'
            defaultValue={
              item.omitted
                ? 'omitted'
                : item.rescheduled
                  ? 'rescheduled'
                  : item.stimulus || item.stimulusType
                    ? 'stimulus_override'
                    : 'inherit'
            }
            className='border-input bg-background h-9 w-full rounded-md border px-3 text-sm'
          >
            <option value='inherit'>{t('adjustments.inherit')}</option>
            <option value='rescheduled'>{t('adjustments.reschedule')}</option>
            <option value='stimulus_override'>{t('adjustments.changeStimulus')}</option>
            <option value='omitted'>{t('adjustments.omitForAthlete')}</option>
          </select>
        </label>

        <div className='grid gap-3 sm:grid-cols-3'>
          <LabeledInput
            label={t('adjustments.reschedule')}
            name='rescheduled'
            type='date'
            defaultValue={item.rescheduled ?? ''}
          />
          <label className='space-y-1.5 text-sm'>
            <span className='font-medium'>{t('adjustments.stimulus')}</span>
            <select
              name='stimulus'
              defaultValue={item.stimulus ?? ''}
              className='border-input bg-background h-9 w-full rounded-md border px-3 text-sm'
            >
              <option value=''>{t('adjustments.noStimulusTemplate')}</option>
              {workouts.map(workout => (
                <option key={workout.id} value={workout.id}>
                  {workout.title} · {workoutTypeT(`types.${workout.type}`)}
                </option>
              ))}
            </select>
          </label>
          <label className='space-y-1.5 text-sm'>
            <span className='font-medium'>{t('adjustments.stimulusType')}</span>
            <select
              name='stimulusType'
              defaultValue={item.stimulusType ?? ''}
              className='border-input bg-background h-9 w-full rounded-md border px-3 text-sm'
            >
              <option value=''>{t('adjustments.inherit')}</option>
              {WORKOUT_TYPES.map(type => (
                <option key={type} value={type}>{workoutTypeT(`types.${type}`)}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {item.currentReason && (
        <div className='rounded-md border bg-muted/30 px-3 py-2 text-sm'>
          <span className='font-medium'>{t('adjustments.currentReason')}</span>{' '}
          <span className='text-muted-foreground'>{item.currentReason}</span>
        </div>
      )}

      <LabeledInput
        label={t('adjustments.reason')}
        name='reason'
        placeholder={t('adjustments.reasonPlaceholder')}
      />

      {state.error && (
        <p className='text-sm text-destructive'>
          {t(`adjustments.errors.${state.error}`)}
        </p>
      )}
      <Button type='submit' disabled={pending || item.reviewRequired}>
        {item.reviewRequired
          ? t('adjustments.reviewRequiredAction')
          : pending
            ? t('adjustments.saving')
            : t('adjustments.save')}
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

