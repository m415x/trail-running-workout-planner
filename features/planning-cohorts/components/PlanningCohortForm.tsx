'use client'

import { useActionState } from 'react'
import Link from 'next/link'

import {
  createPlanningCohort,
  updatePlanningCohort,
  type PlanningCohortFormState,
} from '@/app/actions/planning-cohort-actions'
import { Button, buttonVariants } from '@ui/button'
import { Input } from '@ui/input'

interface SportingGroupOption {
  id: string
  categoryCode: string
  levelCode: string
  description: string | null
}

interface PlanningCohortFormValues {
  id: string
  groupId: string
  name: string
  purpose: string
  description: string | null
  status: 'active' | 'archived'
  group: SportingGroupOption
}

interface PlanningCohortFormProps {
  locale: string
  groups: SportingGroupOption[]
  cohort?: PlanningCohortFormValues
}

const initialState: PlanningCohortFormState = {}

export function PlanningCohortForm({ locale, groups, cohort }: PlanningCohortFormProps) {
  const isEditing = cohort !== undefined
  const action = isEditing ? updatePlanningCohort : createPlanningCohort
  const [state, formAction, pending] = useActionState(action, initialState)
  const cohortsPath = locale === 'es' ? '/dashboard/cohorts' : `/${locale}/dashboard/cohorts`
  const isArchived = cohort?.status === 'archived'

  return (
    <form action={formAction} className='space-y-6'>
      <input type='hidden' name='locale' value={locale} />
      {cohort && <input type='hidden' name='cohortId' value={cohort.id} />}

      {state.error && (
        <div role='alert' className='rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive'>
          {state.error}
        </div>
      )}

      {isEditing ? (
        <div className='rounded-xl border p-4'>
          <p className='text-sm text-muted-foreground'>Grupo deportivo</p>
          <p className='text-2xl font-semibold'>{cohort.group.categoryCode}{cohort.group.levelCode}</p>
          <p className='mt-1 text-sm text-muted-foreground'>
            El grupo padre define el alcance deportivo e histórico de la cohorte y no se modifica.
          </p>
        </div>
      ) : (
        <div className='space-y-1.5'>
          <label htmlFor='groupId' className='text-sm font-medium'>Grupo deportivo <span className='text-destructive'>*</span></label>
          <select
            id='groupId'
            name='groupId'
            required
            defaultValue={state.values?.groupId ?? ''}
            className='border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]'
          >
            <option value=''>Seleccionar grupo</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.categoryCode}{group.levelCode}{group.description ? ` · ${group.description}` : ''}
              </option>
            ))}
          </select>
          {groups.length === 0 && <p className='text-sm text-destructive'>No hay grupos activos disponibles.</p>}
        </div>
      )}

      <div className='space-y-1.5'>
        <label htmlFor='name' className='text-sm font-medium'>Nombre <span className='text-destructive'>*</span></label>
        <Input id='name' name='name' required maxLength={80} disabled={isArchived} defaultValue={state.values?.name ?? cohort?.name ?? ''} placeholder='Ej.: S2 · Short trail de primavera' />
      </div>

      <div className='space-y-1.5'>
        <label htmlFor='purpose' className='text-sm font-medium'>Objetivo compartido <span className='text-destructive'>*</span></label>
        <Input id='purpose' name='purpose' required maxLength={160} disabled={isArchived} defaultValue={state.values?.purpose ?? cohort?.purpose ?? ''} placeholder='Ej.: Preparar una carrera de 12 km con desnivel moderado' />
      </div>

      <div className='space-y-1.5'>
        <label htmlFor='description' className='text-sm font-medium'>Descripción</label>
        <textarea
          id='description'
          name='description'
          rows={4}
          maxLength={500}
          disabled={isArchived}
          defaultValue={state.values?.description ?? cohort?.description ?? ''}
          placeholder='Contexto adicional para el profesor…'
          className='border-input bg-background w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50'
        />
      </div>

      {isEditing && !isArchived && (
        <div className='space-y-1.5'>
          <label htmlFor='status' className='text-sm font-medium'>Estado</label>
          <select id='status' name='status' defaultValue={cohort.status} className='border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]'>
            <option value='active'>Activa</option>
            <option value='archived'>Archivar definitivamente</option>
          </select>
          <p className='text-xs text-muted-foreground'>Archivar conserva el historial y evita nuevas modificaciones o membresías. Esta acción no se puede revertir.</p>
        </div>
      )}

      {isArchived && (
        <p className='rounded-lg border border-dashed p-4 text-sm text-muted-foreground'>
          Esta cohorte está archivada. Sus datos permanecen disponibles como historial y no pueden editarse.
        </p>
      )}

      <div className='flex justify-end gap-2'>
        <Link href={isEditing ? `${cohortsPath}/${cohort.id}` : cohortsPath} className={buttonVariants({ variant: 'outline' })}>{isArchived ? 'Volver' : 'Cancelar'}</Link>
        {!isArchived && <Button type='submit' disabled={pending || (!isEditing && groups.length === 0)}>{pending ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear cohorte'}</Button>}
      </div>
    </form>
  )
}
