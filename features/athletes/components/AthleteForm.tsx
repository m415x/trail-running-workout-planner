'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

import {
  createAthlete,
  updateAthlete,
  type AthleteFormState,
} from '@/app/actions/athlete-actions'
import { DirtyFormGuardProvider, useDirtyFormGuard } from '@/components/forms/dirty-form-guard'
import { GuardedLink } from '@/components/forms/guarded-link'
import {
  athleteFormDirtyValues,
  athleteFormDirtyValuesFromFormData,
  type AthleteFormDirtyValues,
} from '@/features/athletes/lib/athlete-form-dirty-values'
import { shouldMarkAthleteEditSaved } from '@/features/athletes/lib/athlete-edit-submit-guard'
import { buttonVariants, Button } from '@ui/button'
import { Input } from '@ui/input'

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
}

interface AthleteFormProps {
  locale: string
  athlete?: AthleteFormValues
}

const initialState: AthleteFormState = {}

export function AthleteForm({ locale, athlete }: AthleteFormProps) {
  if (!athlete) {
    return <AthleteFormContent locale={locale} />
  }

  const initialValue = athleteFormDirtyValues(athlete)

  return (
    <AthleteEditGuard initialValue={initialValue}>
      <AthleteFormContent locale={locale} athlete={athlete} />
    </AthleteEditGuard>
  )
}

function AthleteEditGuard({
  initialValue,
  children,
}: {
  initialValue: AthleteFormDirtyValues
  children: React.ReactNode
}) {
  const t = useTranslations('AthleteEditForm')
  const [currentValue, setCurrentValue] = useState(initialValue)

  return (
    <DirtyFormGuardProvider
      initialValue={initialValue}
      currentValue={currentValue}
      title={t('unsavedTitle')}
      description={t('unsavedDescription')}
      stayLabel={t('stay')}
      discardLabel={t('discard')}
    >
      <AthleteEditGuardBridge setCurrentValue={setCurrentValue}>
        {children}
      </AthleteEditGuardBridge>
    </DirtyFormGuardProvider>
  )
}

function AthleteEditGuardBridge({
  setCurrentValue,
  children,
}: {
  setCurrentValue(value: AthleteFormDirtyValues): void
  children: React.ReactNode
}) {
  return (
    <div
      onInput={(event) => {
        const form = (event.target as HTMLElement).closest('form')
        if (form) setCurrentValue(athleteFormDirtyValuesFromFormData(new FormData(form)))
      }}
    >
      {children}
    </div>
  )
}

function AthleteFormContent({ locale, athlete }: AthleteFormProps) {
  const action = athlete ? updateAthlete : createAthlete
  const [state, formAction, pending] = useActionState(action, initialState)
  const athletesPath = locale === 'es' ? '/dashboard/athletes' : `/${locale}/dashboard/athletes`

  return (
    <form action={formAction} className='space-y-6'>
      <input type='hidden' name='locale' value={locale} />
      {athlete?.id && <input type='hidden' name='athleteId' value={athlete.id} />}

      {athlete && <AthleteEditSubmitGuard pending={pending} error={state.error} />}

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
        {athlete ? (
          <GuardedLink href={athletesPath} className={buttonVariants({ variant: 'outline' })}>
            Cancelar
          </GuardedLink>
        ) : (
          <Link href={athletesPath} className={buttonVariants({ variant: 'outline' })}>
            Cancelar
          </Link>
        )}
        <Button type='submit' disabled={pending}>
          {pending ? 'Guardando…' : athlete ? 'Guardar cambios' : 'Crear atleta'}
        </Button>
      </div>
    </form>
  )
}

function AthleteEditSubmitGuard({
  pending,
  error,
}: {
  pending: boolean
  error?: string
}) {
  const { markSaved } = useDirtyFormGuard()
  const wasPending = useRef(false)

  useEffect(() => {
    if (pending) {
      wasPending.current = true
      return
    }

    if (shouldMarkAthleteEditSaved({ pending, error, wasPending: wasPending.current })) {
      markSaved()
      wasPending.current = false
    }
  }, [error, markSaved, pending])

  return null
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
