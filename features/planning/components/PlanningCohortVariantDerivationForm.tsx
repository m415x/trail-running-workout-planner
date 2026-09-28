'use client'

import Link from 'next/link'
import { useActionState, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'

import {
  derivePlanningCohortVariantAction,
  type PlanningCohortVariantDerivationFormState,
} from '@/app/actions/planning-cohort-actions'
import { Button, buttonVariants } from '@ui/button'
import { Input } from '@ui/input'

interface BasePlanOption {
  id: string
  title: string
  competitionEntries: Array<{
    id: string
    name: string
    date: string
    priority: 'A' | 'B' | 'C'
  }>
}

interface PlanningCohortVariantDerivationFormProps {
  locale: string
  cohortId: string
  cohortName: string
  groupCode: string
  basePlans: BasePlanOption[]
}

const initialState: PlanningCohortVariantDerivationFormState = {}

export function PlanningCohortVariantDerivationForm({
  locale,
  cohortId,
  cohortName,
  groupCode,
  basePlans,
}: PlanningCohortVariantDerivationFormProps) {
  const t = useTranslations('CoachPlanningAudience.planningSubgroups')
  const [state, formAction, pending] = useActionState(
    derivePlanningCohortVariantAction,
    initialState,
  )
  const [sourcePlanId, setSourcePlanId] = useState(state.values?.sourcePlanId ?? basePlans[0]?.id ?? '')
  const selectedPlan = useMemo(
    () => basePlans.find((plan) => plan.id === sourcePlanId) ?? null,
    [basePlans, sourcePlanId],
  )
  const cohortPath = locale === 'es'
    ? `/dashboard/cohorts/${cohortId}`
    : `/${locale}/dashboard/cohorts/${cohortId}`

  return (
    <form action={formAction} className='space-y-6'>
      <input type='hidden' name='cohortId' value={cohortId} />
      <input type='hidden' name='locale' value={locale} />

      {state.error && (
        <div role='alert' className='rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive'>
          {state.error}
        </div>
      )}

      <div className='grid gap-4 rounded-xl border p-4 sm:grid-cols-2'>
        <div>
          <p className='text-sm text-muted-foreground'>{t('sportingGroup')}</p>
          <p className='font-semibold'>{groupCode}</p>
        </div>
        <div>
          <p className='text-sm text-muted-foreground'>{t('planningSubgroupLabel')}</p>
          <p className='font-semibold'>{cohortName}</p>
        </div>
      </div>

      <div className='space-y-1.5'>
        <label htmlFor='sourcePlanId' className='text-sm font-medium'>{t('basePlanLabel')}</label>
        <select
          id='sourcePlanId'
          name='sourcePlanId'
          required
          value={sourcePlanId}
          onChange={(event) => setSourcePlanId(event.target.value)}
          disabled={basePlans.length === 0}
          className='h-9 w-full rounded-md border border-input bg-background px-3 text-sm'
        >
          {basePlans.length === 0 && <option value=''>{t('noBasePlans')}</option>}
          {basePlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.title}</option>)}
        </select>
        <p className='text-xs text-muted-foreground'>{t('basePlanHelp')}</p>
      </div>

      <div className='space-y-1.5'>
        <label htmlFor='title' className='text-sm font-medium'>{t('variantName')}</label>
        <Input
          id='title'
          name='title'
          required
          minLength={2}
          defaultValue={state.values?.title ?? `${cohortName} · ${t('variantDefaultSuffix')}`}
        />
      </div>

      <fieldset className='space-y-3'>
        <legend className='text-sm font-medium'>{t('competitionsToCopy')}</legend>
        <p className='text-xs text-muted-foreground'>{t('competitionsToCopyHelp')}</p>

        {selectedPlan?.competitionEntries.length ? (
          <div className='space-y-2'>
            {selectedPlan.competitionEntries.map((competition) => (
              <label key={competition.id} className='flex items-start gap-3 rounded-lg border p-3'>
                <input
                  type='checkbox'
                  name='selectedCompetitionEntryIds'
                  value={competition.id}
                  defaultChecked={state.values?.selectedCompetitionEntryIds?.includes(competition.id)}
                  className='mt-1'
                />
                <span>
                  <span className='font-medium'>{competition.name}</span>
                  <span className='block text-xs text-muted-foreground'>
                    {competition.date} · {t('priorityLabel')} {competition.priority}
                  </span>
                </span>
              </label>
            ))}
          </div>
        ) : (
          <p className='rounded-lg border border-dashed p-3 text-sm text-muted-foreground'>
            {t('noCompetitionsToCopy')}
          </p>
        )}
      </fieldset>

      <div className='rounded-lg border bg-muted/30 p-4 text-sm'>
        <p className='font-medium'>{t('reviewBeforeCreate')}</p>
        <p className='mt-1 text-muted-foreground'>{t('reviewBeforeCreateHelp')}</p>
      </div>

      <div className='flex justify-end gap-2'>
        <Link href={cohortPath} className={buttonVariants({ variant:'outline' })}>
          {t('cancel')}
        </Link>
        <Button type='submit' disabled={pending || basePlans.length === 0}>
          {pending ? t('creatingVariant') : t('createVariant')}
        </Button>
      </div>
    </form>
  )
}
