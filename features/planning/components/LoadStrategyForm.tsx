'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

import { suggestLoadStrategy } from '@/lib/periodization/load-strategy-recommender'
import {
  validateLoadStrategy,
  type LoadStrategyValidationIssue,
} from '@/lib/periodization/load-strategy-validator'
import type {
  AthleteGroupCode,
  LoadStrategyDraft,
  LoadStrategyField,
  LoadStrategyValues,
  TrainingGoalType,
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
}

const goalTypeOptions: Array<{ value: TrainingGoalType; label: string }> = [
  { value: 'race', label: 'Preparar una carrera' },
  { value: 'performance', label: 'Mejorar rendimiento' },
  { value: 'base', label: 'Desarrollar base aeróbica' },
  { value: 'maintenance', label: 'Mantener condición' },
  { value: 'custom', label: 'Otro objetivo' },
]

export function LoadStrategyForm({ groups, locale }: LoadStrategyFormProps) {
  const [groupCode, setGroupCode] = useState<AthleteGroupCode>(groups[0].code)
  const [goalType, setGoalType] = useState<TrainingGoalType>('race')
  const initialSuggestion = useMemo(
    () => suggestLoadStrategy(groupCode, goalType),
    // Only used to initialize the editable draft. Context changes reset it explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const [strategy, setStrategy] = useState<LoadStrategyDraft>(initialSuggestion)

  const validation = useMemo(() => validateLoadStrategy(strategy), [strategy])
  const planningPath = locale === 'es' ? '/dashboard/planning' : `/${locale}/dashboard/planning`

  function resetStrategy(nextGroupCode: AthleteGroupCode, nextGoalType: TrainingGoalType) {
    setStrategy(suggestLoadStrategy(nextGroupCode, nextGoalType))
  }

  function handleGroupChange(nextGroupCode: AthleteGroupCode) {
    setGroupCode(nextGroupCode)
    resetStrategy(nextGroupCode, goalType)
  }

  function handleGoalTypeChange(nextGoalType: TrainingGoalType) {
    setGoalType(nextGoalType)
    resetStrategy(groupCode, nextGoalType)
  }

  function handleValueChange(field: LoadStrategyField, value: number | null) {
    setStrategy((current) => ({
      ...current,
      values: {
        ...current.values,
        [field]: value,
      },
      fieldSources: {
        ...current.fieldSources,
        [field]: 'manual',
      },
    }))
  }

  function issuesFor(field: LoadStrategyField) {
    return [...validation.errors, ...validation.warnings].filter((issue) => issue.field === field)
  }

  return (
    <form className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle>Contexto de la estrategia</CardTitle>
          <CardDescription>
            Elegí el grupo y el propósito general para obtener una propuesta inicial.
          </CardDescription>
        </CardHeader>
        <CardContent className='grid gap-4 sm:grid-cols-2'>
          <SelectField
            label='Grupo'
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
            label='Objetivo'
            name='goalType'
            value={goalType}
            onChange={(value) => handleGoalTypeChange(value as TrainingGoalType)}
          >
            {goalTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </SelectField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className='flex flex-wrap items-start justify-between gap-3'>
            <div>
              <CardTitle>Parámetros de carga</CardTitle>
              <CardDescription>
                Valores semanales sugeridos para {groupCode}. Podés ajustarlos antes de crear el plan.
              </CardDescription>
            </div>
            <Badge variant='secondary'>Valores sugeridos</Badge>
          </div>
        </CardHeader>
        <CardContent className='space-y-6'>
          <fieldset className='space-y-4'>
            <legend className='font-medium'>Volumen y frecuencia</legend>
            <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
              <NumberField
                label='Volumen inicial'
                name='initialWeeklyVolumeKm'
                value={strategy.values.initialWeeklyVolumeKm}
                suffix='km/semana'
                step='0.1'
                issues={issuesFor('initialWeeklyVolumeKm')}
                onChange={(value) => handleValueChange('initialWeeklyVolumeKm', value ?? 0)}
              />
              <NumberField
                label='Volumen máximo'
                name='maximumWeeklyVolumeKm'
                value={strategy.values.maximumWeeklyVolumeKm}
                suffix='km/semana'
                step='0.1'
                issues={issuesFor('maximumWeeklyVolumeKm')}
                onChange={(value) => handleValueChange('maximumWeeklyVolumeKm', value ?? 0)}
              />
              <NumberField
                label='Sesiones'
                name='sessionsPerWeek'
                value={strategy.values.sessionsPerWeek}
                suffix='por semana'
                step='1'
                issues={issuesFor('sessionsPerWeek')}
                onChange={(value) => handleValueChange('sessionsPerWeek', value ?? 0)}
              />
            </div>
          </fieldset>

          <fieldset className='space-y-4'>
            <legend className='font-medium'>Progresión</legend>
            <div className='grid gap-4 sm:grid-cols-2'>
              <NumberField
                label='Incremento semanal máximo'
                name='maximumWeeklyIncreasePercentage'
                value={strategy.values.maximumWeeklyIncreasePercentage}
                suffix='%'
                step='0.1'
                issues={issuesFor('maximumWeeklyIncreasePercentage')}
                onChange={(value) => handleValueChange('maximumWeeklyIncreasePercentage', value ?? 0)}
              />
              <NumberField
                label='Descarga'
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
              <legend className='font-medium'>Desnivel</legend>
              <p className='text-sm text-muted-foreground'>Podés dejar ambos valores vacíos para definirlos más adelante.</p>
            </div>
            <div className='grid gap-4 sm:grid-cols-2'>
              <NumberField
                label='Desnivel inicial'
                name='initialWeeklyElevationGain'
                value={strategy.values.initialWeeklyElevationGain}
                suffix='m+/semana'
                step='1'
                issues={issuesFor('initialWeeklyElevationGain')}
                onChange={(value) => handleValueChange('initialWeeklyElevationGain', value)}
              />
              <NumberField
                label='Desnivel máximo'
                name='maximumWeeklyElevationGain'
                value={strategy.values.maximumWeeklyElevationGain}
                suffix='m+/semana'
                step='1'
                issues={issuesFor('maximumWeeklyElevationGain')}
                onChange={(value) => handleValueChange('maximumWeeklyElevationGain', value)}
              />
            </div>
          </fieldset>

          {validation.warnings.length > 0 && validation.errors.length === 0 && (
            <p className='text-sm text-muted-foreground'>
              Hay {validation.warnings.length} advertencia{validation.warnings.length === 1 ? '' : 's'} metodológica{validation.warnings.length === 1 ? '' : 's'}. Podés continuar con esos valores si responden a una decisión planificada.
            </p>
          )}
        </CardContent>
      </Card>

      <div className='flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <p className='text-sm text-muted-foreground'>
          {validation.errors.length > 0
            ? `Corregí ${validation.errors.length} error${validation.errors.length === 1 ? '' : 'es'} antes de continuar.`
            : 'El guardado se habilitará al asociar esta estrategia con un plan grupal.'}
        </p>
        <div className='flex justify-end gap-2'>
          <Link href={planningPath} className={buttonVariants({ variant: 'outline' })}>Cancelar</Link>
          <Button type='button' disabled>Continuar</Button>
        </div>
      </div>
    </form>
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
              {issue.severity === 'warning' ? 'Advertencia: ' : ''}{issue.message}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
