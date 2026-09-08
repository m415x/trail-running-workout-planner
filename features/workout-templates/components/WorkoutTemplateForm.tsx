'use client'

import Link from 'next/link'
import { useActionState, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

import { createWorkoutTemplate, updateWorkoutTemplate, type WorkoutTemplateFormState } from '@/app/actions/workout-template-actions'
import type { WorkoutTemplate, WorkoutTemplateCategory, WorkoutType } from '@/types'
import { Button, buttonVariants } from '@ui/button'
import { Input } from '@ui/input'

const categories: WorkoutTemplateCategory[] = ['endurance', 'quality', 'mountain', 'technique', 'recovery', 'competition']
const workoutTypes: WorkoutType[] = ['Base', 'Long', 'Intervals', 'Trail', 'Speed', 'Fartlek', 'PAM', 'Hills', 'Race', 'Rest']
const zones = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'] as const
const initialState: WorkoutTemplateFormState = {}

interface WorkoutTemplateFormProps {
  locale: string
  locations: Array<{ key: string; name: string }>
  template?: WorkoutTemplate
}

export function WorkoutTemplateForm({ locale, locations, template }: WorkoutTemplateFormProps) {
  const t = useTranslations('WorkoutTemplates.form')
  const categoryLabel = useTranslations('WorkoutTemplates.categories')
  const workoutTypeLabel = useTranslations('Workouts.types')
  const isEditing = Boolean(template)
  const [state, formAction, pending] = useActionState(isEditing ? updateWorkoutTemplate : createWorkoutTemplate, initialState)
  const [intensityMethod, setIntensityMethod] = useState(template?.prescriptionDefaults.intensity?.method ?? '')
  const templatesPath = locale === 'es' ? '/dashboard/templates' : `/${locale}/dashboard/templates`
  const originalValues: Record<string, string | number | undefined> = {
    title: template?.sessionDefaults.title,
    type: template?.sessionDefaults.type,
    category: template?.category,
    tags: template?.tags.join(', '),
    preliminaryExercises: template?.sessionDefaults.structure?.preliminaryExercises ?? undefined,
    warmup: template?.sessionDefaults.structure?.warmup ?? undefined,
    mainBlock: template?.sessionDefaults.structure?.mainBlock ?? undefined,
    cooldown: template?.sessionDefaults.structure?.cooldown ?? undefined,
    locationKey: template?.sessionDefaults.locationKey ?? undefined,
    trackPath: template?.sessionDefaults.trackPath ?? undefined,
    notes: template?.sessionDefaults.notes ?? undefined,
    distanceKm: template?.prescriptionDefaults.distanceKm ?? undefined,
    durationMin: template?.prescriptionDefaults.durationMin ?? undefined,
    elevationGain: template?.prescriptionDefaults.elevationGain ?? undefined,
    zone: template?.prescriptionDefaults.intensity?.method === 'hr_zone' ? template.prescriptionDefaults.intensity.zone : undefined,
    pamPercentage: template?.prescriptionDefaults.intensity?.method === 'pam_percentage' ? template.prescriptionDefaults.intensity.pamPercentage : undefined,
    prescriptionNotes: template?.prescriptionDefaults.notes ?? undefined,
  }
  const savedValue = (name: string) => state.values?.[name] ?? originalValues[name]
  const savedTextValue = (name: string) => {
    const value = savedValue(name)
    return value === undefined ? undefined : String(value)
  }

  useEffect(() => {
    if (state.values) setIntensityMethod(state.values.intensityMethod ?? '')
  }, [state.values])

  return (
    <form key={state.submissionKey ?? 0} action={formAction} className='space-y-6'>
      <input type='hidden' name='locale' value={locale} />
      {template && <input type='hidden' name='templateId' value={template.id} />}

      {state.error && <div role='alert' className='rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive'>{state.error}</div>}

      <fieldset className='space-y-4 rounded-lg border p-4'>
        <legend className='px-1 text-sm font-medium'>{t('identity.legend')}</legend>
        <div className='grid gap-4 sm:grid-cols-2'>
          <Field label={t('identity.title')} name='title' defaultValue={savedValue('title')} placeholder={t('identity.titlePlaceholder')} required minLength={2} maxLength={120} error={state.fieldErrors?.title} />
          <SelectField label={t('identity.type')} name='type' defaultValue={savedTextValue('type')} required error={state.fieldErrors?.type}>
            <option value=''>{t('identity.selectType')}</option>
            {workoutTypes.map((type) => <option key={type} value={type}>{workoutTypeLabel(type)}</option>)}
          </SelectField>
        </div>
        <div className='grid gap-4 sm:grid-cols-2'>
          <SelectField label={t('identity.category')} name='category' defaultValue={savedTextValue('category')} required error={state.fieldErrors?.category}>
            <option value=''>{t('identity.selectCategory')}</option>
            {categories.map((category) => <option key={category} value={category}>{categoryLabel(category)}</option>)}
          </SelectField>
          <Field label={t('identity.tags')} name='tags' defaultValue={savedValue('tags')} placeholder={t('identity.tagsPlaceholder')} error={state.fieldErrors?.tags} />
        </div>
        <p className='text-xs text-muted-foreground'>{t('identity.tagsHelp')}</p>
      </fieldset>

      <fieldset className='space-y-4 rounded-lg border p-4'>
        <legend className='px-1 text-sm font-medium'>{t('structure.legend')}</legend>
        <p className='text-sm text-muted-foreground'>{t('structure.help')}</p>
        <TextAreaField label={t('structure.preliminary')} name='preliminaryExercises' rows={2} defaultValue={savedTextValue('preliminaryExercises')} placeholder={t('structure.preliminaryPlaceholder')} />
        <TextAreaField label={t('structure.warmup')} name='warmup' rows={2} defaultValue={savedTextValue('warmup')} placeholder={t('structure.warmupPlaceholder')} />
        <TextAreaField label={t('structure.mainBlock')} name='mainBlock' rows={3} defaultValue={savedTextValue('mainBlock')} placeholder={t('structure.mainBlockPlaceholder')} />
        <TextAreaField label={t('structure.cooldown')} name='cooldown' rows={2} defaultValue={savedTextValue('cooldown')} placeholder={t('structure.cooldownPlaceholder')} />
        {state.fieldErrors?.structure && <FieldError message={state.fieldErrors.structure} />}
      </fieldset>

      <fieldset className='space-y-4 rounded-lg border p-4'>
        <legend className='px-1 text-sm font-medium'>{t('session.legend')}</legend>
        <div className='grid gap-4 sm:grid-cols-2'>
          <SelectField label={t('session.location')} name='locationKey' defaultValue={savedTextValue('locationKey')}>
            <option value=''>{t('session.noLocation')}</option>
            {locations.map((location) => <option key={location.key} value={location.key}>{location.name}</option>)}
          </SelectField>
          <Field label={t('session.track')} name='trackPath' defaultValue={savedValue('trackPath')} placeholder={t('session.trackPlaceholder')} />
        </div>
        <TextAreaField label={t('session.notes')} name='notes' rows={3} defaultValue={savedTextValue('notes')} placeholder={t('session.notesPlaceholder')} />
      </fieldset>

      <fieldset className='space-y-4 rounded-lg border p-4'>
        <legend className='px-1 text-sm font-medium'>{t('prescription.legend')}</legend>
        <p className='text-sm text-muted-foreground'>{t('prescription.help')}</p>
        <div className='grid gap-4 sm:grid-cols-3'>
          <Field label={t('prescription.distance')} name='distanceKm' defaultValue={savedValue('distanceKm')} type='number' min='0' step='0.1' error={state.fieldErrors?.distanceKm} />
          <Field label={t('prescription.duration')} name='durationMin' defaultValue={savedValue('durationMin')} type='number' min='0' step='1' error={state.fieldErrors?.durationMin} />
          <Field label={t('prescription.elevation')} name='elevationGain' defaultValue={savedValue('elevationGain')} type='number' min='0' step='1' error={state.fieldErrors?.elevationGain} />
        </div>
        <SelectField label={t('prescription.intensityMethod')} name='intensityMethod' value={intensityMethod} onChange={setIntensityMethod} error={state.fieldErrors?.intensity}>
          <option value=''>{t('prescription.noIntensity')}</option>
          <option value='hr_zone'>{t('prescription.hrZone')}</option>
          <option value='pam_percentage'>{t('prescription.pam')}</option>
        </SelectField>
        {intensityMethod === 'hr_zone' && (
          <SelectField label={t('prescription.zone')} name='zone' defaultValue={savedTextValue('zone')} required error={state.fieldErrors?.intensity}>
            <option value=''>{t('prescription.selectZone')}</option>
            {zones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
          </SelectField>
        )}
        {intensityMethod === 'pam_percentage' && (
          <Field label={t('prescription.pamPercentage')} name='pamPercentage' defaultValue={savedValue('pamPercentage')} type='number' min='0.1' max='200' step='0.1' required error={state.fieldErrors?.intensity} />
        )}
        <TextAreaField label={t('prescription.notes')} name='prescriptionNotes' rows={3} defaultValue={savedTextValue('prescriptionNotes')} placeholder={t('prescription.notesPlaceholder')} />
      </fieldset>

      <div className='flex justify-end gap-2'>
        <Link href={templatesPath} className={buttonVariants({ variant: 'outline' })}>{t('cancel')}</Link>
        <Button type='submit' disabled={pending}>{pending ? t('saving') : isEditing ? t('update') : t('create')}</Button>
      </div>
    </form>
  )
}

type FieldProps = React.ComponentProps<typeof Input> & { label: string; name: string; error?: string }

function Field({ label, name, error, required, ...props }: FieldProps) {
  return <div className='space-y-1.5'><label htmlFor={name} className='text-sm font-medium'>{label}{required && <span className='text-destructive'> *</span>}</label><Input id={name} name={name} required={required} aria-invalid={Boolean(error)} {...props} />{error && <FieldError message={error} />}</div>
}

function TextAreaField({ label, name, rows, placeholder, defaultValue }: { label: string; name: string; rows: number; placeholder?: string; defaultValue?: string }) {
  return <div className='space-y-1.5'><label htmlFor={name} className='text-sm font-medium'>{label}</label><textarea id={name} name={name} rows={rows} placeholder={placeholder} defaultValue={defaultValue} className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50' /></div>
}

function SelectField({ label, name, required, children, value, defaultValue, onChange, error }: { label: string; name: string; required?: boolean; children: React.ReactNode; value?: string; defaultValue?: string; onChange?: (value: string) => void; error?: string }) {
  return <div className='space-y-1.5'><label htmlFor={name} className='text-sm font-medium'>{label}{required && <span className='text-destructive'> *</span>}</label><select id={name} name={name} required={required} value={value} defaultValue={value === undefined ? defaultValue : undefined} onChange={onChange ? (event) => onChange(event.target.value) : undefined} aria-invalid={Boolean(error)} className='h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive'>{children}</select>{error && <FieldError message={error} />}</div>
}

function FieldError({ message }: { message: string }) {
  return <p className='text-xs text-destructive'>{message}</p>
}
