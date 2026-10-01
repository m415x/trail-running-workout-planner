'use client'

import { useActionState, useState, type ChangeEvent, type FormEvent } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

import { createSession, updateSession, type SessionFormState } from '@/app/actions/session-actions'
import { SESSION_REFERENCE_PERCENTAGES } from '@/lib/sessions/reference-percentage-options'
import { WORKOUT_TYPES, type WorkoutTemplateSnapshot, type WorkoutType } from '@/types'
import { Button, buttonVariants } from '@ui/button'
import { Input } from '@ui/input'

interface SessionFormProps {
  locale: string
  workouts: WorkoutTemplateOption[]
  locations: Array<{ key: string; name: string }>
  groups: Array<{
    id: string
    code: string
    microcycles: Array<{ id: string; planTitle: string; weekNumber: number; startDate: string; endDate: string }>
  }>
  session?: {
    id: string
    date: string
    title: string
    type: string
    workoutId: string | null
    locationKey: string | null
    trackPath: string | null
    notes: string | null
    structure: {
      preliminaryExercises?: string | null
      warmup?: string | null
      mainBlock?: string | null
      cooldown?: string | null
    } | null
    sessionPrescriptions: Array<{
      groupId: string
      microcycleId: string
      distanceKm: number | null
      durationMin: number | null
      elevationGain: number | null
      intensityMethod: 'hr_zone' | 'reference_percentage' | null
      zone: string | null
      referencePercentage: number | null
      notes: string | null
    }>
  }
}

interface WorkoutTemplateOption {
  id: string
  title: string
  type: WorkoutType
  archivedAt: string | null
  snapshot: WorkoutTemplateSnapshot
}

interface AppliedPrescriptionDefaults {
  distance: number | null
  time: number | null
  gain: number | null
  intensityMethod: 'hr_zone' | 'reference_percentage' | null
  zone: string | null
  referencePercentage: number | null
  prescriptionNotes: string | null
}

interface PrescriptionFormValues {
  distanceKm: string
  durationMin: string
  elevationGain: string
  zone: string
  referencePercentage: string
  notes: string
}

function formValue(value: string | number | null | undefined) {
  return value == null ? '' : String(value)
}

const initialState: SessionFormState = {}
export function SessionForm({ locale, workouts, locations, groups, session }: SessionFormProps) {
  const t = useTranslations('Sessions')
  const workoutTypeT = useTranslations('Workouts')
  const templateText = useTranslations('WorkoutTemplates')
  const [state, formAction, pending] = useActionState(session ? updateSession : createSession, initialState)
  const [selectedMicrocycleIds, setSelectedMicrocycleIds] = useState<string[]>(() =>
    session
      ? session.sessionPrescriptions.map((item) => item.microcycleId)
      : groups.flatMap((group) => {
        const matching = group.microcycles.filter((microcycle) =>
          microcycle.startDate <= (session?.date ?? '') && (session?.date ?? '') <= microcycle.endDate)
        return matching.length === 1 ? [matching[0].id] : []
      }),
  )
  const [sessionDate, setSessionDate] = useState(session?.date ?? '')
  const [clientError, setClientError] = useState<string>()
  const [selectedWorkoutId, setSelectedWorkoutId] = useState(session?.workoutId ?? '')
  const [sessionType, setSessionType] = useState(session?.type ?? '')
  const [sessionNotes, setSessionNotes] = useState(session?.notes ?? '')
  const [appliedPrescriptionDefaults, setAppliedPrescriptionDefaults] = useState<AppliedPrescriptionDefaults | null>(null)
  const [prescriptionValues, setPrescriptionValues] = useState<Record<string, PrescriptionFormValues>>(() => Object.fromEntries(
    session?.sessionPrescriptions.map((item) => [item.microcycleId, {
      distanceKm: formValue(item.distanceKm),
      durationMin: formValue(item.durationMin),
      elevationGain: formValue(item.elevationGain),
      zone: formValue(item.zone),
      referencePercentage: formValue(item.referencePercentage),
      notes: formValue(item.notes),
    }]) ?? [],
  ))
  const [intensityMethods, setIntensityMethods] = useState<Record<string, string>>(() => Object.fromEntries(
    session?.sessionPrescriptions.map((item) => [item.microcycleId, item.intensityMethod ?? '']) ?? [],
  ))
  const selectedScopes = groups.flatMap((group) =>
    group.microcycles.filter((microcycle) => selectedMicrocycleIds.includes(microcycle.id))
      .map((microcycle) => ({ groupId: group.id, microcycle })),
  )
  const sessionsPath = locale === 'es' ? '/dashboard/sessions' : `/${locale}/dashboard/sessions`
  const serverError = state.errorCode ? t(`form.errors.server.${state.errorCode}`, state.errorParams) : undefined

  function setFormValue(form: HTMLFormElement, name: string, value: string | number | null | undefined) {
    const field = form.elements.namedItem(name)
    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
      field.value = value == null ? '' : String(value)
    }
  }

  function applyWorkoutTemplate(event: ChangeEvent<HTMLSelectElement>) {
    const workoutId = event.target.value
    setSelectedWorkoutId(workoutId)
    const template = workouts.find((workout) => workout.id === workoutId)
    if (!template) {
      setAppliedPrescriptionDefaults(null)
      return
    }

    const form = event.currentTarget.form
    if (!form) return
    const snapshot = template.snapshot

    setFormValue(form, 'title', snapshot.session.title)
    setFormValue(form, 'type', snapshot.session.type)
    setSessionType(snapshot.session.type)
    setFormValue(form, 'locationKey', snapshot.session.locationKey)
    setFormValue(form, 'trackPath', snapshot.session.trackPath)
    setFormValue(form, 'preliminaryExercises', snapshot.session.structure?.preliminaryExercises)
    setFormValue(form, 'warmup', snapshot.session.structure?.warmup)
    setFormValue(form, 'mainBlock', snapshot.session.structure?.mainBlock)
    setFormValue(form, 'cooldown', snapshot.session.structure?.cooldown)
    const templateNotes = snapshot.session.notes ?? ''
    setSessionNotes(templateNotes || ((snapshot.session.type === 'Trail' || snapshot.session.type === 'Hills') ? t('form.trailEffortNote') : ''))

    const defaults: AppliedPrescriptionDefaults = {
      distance: snapshot.prescription.distanceKm ?? null,
      time: snapshot.prescription.durationMin ?? null,
      gain: snapshot.prescription.elevationGain ?? null,
      intensityMethod: snapshot.prescription.intensity?.method ?? null,
      zone: snapshot.prescription.intensity?.method === 'hr_zone' ? snapshot.prescription.intensity.zone : null,
      referencePercentage: snapshot.prescription.intensity?.method === 'reference_percentage' ? snapshot.prescription.intensity.referencePercentage : null,
      prescriptionNotes: snapshot.prescription.notes,
    }
    setAppliedPrescriptionDefaults(defaults)
    setIntensityMethods((current) => ({
      ...current,
      ...Object.fromEntries(selectedMicrocycleIds.map((microcycleId) => [microcycleId, defaults.intensityMethod ?? ''])),
    }))
    setPrescriptionValues((current) => ({
      ...current,
      ...Object.fromEntries(selectedMicrocycleIds.map((microcycleId) => [microcycleId, valuesFromDefaults(defaults)])),
    }))
  }

  function valuesFromDefaults(defaults: AppliedPrescriptionDefaults): PrescriptionFormValues {
    return {
      distanceKm: formValue(defaults.distance),
      durationMin: formValue(defaults.time),
      elevationGain: formValue(defaults.gain),
      zone: formValue(defaults.zone),
      referencePercentage: formValue(defaults.referencePercentage),
      notes: formValue(defaults.prescriptionNotes),
    }
  }

  function updatePrescriptionValue(groupId: string, field: keyof PrescriptionFormValues, value: string) {
    setPrescriptionValues((current) => ({
      ...current,
      [groupId]: {
        ...(current[groupId] ?? valuesFromDefaults(appliedPrescriptionDefaults ?? {
          distance: null,
          time: null,
          gain: null,
          intensityMethod: null,
          zone: null,
          referencePercentage: null,
          prescriptionNotes: null,
        })),
        [field]: value,
      },
    }))
  }

  function toggleScope(microcycleId: string, checked: boolean) {
    setSelectedMicrocycleIds((current) => checked
      ? [...current.filter((id) => id !== microcycleId), microcycleId]
      : current.filter((id) => id !== microcycleId))
    setClientError(undefined)
    if (checked && appliedPrescriptionDefaults) {
      setIntensityMethods((current) => ({
        ...current, [microcycleId]: current[microcycleId] ?? appliedPrescriptionDefaults.intensityMethod ?? '',
      }))
      setPrescriptionValues((current) => ({
        ...current, [microcycleId]: current[microcycleId] ?? valuesFromDefaults(appliedPrescriptionDefaults),
      }))
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const invalid = selectedScopes.find(({ microcycle }) =>
      sessionDate < microcycle.startDate || sessionDate > microcycle.endDate)
    if (selectedScopes.length > 0 && !invalid && selectedScopes.length === selectedMicrocycleIds.length) return

    event.preventDefault()
    const group = groups.find((item) => item.id === invalid?.groupId)
    setClientError(invalid
      ? t('form.prescriptions.microcycleUnavailable', { group: group?.code ?? invalid.groupId })
      : t('form.errors.groupRequired'))
    document.getElementById('session-form-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className='space-y-6'>
      <input type='hidden' name='locale' value={locale} />
      {session && <input type='hidden' name='sessionId' value={session.id} />}
      {(clientError || serverError) && <div id='session-form-error' role='alert' className='rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive'>{clientError || serverError}</div>}

      <div className='grid gap-4 sm:grid-cols-2'>
        <Field label={t('form.date')} name='date' type='date' value={sessionDate} onChange={(event) => {
          const date = event.target.value
          setSessionDate(date)
          setClientError(undefined)
          if (!session) {
            setSelectedMicrocycleIds(groups.flatMap((group) => {
              const matching = group.microcycles.filter((microcycle) => microcycle.startDate <= date && date <= microcycle.endDate)
              return matching.length === 1 ? [matching[0].id] : []
            }))
          }
        }} required />
        <Field label={t('form.title')} name='title' placeholder={t('form.titlePlaceholder')} defaultValue={session?.title} minLength={2} required />
      </div>

      <div className='grid gap-4 sm:grid-cols-2'>
        <SelectField label={t('form.type')} name='type' value={sessionType} onChange={(type) => { setSessionType(type); if (!session && !sessionNotes && (type === 'Trail' || type === 'Hills')) setSessionNotes(t('form.trailEffortNote')) }} required>
          <option value=''>{t('form.selectType')}</option>
          {WORKOUT_TYPES.map((type) => <option key={type} value={type}>{workoutTypeT(`types.${type}`)}</option>)}
        </SelectField>
        <div className='space-y-1.5'>
          <SelectField label={t('form.template')} name='workoutId' value={selectedWorkoutId} onChangeEvent={applyWorkoutTemplate}>
            <option value=''>{t('form.noTemplate')}</option>
            {workouts.map((workout) => <option key={workout.id} value={workout.id}>{workout.title} · {workoutTypeT(`types.${workout.type}`)}{workout.archivedAt ? ` · ${templateText('archive.archived')}` : ''}</option>)}
          </SelectField>
          <p className='text-xs text-muted-foreground'>{templateText('applicationHelp')}</p>
        </div>
      </div>

      <SelectField label={t('form.location')} name='locationKey' defaultValue={session?.locationKey ?? ''}>
        <option value=''>{t('form.noLocation')}</option>
        {locations.map((location) => <option key={location.key} value={location.key}>{location.name}</option>)}
      </SelectField>

      <Field label={t('form.track')} name='trackPath' placeholder={t('form.trackPlaceholder')} defaultValue={session?.trackPath ?? ''} />

      <fieldset className='space-y-4 rounded-lg border p-4'>
        <legend className='px-1 text-sm font-medium'>{t('form.structure.title')}</legend>
        <p className='text-sm text-muted-foreground'>{t('form.structure.help')}</p>
        <TextAreaField label={t('form.structure.preliminaryExercises')} name='preliminaryExercises' rows={2} placeholder={t('form.structure.preliminaryExercisesPlaceholder')} defaultValue={session?.structure?.preliminaryExercises} />
        <TextAreaField label={t('form.structure.warmup')} name='warmup' rows={2} placeholder={t('form.structure.warmupPlaceholder')} defaultValue={session?.structure?.warmup} />
        <TextAreaField label={t('form.structure.mainBlock')} name='mainBlock' rows={3} placeholder={t('form.structure.mainBlockPlaceholder')} defaultValue={session?.structure?.mainBlock} />
        <TextAreaField label={t('form.structure.cooldown')} name='cooldown' rows={2} placeholder={t('form.structure.cooldownPlaceholder')} defaultValue={session?.structure?.cooldown} />
      </fieldset>

      <TextAreaField label={t('form.notes')} name='notes' rows={4} placeholder={t('form.notesPlaceholder')} value={sessionNotes} onChange={setSessionNotes} />

      <fieldset className='space-y-4 rounded-lg border p-4'>
        <legend className='px-1 text-sm font-medium'>{t('form.prescriptions.title')}</legend>
        <p className='text-sm text-muted-foreground'>{t('form.prescriptions.help')}</p>

        {groups.length === 0 ? (
          <p className='rounded-md bg-muted/40 p-3 text-sm text-muted-foreground'>{t('form.prescriptions.noGroups')}</p>
        ) : groups.map((group) => {
          const candidates = group.microcycles.filter((microcycle) =>
            (microcycle.startDate <= sessionDate && sessionDate <= microcycle.endDate)
            || selectedMicrocycleIds.includes(microcycle.id))
          return (
            <div key={group.id} className='space-y-3 rounded-lg border p-4'>
              <p className='font-medium'>{t('form.prescriptions.group')} {group.code}</p>
              {candidates.length === 0 ? (
                <p className='text-sm text-muted-foreground'>{t('form.prescriptions.noMicrocycles')}</p>
              ) : candidates.map((microcycle) => {
                const microcycleId = microcycle.id
                const selected = selectedMicrocycleIds.includes(microcycleId)
                const method = intensityMethods[microcycleId] ?? ''
                const values = prescriptionValues[microcycleId] ?? {
                  distanceKm: '', durationMin: '', elevationGain: '',
                  zone: '', referencePercentage: '', notes: '',
                }
                const inDate = microcycle.startDate <= sessionDate && sessionDate <= microcycle.endDate
                return (
                  <div key={microcycleId} className='space-y-4 rounded-md border p-3'>
                    <label className='flex items-start gap-2'>
                      <input
                        type='checkbox'
                        checked={selected}
                        disabled={!inDate}
                        onChange={(event) => toggleScope(microcycleId, event.target.checked)}
                        className='mt-1 size-4 accent-primary'
                      />
                      <span className='text-sm'>{t('form.prescriptions.microcycleOption', {
                        plan: microcycle.planTitle, week: microcycle.weekNumber,
                        start: microcycle.startDate, end: microcycle.endDate,
                      })}</span>
                    </label>
                    {selected && (
                      <>
                        <input type='hidden' name='prescriptionGroupId' value={group.id} />
                        <input type='hidden' name={`microcycleId:${group.id}`} value={microcycleId} />
                        <input type='hidden' name={`microcycleId:${microcycleId}`} value={microcycleId} />
                        <div className='grid gap-4 sm:grid-cols-3'>
                          <Field label={t('form.prescriptions.distance')} name={`distanceKm:${group.id}`} type='number' min='0' step='0.1' value={values.distanceKm} onChange={(event) => updatePrescriptionValue(microcycleId, 'distanceKm', event.target.value)} />
                          <Field label={t('form.prescriptions.duration')} name={`durationMin:${group.id}`} type='number' min='1' step='1' value={values.durationMin} onChange={(event) => updatePrescriptionValue(microcycleId, 'durationMin', event.target.value)} />
                          <Field label={t('form.prescriptions.elevationGain')} name={`elevationGain:${group.id}`} type='number' min='0' step='1' value={values.elevationGain} onChange={(event) => updatePrescriptionValue(microcycleId, 'elevationGain', event.target.value)} />
                        </div>
                        <SelectField
                          label={t('form.prescriptions.intensityMethod')}
                          name={`intensityMethod:${group.id}`}
                          value={method}
                          onChange={(value) => setIntensityMethods((current) => ({ ...current, [microcycleId]: value }))}
                        >
                          <option value=''>{t('form.prescriptions.noIntensity')}</option>
                          <option value='hr_zone'>{t('form.prescriptions.hrZone')}</option>
                          <option value='reference_percentage'>{t('form.prescriptions.referencePercentage')}</option>
                        </SelectField>
                        {method === 'hr_zone' ? (
                          <SelectField label={t('form.prescriptions.zone')} name={`zone:${group.id}`} value={values.zone} onChange={(value) => updatePrescriptionValue(microcycleId, 'zone', value)} required>
                            <option value=''>{t('form.prescriptions.selectZone')}</option>
                            {['Z1', 'Z2', 'Z3', 'Z4', 'Z5'].map((zone) => <option key={zone}>{zone}</option>)}
                          </SelectField>
                        ) : <input type='hidden' name={`zone:${group.id}`} value='' />}
                        {method === 'reference_percentage' ? (
                          <SelectField label={t('form.prescriptions.percentage')} name={`referencePercentage:${group.id}`} value={values.referencePercentage} onChange={(value) => updatePrescriptionValue(microcycleId, 'referencePercentage', value)} required>
                            <option value=''>{t('form.prescriptions.selectPercentage')}</option>
                            {SESSION_REFERENCE_PERCENTAGES.map((percentage) => <option key={percentage} value={percentage}>{percentage}%</option>)}
                          </SelectField>
                        ) : <input type='hidden' name={`referencePercentage:${group.id}`} value='' />}
                        <TextAreaField label={t('form.prescriptions.notes')} name={`prescriptionNotes:${group.id}`} rows={3} value={values.notes} onChange={(value) => updatePrescriptionValue(microcycleId, 'notes', value)} />
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}

      </fieldset>

      <div className='flex justify-end gap-2'>
        <Link href={sessionsPath} className={buttonVariants({ variant: 'outline' })}>{t('form.actions.cancel')}</Link>
        <Button type='submit' disabled={pending}>{pending ? t('form.actions.saving') : session ? t('form.actions.saveChanges') : t('form.actions.create')}</Button>
      </div>
    </form>
  )
}

type FieldProps = React.ComponentProps<typeof Input> & { label: string; name: string }

function Field({ label, name, type = 'text', required, defaultValue, value, ...props }: FieldProps) {
  return <div className='space-y-1.5'><label htmlFor={name} className='text-sm font-medium'>{label}{required && <span className='text-destructive'> *</span>}</label><Input id={name} name={name} type={type} required={required} defaultValue={value === undefined ? defaultValue ?? '' : undefined} value={value} {...props} /></div>
}

function TextAreaField({ label, name, rows, placeholder, defaultValue, value, onChange }: { label: string; name: string; rows: number; placeholder?: string; defaultValue?: string | null; value?: string; onChange?: (value: string) => void }) {
  return <div className='space-y-1.5'><label htmlFor={name} className='text-sm font-medium'>{label}</label><textarea id={name} name={name} rows={rows} placeholder={placeholder} defaultValue={value === undefined ? defaultValue ?? '' : undefined} value={value} onChange={onChange ? (event) => onChange(event.target.value) : undefined} className='border-input bg-background w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]' /></div>
}

function SelectField({ label, name, required, children, defaultValue, value, onChange, onChangeEvent }: { label: string; name: string; required?: boolean; children: React.ReactNode; defaultValue?: string; value?: string; onChange?: (value: string) => void; onChangeEvent?: (event: ChangeEvent<HTMLSelectElement>) => void }) {
  return <div className='space-y-1.5'><label htmlFor={name} className='text-sm font-medium'>{label}{required && <span className='text-destructive'> *</span>}</label><select id={name} name={name} required={required} defaultValue={value === undefined ? defaultValue : undefined} value={value} onChange={onChangeEvent ?? (onChange ? (event) => onChange(event.target.value) : undefined)} className='border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]'>{children}</select></div>
}
