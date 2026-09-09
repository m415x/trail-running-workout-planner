'use client'

import { useActionState } from 'react'
import Link from 'next/link'

import {
  assignAthleteToPlanningCohort,
  closePlanningCohortMembership,
  type PlanningCohortMembershipFormState,
} from '@/app/actions/planning-cohort-actions'
import { Button, buttonVariants } from '@ui/button'
import { Input } from '@ui/input'

interface AthleteOption {
  id: string
  nickName: string | null
  user: { firstName: string; lastName: string }
}

interface MembershipFormBaseProps {
  locale: string
  cohortId: string
}

interface AssignmentFormProps extends MembershipFormBaseProps {
  athletes: AthleteOption[]
  defaultStartDate: string
}

interface ClosureFormProps extends MembershipFormBaseProps {
  membershipId: string
  athleteName: string
  startDate: string
  defaultEndDate: string
}

const initialState: PlanningCohortMembershipFormState = {}

function cohortPath(locale: string, cohortId: string) {
  return locale === 'es' ? `/dashboard/cohorts/${cohortId}` : `/${locale}/dashboard/cohorts/${cohortId}`
}

export function PlanningCohortAssignmentForm({ locale, cohortId, athletes, defaultStartDate }: AssignmentFormProps) {
  const [state, formAction, pending] = useActionState(assignAthleteToPlanningCohort, initialState)

  return (
    <form action={formAction} className='space-y-6'>
      <input type='hidden' name='locale' value={locale} />
      <input type='hidden' name='cohortId' value={cohortId} />

      {state.error && <div role='alert' className='rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive'>{state.error}</div>}

      <div className='space-y-1.5'>
        <label htmlFor='athleteProfileId' className='text-sm font-medium'>Atleta <span className='text-destructive'>*</span></label>
        <select
          id='athleteProfileId'
          name='athleteProfileId'
          required
          defaultValue={state.values?.athleteProfileId ?? ''}
          className='border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]'
        >
          <option value=''>Seleccionar atleta</option>
          {athletes.map((athlete) => (
            <option key={athlete.id} value={athlete.id}>
              {athlete.user.lastName}, {athlete.user.firstName}{athlete.nickName ? ` · “${athlete.nickName}”` : ''}
            </option>
          ))}
        </select>
        {athletes.length === 0 && <p className='text-sm text-destructive'>No hay atletas activos en este grupo.</p>}
      </div>

      <div className='space-y-1.5'>
        <label htmlFor='startDate' className='text-sm font-medium'>Fecha de inicio <span className='text-destructive'>*</span></label>
        <Input id='startDate' name='startDate' type='date' required defaultValue={state.values?.startDate ?? defaultStartDate} />
        <p className='text-xs text-muted-foreground'>La planificación de la cohorte comenzará a aplicar desde este día inclusive.</p>
      </div>

      <div className='space-y-1.5'>
        <label htmlFor='reason' className='text-sm font-medium'>Motivo</label>
        <Input id='reason' name='reason' maxLength={300} defaultValue={state.values?.reason ?? ''} placeholder='Ej.: Objetivo competitivo compartido' />
      </div>

      <div className='flex justify-end gap-2'>
        <Link href={cohortPath(locale, cohortId)} className={buttonVariants({ variant: 'outline' })}>Cancelar</Link>
        <Button type='submit' disabled={pending || athletes.length === 0}>{pending ? 'Asignando…' : 'Asignar atleta'}</Button>
      </div>
    </form>
  )
}

export function PlanningCohortClosureForm({ locale, cohortId, membershipId, athleteName, startDate, defaultEndDate }: ClosureFormProps) {
  const [state, formAction, pending] = useActionState(closePlanningCohortMembership, initialState)

  return (
    <form action={formAction} className='space-y-6'>
      <input type='hidden' name='locale' value={locale} />
      <input type='hidden' name='cohortId' value={cohortId} />
      <input type='hidden' name='membershipId' value={membershipId} />

      {state.error && <div role='alert' className='rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive'>{state.error}</div>}

      <div className='rounded-xl border p-4'>
        <p className='text-sm text-muted-foreground'>Atleta</p>
        <p className='text-xl font-semibold'>{athleteName}</p>
        <p className='mt-1 text-sm text-muted-foreground'>Membresía iniciada el {startDate}.</p>
      </div>

      <div className='space-y-1.5'>
        <label htmlFor='endDate' className='text-sm font-medium'>Último día en la cohorte <span className='text-destructive'>*</span></label>
        <Input id='endDate' name='endDate' type='date' required min={startDate} defaultValue={state.values?.endDate ?? defaultEndDate} />
        <p className='text-xs text-muted-foreground'>La fecha es inclusiva: el cambio de planificación se aplica a partir del día siguiente.</p>
      </div>

      <div className='space-y-1.5'>
        <label htmlFor='reason' className='text-sm font-medium'>Motivo</label>
        <Input id='reason' name='reason' maxLength={300} defaultValue={state.values?.reason ?? ''} placeholder='Ej.: Cambio de objetivo o cierre del bloque' />
      </div>

      <div className='flex justify-end gap-2'>
        <Link href={cohortPath(locale, cohortId)} className={buttonVariants({ variant: 'outline' })}>Cancelar</Link>
        <Button type='submit' variant='destructive' disabled={pending}>{pending ? 'Guardando…' : 'Retirar atleta'}</Button>
      </div>
    </form>
  )
}
