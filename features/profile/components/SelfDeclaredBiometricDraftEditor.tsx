'use client'

import { useState } from 'react'
import { validateSelfDeclaredBiometric, validateSelfDeclaredObservedOn, type SelfDeclaredBiometricKind } from '@/lib/physiology/self-declared-biometric-validation'

/**
 * Standalone local draft preview. Not mounted in Profile until T5 has
 * authorized, real persistence. This component never submits or saves data.
 */
const fields: readonly { kind: SelfDeclaredBiometricKind; label: string; unit: string }[] = [
  { kind: 'weight', label: 'Peso', unit: 'kg' },
  { kind: 'height', label: 'Altura', unit: 'cm' },
  { kind: 'max_hr', label: 'FC máxima', unit: 'bpm' },
  { kind: 'rest_hr', label: 'FC en reposo', unit: 'bpm' },
]

export interface SelfDeclaredBiometricDraftEditorProps {
  /** Server-resolved civil day in the authorized regional context. */
  readonly today: string
  readonly draftOnly?: true
}

/** Editing controls are local-only; there is deliberately no persistence button. */
export function SelfDeclaredBiometricDraftEditor({ today, draftOnly = true }: SelfDeclaredBiometricDraftEditorProps) {
  const [values, setValues] = useState<Record<SelfDeclaredBiometricKind, string>>({
    weight: '', height: '', max_hr: '', rest_hr: '',
  })
  const [observedOn, setObservedOn] = useState('')

  return (
    <section aria-label='Borrador de biometría autodeclarada' className='space-y-3 rounded-2xl border p-4'>
      <p className='text-sm text-muted-foreground' role='status'>
        {draftOnly ? 'Borrador local. Los valores no se guardan.' : ''}
      </p>
      <div className='grid gap-3 sm:grid-cols-2'>
        {fields.map(({ kind, label, unit }) => {
          const value = values[kind]
          const checked = value === '' ? null : validateSelfDeclaredBiometric({ kind, unit, value })
          return (
            <label key={kind} className='flex flex-col gap-1 text-sm'>
              <span>{label} ({unit})</span>
              <input
                className='min-h-11 rounded-lg border bg-background px-3'
                type='text'
                inputMode={unit === 'bpm' ? 'numeric' : 'decimal'}
                value={value}
                onChange={(event) => setValues((old) => ({ ...old, [kind]: event.target.value }))}
                aria-invalid={checked?.status === 'invalid'}
              />
              {checked?.status === 'invalid' && <span className='text-xs text-destructive'>Valor fuera del rango o formato permitido.</span>}
            </label>
          )
        })}
      </div>
      <label className='flex flex-col gap-1 text-sm'>
        <span>Fecha de medición</span>
        <input className='min-h-11 rounded-lg border bg-background px-3' type='date' value={observedOn} max={today}
          onChange={(event) => setObservedOn(event.target.value)}
          aria-invalid={observedOn !== '' && !validateSelfDeclaredObservedOn({ observedOn, today })} />
        {observedOn !== '' && !validateSelfDeclaredObservedOn({ observedOn, today }) &&
          <span className='text-xs text-destructive'>Elegí una fecha dentro de los últimos 30 días, sin fechas futuras.</span>}
      </label>
    </section>
  )
}
