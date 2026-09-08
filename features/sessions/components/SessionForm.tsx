'use client'

import { useActionState, useState, type ChangeEvent, type FormEvent } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

import { createSession, updateSession, type SessionFormState } from '@/app/actions/session-actions'
import { Button, buttonVariants } from '@ui/button'
import { Input } from '@ui/input'

interface SessionFormProps {
  locale: string
  workouts: WorkoutTemplateOption[]
  locations: Array<{ key: string; name: string }>
  groups: Array<{
    id: string
    code: string
    microcycles: Array<{ id: string; label: string }>
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
      intensityMethod: 'hr_zone' | 'pam_percentage' | null
      zone: string | null
      pamPercentage: number | null
      notes: string | null
    }>
  }
}

interface WorkoutTemplateOption {
  id: string
  title: string
  type: string
  locationKey: string | null
  trackPath: string | null
  notes: string | null
  structure: {
    preliminaryExercises?: string | null
    warmup?: string | null
    mainBlock?: string | null
    cooldown?: string | null
  } | null
  distance: number | null
  time: number | null
  gain: number | null
  intensityMethod: 'hr_zone' | 'pam_percentage' | null
  zone: string | null
  pamPercentage: number | null
  prescriptionNotes: string | null
  archivedAt: string | null
}

type AppliedPrescriptionDefaults = Pick<
  WorkoutTemplateOption,
  'distance' | 'time' | 'gain' | 'intensityMethod' | 'zone' | 'pamPercentage' | 'prescriptionNotes'
>

interface PrescriptionFormValues {
  distanceKm: string
  durationMin: string
  elevationGain: string
  zone: string
  pamPercentage: string
  notes: string
}

function formValue(value: string | number | null | undefined) {
  return value == null ? '' : String(value)
}

const workoutTypes = ['Base', 'Long', 'Intervals', 'Trail', 'Speed', 'Fartlek', 'PAM', 'Hills', 'Rest', 'Race'] as const
const initialState: SessionFormState = {}

export function SessionForm({ locale, workouts, locations, groups, session }: SessionFormProps) {
  const templateText = useTranslations('WorkoutTemplates')
  const [state, formAction, pending] = useActionState(session ? updateSession : createSession, initialState)
  const [selectedGroupIds, setSelectedGroupIds] = useState(() => session?.sessionPrescriptions.map((item) => item.groupId) ?? [])
  const [clientError, setClientError] = useState<string>()
  const [selectedWorkoutId, setSelectedWorkoutId] = useState(session?.workoutId ?? '')
  const [appliedPrescriptionDefaults, setAppliedPrescriptionDefaults] = useState<AppliedPrescriptionDefaults | null>(null)
  const [prescriptionValues, setPrescriptionValues] = useState<Record<string, PrescriptionFormValues>>(() => Object.fromEntries(
    session?.sessionPrescriptions.map((item) => [item.groupId, {
      distanceKm: formValue(item.distanceKm),
      durationMin: formValue(item.durationMin),
      elevationGain: formValue(item.elevationGain),
      zone: formValue(item.zone),
      pamPercentage: formValue(item.pamPercentage),
      notes: formValue(item.notes),
    }]) ?? [],
  ))
  const [intensityMethods, setIntensityMethods] = useState<Record<string, string>>(() => Object.fromEntries(
    session?.sessionPrescriptions.map((item) => [item.groupId, item.intensityMethod ?? '']) ?? [],
  ))
  const sessionsPath = locale === 'es' ? '/dashboard/sessions' : `/${locale}/dashboard/sessions`

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

    setFormValue(form, 'title', template.title)
    setFormValue(form, 'type', template.type)
    setFormValue(form, 'locationKey', template.locationKey)
    setFormValue(form, 'trackPath', template.trackPath)
    setFormValue(form, 'preliminaryExercises', template.structure?.preliminaryExercises)
    setFormValue(form, 'warmup', template.structure?.warmup)
    setFormValue(form, 'mainBlock', template.structure?.mainBlock)
    setFormValue(form, 'cooldown', template.structure?.cooldown)
    setFormValue(form, 'notes', template.notes)

    const defaults: AppliedPrescriptionDefaults = {
      distance: template.distance,
      time: template.time,
      gain: template.gain,
      intensityMethod: template.intensityMethod,
      zone: template.zone,
      pamPercentage: template.pamPercentage,
      prescriptionNotes: template.prescriptionNotes,
    }
    setAppliedPrescriptionDefaults(defaults)
    setIntensityMethods((current) => ({
      ...current,
      ...Object.fromEntries(selectedGroupIds.map((groupId) => [groupId, defaults.intensityMethod ?? ''])),
    }))
    setPrescriptionValues((current) => ({
      ...current,
      ...Object.fromEntries(selectedGroupIds.map((groupId) => [groupId, valuesFromDefaults(defaults)])),
    }))
  }

  function valuesFromDefaults(defaults: AppliedPrescriptionDefaults): PrescriptionFormValues {
    return {
      distanceKm: formValue(defaults.distance),
      durationMin: formValue(defaults.time),
      elevationGain: formValue(defaults.gain),
      zone: formValue(defaults.zone),
      pamPercentage: formValue(defaults.pamPercentage),
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
          pamPercentage: null,
          prescriptionNotes: null,
        })),
        [field]: value,
      },
    }))
  }

  function toggleGroup(groupId: string, checked: boolean) {
    setSelectedGroupIds((current) => checked ? [...current, groupId] : current.filter((id) => id !== groupId))
    if (checked) {
      setClientError(undefined)
      if (appliedPrescriptionDefaults) {
        setIntensityMethods((current) => ({
          ...current,
          [groupId]: appliedPrescriptionDefaults.intensityMethod ?? '',
        }))
        setPrescriptionValues((current) => ({
          ...current,
          [groupId]: current[groupId] ?? valuesFromDefaults(appliedPrescriptionDefaults),
        }))
      }
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (selectedGroupIds.length > 0) return

    event.preventDefault()
    setClientError('Asigná la sesión al menos a un grupo')
    document.getElementById('session-form-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className='space-y-6'>
      <input type='hidden' name='locale' value={locale} />
      {session && <input type='hidden' name='sessionId' value={session.id} />}
      {(clientError || state.error) && <div id='session-form-error' role='alert' className='rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive'>{clientError || state.error}</div>}

      <div className='grid gap-4 sm:grid-cols-2'>
        <Field label='Fecha' name='date' type='date' defaultValue={session?.date} required />
        <Field label='Título' name='title' placeholder='Ej.: Fondo de montaña' defaultValue={session?.title} minLength={2} required />
      </div>

      <div className='grid gap-4 sm:grid-cols-2'>
        <SelectField label='Tipo de entrenamiento' name='type' defaultValue={session?.type} required>
          <option value=''>Seleccionar tipo</option>
          {workoutTypes.map((type) => <option key={type} value={type}>{type}</option>)}
        </SelectField>
        <div className='space-y-1.5'>
          <SelectField label='Plantilla de entrenamiento' name='workoutId' value={selectedWorkoutId} onChangeEvent={applyWorkoutTemplate}>
            <option value=''>Sin plantilla</option>
            {workouts.map((workout) => <option key={workout.id} value={workout.id}>{workout.title} · {workout.type}{workout.archivedAt ? ` · ${templateText('archive.archived')}` : ''}</option>)}
          </SelectField>
          <p className='text-xs text-muted-foreground'>{templateText('applicationHelp')}</p>
        </div>
      </div>

      <SelectField label='Ubicación' name='locationKey' defaultValue={session?.locationKey ?? ''}>
        <option value=''>Sin ubicación</option>
        {locations.map((location) => <option key={location.key} value={location.key}>{location.name}</option>)}
      </SelectField>

      <Field label='Track' name='trackPath' placeholder='Ruta o referencia del track (opcional)' defaultValue={session?.trackPath ?? ''} />

      <fieldset className='space-y-4 rounded-lg border p-4'>
        <legend className='px-1 text-sm font-medium'>Estructura de la sesión</legend>
        <p className='text-sm text-muted-foreground'>Todos los bloques son opcionales. Completá sólo los que correspondan al entrenamiento.</p>
        <TextAreaField label='Ejercicios preliminares' name='preliminaryExercises' rows={2} placeholder='Movilidad, activación, técnica…' defaultValue={session?.structure?.preliminaryExercises} />
        <TextAreaField label='Entrada en calor' name='warmup' rows={2} placeholder='Ej.: 15 min suaves + movilidad dinámica' defaultValue={session?.structure?.warmup} />
        <TextAreaField label='Bloque principal' name='mainBlock' rows={3} placeholder='Ej.: 6 × 800 m con recuperación de 2 min' defaultValue={session?.structure?.mainBlock} />
        <TextAreaField label='Vuelta a la calma' name='cooldown' rows={2} placeholder='Ej.: 10 min suaves + elongación' defaultValue={session?.structure?.cooldown} />
      </fieldset>

      <TextAreaField label='Notas' name='notes' rows={4} placeholder='Indicaciones generales de la sesión…' defaultValue={session?.notes} />

      <fieldset className='space-y-4 rounded-lg border p-4'>
        <legend className='px-1 text-sm font-medium'>Prescripciones por grupo</legend>
        <p className='text-sm text-muted-foreground'>Seleccioná al menos un grupo y definí la carga que verá en su planificación.</p>

        {groups.length === 0 ? (
          <p className='rounded-md bg-muted/40 p-3 text-sm text-muted-foreground'>No hay grupos activos disponibles.</p>
        ) : groups.map((group) => {
          const selected = selectedGroupIds.includes(group.id)
          const current = session?.sessionPrescriptions.find((item) => item.groupId === group.id)
          const method = intensityMethods[group.id] ?? current?.intensityMethod ?? ''
          const hasMicrocycles = group.microcycles.length > 0
          const values = prescriptionValues[group.id] ?? {
            distanceKm: '',
            durationMin: '',
            elevationGain: '',
            zone: '',
            pamPercentage: '',
            notes: '',
          }

          return (
            <div key={group.id} className='rounded-lg border p-4'>
              <label className='flex items-center gap-2 font-medium'>
                <input
                  type='checkbox'
                  name='prescriptionGroupId'
                  value={group.id}
                  checked={selected}
                  disabled={!hasMicrocycles}
                  onChange={(event) => toggleGroup(group.id, event.target.checked)}
                  className='size-4 accent-primary'
                />
                Grupo {group.code}
              </label>

              {!hasMicrocycles ? (
                <p className='mt-2 text-sm text-muted-foreground'>Este grupo no tiene microciclos disponibles.</p>
              ) : selected && (
                <div className='mt-4 space-y-4'>
                  <SelectField label='Microciclo' name={`microcycleId:${group.id}`} defaultValue={current?.microcycleId ?? ''} required>
                    <option value=''>Seleccionar microciclo</option>
                    {group.microcycles.map((microcycle) => <option key={microcycle.id} value={microcycle.id}>{microcycle.label}</option>)}
                  </SelectField>

                  <div className='grid gap-4 sm:grid-cols-3'>
                    <Field label='Distancia (km)' name={`distanceKm:${group.id}`} type='number' min='0' step='0.1' value={values.distanceKm} onChange={(event) => updatePrescriptionValue(group.id, 'distanceKm', event.target.value)} />
                    <Field label='Duración (min)' name={`durationMin:${group.id}`} type='number' min='0' step='1' value={values.durationMin} onChange={(event) => updatePrescriptionValue(group.id, 'durationMin', event.target.value)} />
                    <Field label='Desnivel (m+)' name={`elevationGain:${group.id}`} type='number' min='0' step='1' value={values.elevationGain} onChange={(event) => updatePrescriptionValue(group.id, 'elevationGain', event.target.value)} />
                  </div>

                  <SelectField
                    label='Método de intensidad'
                    name={`intensityMethod:${group.id}`}
                    value={method}
                    onChange={(value) => setIntensityMethods((currentMethods) => ({ ...currentMethods, [group.id]: value }))}
                  >
                    <option value=''>Sin intensidad</option>
                    <option value='hr_zone'>Zona de frecuencia cardíaca</option>
                    <option value='pam_percentage'>Porcentaje PAM</option>
                  </SelectField>

                  {method === 'hr_zone' && (
                    <SelectField label='Zona' name={`zone:${group.id}`} value={values.zone} onChange={(value) => updatePrescriptionValue(group.id, 'zone', value)} required>
                      <option value=''>Seleccionar zona</option>
                      {['Z1', 'Z2', 'Z3', 'Z4', 'Z5'].map((zone) => <option key={zone}>{zone}</option>)}
                    </SelectField>
                  )}
                  {method === 'pam_percentage' && (
                    <Field label='Porcentaje PAM' name={`pamPercentage:${group.id}`} type='number' min='0.1' max='200' step='0.1' value={values.pamPercentage} onChange={(event) => updatePrescriptionValue(group.id, 'pamPercentage', event.target.value)} required />
                  )}

                  <TextAreaField label='Indicaciones para el grupo' name={`prescriptionNotes:${group.id}`} rows={3} value={values.notes} onChange={(value) => updatePrescriptionValue(group.id, 'notes', value)} />
                </div>
              )}
            </div>
          )
        })}
      </fieldset>

      <div className='flex justify-end gap-2'>
        <Link href={sessionsPath} className={buttonVariants({ variant: 'outline' })}>Cancelar</Link>
        <Button type='submit' disabled={pending}>{pending ? 'Guardando…' : session ? 'Guardar cambios' : 'Crear sesión'}</Button>
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
