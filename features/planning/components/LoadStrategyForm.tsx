'use client'

import Link from 'next/link'
import { PlanningIntentHelp } from '@/features/planning/components/PlanningIntentHelp'
import { localizeLoadIssue } from '@/features/planning/load-strategy-copy'
import { useActionState, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'

import {
  createGroupPlanWithLoadStrategy,
  type CreateGroupPlanWithLoadStrategyState,
} from '@/app/actions/load-strategy-actions'
import { getLoadStrategyModifications } from '@/lib/periodization/load-strategy-modifications'
import { suggestLoadStrategy } from '@/lib/periodization/load-strategy-recommender'
import { validateMacrocycleHorizon } from '@/lib/periodization/macrocycle-horizon'
import { resolveBasePlanLegacyGoalType } from '@/lib/periodization/planning-intent'
import {
  validateLoadStrategy,
  type LoadStrategyValidationIssue,
} from '@/lib/periodization/load-strategy-validator'
import type {
  AthleteGroupCode,
  LoadStrategyDraft,
  LoadStrategyField,
  PlanningIntent,
} from '@/types'
import { Badge } from '@ui/badge'
import { Button, buttonVariants } from '@ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/card'
import { Input } from '@ui/input'

interface LoadStrategyGroupOption {
  id: string
  code: AthleteGroupCode
  description: string | null
}

interface LoadStrategyFormProps {
  groups: LoadStrategyGroupOption[]
  locale: string
  defaultStartDate: string
  defaultEndDate: string
}

const planningIntentOptions: PlanningIntent[] = ['development', 'base', 'maintenance']

const initialActionState: CreateGroupPlanWithLoadStrategyState = {}

export function LoadStrategyForm({
  groups,
  locale,
  defaultStartDate,
  defaultEndDate,
}: LoadStrategyFormProps) {
  const t = useTranslations('BasePlanning')
  const [groupCode, setGroupCode] = useState<AthleteGroupCode>(groups[0].code)
  const [planningIntent, setPlanningIntent] = useState<PlanningIntent>('development')
  const suggestion = useMemo(
    () => suggestLoadStrategy(groupCode, resolveBasePlanLegacyGoalType(planningIntent)),
    [groupCode, planningIntent],
  )
  const [strategy, setStrategy] = useState<LoadStrategyDraft>(() => suggestion)
  const [startDate, setStartDate] = useState(defaultStartDate)
  const [endDate, setEndDate] = useState(defaultEndDate)
  const [actionState, formAction, isPending] = useActionState(
    createGroupPlanWithLoadStrategy,
    initialActionState,
  )

  const validation = useMemo(() => validateLoadStrategy(strategy), [strategy])
  const horizonValidation = useMemo(
    () => validateMacrocycleHorizon({ startDate, endDate }),
    [startDate, endDate],
  )
  const isCustomized = useMemo(
    () => getLoadStrategyModifications(suggestion.values, strategy.values).length > 0,
    [strategy.values, suggestion.values],
  )
  const selectedGroup = groups.find((group) => group.code === groupCode) ?? groups[0]
  const planningPath = locale === 'es' ? '/dashboard/planning' : `/${locale}/dashboard/planning`

  function resetStrategy(nextGroupCode: AthleteGroupCode, nextPlanningIntent: PlanningIntent) {
    setStrategy(suggestLoadStrategy(
      nextGroupCode,
      resolveBasePlanLegacyGoalType(nextPlanningIntent),
    ))
  }

  function handleGroupChange(nextGroupCode: AthleteGroupCode) {
    setGroupCode(nextGroupCode)
    resetStrategy(nextGroupCode, planningIntent)
  }

  function handlePlanningIntentChange(nextPlanningIntent: PlanningIntent) {
    setPlanningIntent(nextPlanningIntent)
    resetStrategy(groupCode, nextPlanningIntent)
  }

  function handleValueChange(field: LoadStrategyField, value: number | null) {
    setStrategy((current) => ({
      ...current,
      values: {
        ...current.values,
        [field]: value,
      },
    }))
  }

  function issuesFor(field: LoadStrategyField) {
    return [...validation.errors, ...validation.warnings]
      .filter((issue) => issue.field === field)
      .map((issue) => ({ ...issue, message: localizeLoadIssue(issue, strategy, t) }))
  }

  return (
    <form action={formAction} className='space-y-6'>
      <input type='hidden' name='groupId' value={selectedGroup.id} />
      <input type='hidden' name='locale' value={locale} />
      <input type='hidden' name='values' value={JSON.stringify(strategy.values)} />

      <Card>
        <CardHeader>
          <CardTitle>{t('contextTitle')}</CardTitle>
          <CardDescription>{t('contextDescription')}</CardDescription>
        </CardHeader>
        <CardContent className='space-y-3'>
          <div className='grid gap-4 sm:grid-cols-2'>
            <SelectField
              label={t('group')}
              name='groupCode'
              value={groupCode}
              onChange={(value) => handleGroupChange(value as AthleteGroupCode)}
            >
              {groups.map((group) => (
                <option key={group.id} value={group.code}>
                  {group.code}{group.description ? ` · ${group.description}` : ''}
                </option>
              ))}
            </SelectField>

            <SelectField
              label={t('planningIntent')}
              name='planningIntent'
              value={planningIntent}
              onChange={(value) => handlePlanningIntentChange(value as PlanningIntent)}
            >
              {planningIntentOptions.map((option) => (
                <option key={option} value={option}>{t(`intents.${option}`)}</option>
              ))}
            </SelectField>
          </div>
          <p className='text-sm text-muted-foreground'>{t('competitionNeutral')}</p>
          <PlanningIntentHelp />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('horizonTitle')}</CardTitle>
          <CardDescription>
            {t('horizonDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-3'>
          <div className='grid gap-4 sm:grid-cols-2'>
            <DateField
              label={t('startDate')}
              name='startDate'
              value={startDate}
              onChange={setStartDate}
            />
            <DateField
              label={t('endDate')}
              name='endDate'
              value={endDate}
              min={startDate}
              onChange={setEndDate}
            />
          </div>
          <p
            className={horizonValidation.isValid ? 'text-sm text-muted-foreground' : 'text-sm text-destructive'}
            role={horizonValidation.isValid ? undefined : 'alert'}
          >
            {horizonValidation.isValid
              ? t('duration', { weeks: horizonValidation.durationWeeks ?? 0, days: horizonValidation.durationDays ?? 0 })
              : t('horizonInvalid')}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className='flex flex-wrap items-start justify-between gap-3'>
            <div>
              <CardTitle>{t('loadTitle')}</CardTitle>
              <CardDescription>
                {t('loadDescription', { group: groupCode })}
              </CardDescription>
            </div>
            <Badge variant={isCustomized ? 'outline' : 'secondary'}>
              {isCustomized ? t('customized') : t('suggested')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className='space-y-6'>
          <fieldset className='space-y-4'>
            <legend className='font-medium'>{t('volume')}</legend>
            <div className='grid gap-4 sm:grid-cols-2'>
              <NumberField
                label={t('initialVolume')}
                name='initialWeeklyVolumeKm'
                value={strategy.values.initialWeeklyVolumeKm}
                suffix={t('kmPerWeek')}
                step='0.1'
                issues={issuesFor('initialWeeklyVolumeKm')}
                onChange={(value) => handleValueChange('initialWeeklyVolumeKm', value ?? 0)}
              />
              <NumberField
                label={t('maximumVolume')}
                name='maximumWeeklyVolumeKm'
                value={strategy.values.maximumWeeklyVolumeKm}
                suffix={t('kmPerWeek')}
                step='0.1'
                issues={issuesFor('maximumWeeklyVolumeKm')}
                onChange={(value) => handleValueChange('maximumWeeklyVolumeKm', value ?? 0)}
              />
            </div>
          </fieldset>

          <fieldset className='space-y-4'>
            <legend className='font-medium'>{t('progression')}</legend>
            <div className='grid gap-4 sm:grid-cols-2'>
              <NumberField
                label={t('increase')}
                name='maximumWeeklyIncreasePercentage'
                value={strategy.values.maximumWeeklyIncreasePercentage}
                suffix='%'
                step='0.1'
                issues={issuesFor('maximumWeeklyIncreasePercentage')}
                onChange={(value) => handleValueChange('maximumWeeklyIncreasePercentage', value ?? 0)}
              />
              <NumberField
                label={t('deload')}
                name='deloadPercentage'
                value={strategy.values.deloadPercentage}
                suffix='%'
                step='0.1'
                issues={issuesFor('deloadPercentage')}
                onChange={(value) => handleValueChange('deloadPercentage', value ?? 0)}
              />
            </div>
          </fieldset>

          <fieldset className='space-y-4'>
            <div>
              <legend className='font-medium'>{t('elevation')}</legend>
              <p className='text-sm text-muted-foreground'>{t('elevationOptional')}</p>
            </div>
            <div className='grid gap-4 sm:grid-cols-2'>
              <NumberField
                label={t('initialElevation')}
                name='initialWeeklyElevationGain'
                value={strategy.values.initialWeeklyElevationGain}
                suffix={t('metersPerWeek')}
                step='1'
                issues={issuesFor('initialWeeklyElevationGain')}
                onChange={(value) => handleValueChange('initialWeeklyElevationGain', value)}
              />
              <NumberField
                label={t('maximumElevation')}
                name='maximumWeeklyElevationGain'
                value={strategy.values.maximumWeeklyElevationGain}
                suffix={t('metersPerWeek')}
                step='1'
                issues={issuesFor('maximumWeeklyElevationGain')}
                onChange={(value) => handleValueChange('maximumWeeklyElevationGain', value)}
              />
            </div>
          </fieldset>

          {validation.warnings.length > 0 && validation.errors.length === 0 && (
            <p className='text-sm text-muted-foreground'>
              {t('warnings', { count: validation.warnings.length })}
            </p>
          )}
        </CardContent>
      </Card>

      <div className='flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <div className='space-y-1'>
          <p className='text-sm text-muted-foreground'>
            {validation.errors.length > 0
              ? t('errors', { count: validation.errors.length })
              : t('draftNotice')}
          </p>
          {actionState.error && (
            <p className='text-sm text-destructive' role='alert'>{actionState.error}</p>
          )}
        </div>
        <div className='flex justify-end gap-2'>
          <Link href={planningPath} className={buttonVariants({ variant: 'outline' })}>{t('cancel')}</Link>
          <Button type='submit' disabled={!validation.isValid || !horizonValidation.isValid || isPending}>
            {isPending ? t('creating') : t('create')}
          </Button>
        </div>
      </div>
    </form>
  )
}

interface DateFieldProps {
  label: string
  name: string
  value: string
  min?: string
  onChange: (value: string) => void
}

function DateField({ label, name, value, min, onChange }: DateFieldProps) {
  return (
    <div className='space-y-1.5'>
      <label htmlFor={name} className='text-sm font-medium'>{label}</label>
      <Input
        id={name}
        name={name}
        type='date'
        value={value}
        min={min}
        required
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

interface SelectFieldProps {
  label: string
  name: string
  value: string
  onChange: (value: string) => void
  children: React.ReactNode
}

function SelectField({ label, name, value, onChange, children }: SelectFieldProps) {
  return (
    <div className='space-y-1.5'>
      <label htmlFor={name} className='text-sm font-medium'>{label}</label>
      <select
        id={name}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className='border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]'
      >
        {children}
      </select>
    </div>
  )
}

interface NumberFieldProps {
  label: string
  name: string
  value: number | null
  suffix: string
  step: string
  issues: LoadStrategyValidationIssue[]
  onChange: (value: number | null) => void
}

function NumberField({ label, name, value, suffix, step, issues, onChange }: NumberFieldProps) {
  const t = useTranslations('BasePlanning')
  const hasError = issues.some((issue) => issue.severity === 'error')

  return (
    <div className='space-y-1.5'>
      <label htmlFor={name} className='text-sm font-medium'>{label}</label>
      <div className='relative'>
        <Input
          id={name}
          name={name}
          type='number'
          min='0'
          step={step}
          value={value ?? ''}
          aria-invalid={hasError}
          aria-describedby={issues.length > 0 ? `${name}-feedback` : undefined}
          onChange={(event) => {
            const nextValue = event.target.value
            onChange(nextValue === '' ? null : Number(nextValue))
          }}
          className='pr-24'
        />
        <span className='pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground'>
          {suffix}
        </span>
      </div>
      {issues.length > 0 && (
        <div id={`${name}-feedback`} className='space-y-1 text-xs'>
          {issues.map((issue) => (
            <p
              key={issue.code}
              className={issue.severity === 'error' ? 'text-destructive' : 'text-muted-foreground'}
            >
              {issue.severity === 'warning' ? t('warning', { message: issue.message }) : issue.message}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
