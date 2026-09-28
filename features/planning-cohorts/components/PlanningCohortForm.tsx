'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

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
  const t = useTranslations('CoachPlanningAudience.planningSubgroups')
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
          <p className='text-sm text-muted-foreground'>{t('sportingGroup')}</p>
          <p className='text-2xl font-semibold'>{cohort.group.categoryCode}{cohort.group.levelCode}</p>
          <p className='mt-1 text-sm text-muted-foreground'>{t('formSportingGroupHelp')}</p>
        </div>
      ) : (
        <div className='space-y-1.5'>
          <label htmlFor='groupId' className='text-sm font-medium'>
            {t('sportingGroup')} <span className='text-destructive'>*</span>
          </label>
          <select
            id='groupId'
            name='groupId'
            required
            defaultValue={state.values?.groupId ?? ''}
            className='border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]'
          >
            <option value=''>{t('selectSportingGroup')}</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.categoryCode}{group.levelCode}{group.description ? ` · ${group.description}` : ''}
              </option>
            ))}
          </select>
          {groups.length === 0 && <p className='text-sm text-destructive'>{t('noActiveSportingGroups')}</p>}
        </div>
      )}

      <div className='space-y-1.5'>
        <label htmlFor='name' className='text-sm font-medium'>
          {t('name')} <span className='text-destructive'>*</span>
        </label>
        <Input
          id='name'
          name='name'
          required
          maxLength={80}
          disabled={isArchived}
          defaultValue={state.values?.name ?? cohort?.name ?? ''}
          placeholder={t('namePlaceholder')}
        />
      </div>

      <div className='space-y-1.5'>
        <label htmlFor='purpose' className='text-sm font-medium'>
          {t('sharedGoal')} <span className='text-destructive'>*</span>
        </label>
        <Input
          id='purpose'
          name='purpose'
          required
          maxLength={160}
          disabled={isArchived}
          defaultValue={state.values?.purpose ?? cohort?.purpose ?? ''}
          placeholder={t('sharedGoalPlaceholder')}
        />
      </div>

      <div className='space-y-1.5'>
        <label htmlFor='description' className='text-sm font-medium'>{t('formDescription')}</label>
        <textarea
          id='description'
          name='description'
          rows={4}
          maxLength={500}
          disabled={isArchived}
          defaultValue={state.values?.description ?? cohort?.description ?? ''}
          placeholder={t('formDescriptionPlaceholder')}
          className='border-input bg-background w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50'
        />
      </div>

      {isEditing && !isArchived && (
        <div className='space-y-1.5'>
          <label htmlFor='status' className='text-sm font-medium'>{t('formStatus')}</label>
          <select id='status' name='status' defaultValue={cohort.status} className='border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]'>
            <option value='active'>{t('active')}</option>
            <option value='archived'>{t('archivePermanently')}</option>
          </select>
          <p className='text-xs text-muted-foreground'>{t('archiveHelp')}</p>
        </div>
      )}

      {isArchived && (
        <p className='rounded-lg border border-dashed p-4 text-sm text-muted-foreground'>
          {t('archivedHelp')}
        </p>
      )}

      <div className='flex justify-end gap-2'>
        <Link href={isEditing ? `${cohortsPath}/${cohort.id}` : cohortsPath} className={buttonVariants({ variant: 'outline' })}>
          {isArchived ? t('backButton') : t('cancel')}
        </Link>
        {!isArchived && (
          <Button type='submit' disabled={pending || (!isEditing && groups.length === 0)}>
            {pending ? t('saving') : isEditing ? t('saveChanges') : t('create')}
          </Button>
        )}
      </div>
    </form>
  )
}
