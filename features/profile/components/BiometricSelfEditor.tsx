'use client'

import { useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import {
  createCurrentSelfBiometricAction,
  correctCurrentSelfBiometricAction,
} from '@/app/actions/biometric-self-actions'

type Reading = {
  id: string
  valueScaled: number
  observedOn: string
  recordedAt: string
  observedTimeZone: string | null
} | null
export type BiometricSelfState = {
  effectiveOn: string
  biometrics: {
    weight: Reading
    height: Reading
    maxHr: Reading
    restHr: Reading
  }
}
type Kind = 'weight' | 'height' | 'max_hr' | 'rest_hr'
const parameters: { kind: Kind; key: keyof BiometricSelfState['biometrics']; unit: string; scale: number; es: string; en: string }[] = [
  { kind: 'weight', key: 'weight', unit: 'kg', scale: 10, es: 'Peso', en: 'Weight' },
  { kind: 'height', key: 'height', unit: 'cm', scale: 10, es: 'Altura', en: 'Height' },
  { kind: 'max_hr', key: 'maxHr', unit: 'bpm', scale: 1, es: 'FC máxima', en: 'Maximum heart rate' },
  { kind: 'rest_hr', key: 'restHr', unit: 'bpm', scale: 1, es: 'FC en reposo', en: 'Resting heart rate' },
]

export function BiometricSelfEditor({ biometrics }: { biometrics: BiometricSelfState }) {
  const en = useLocale() === 'en'
  const router = useRouter()
  const pendingOperationKeys = useRef<Record<string, { fingerprint: string; key: string }>>({})
  const [working, setWorking] = useState<Kind | null>(null)
  const [feedback, setFeedback] = useState<Record<string, string>>({})
  const [drafts, setDrafts] = useState<Record<string, { value: string; observedOn: string }>>({})

  return (
    <section aria-label={en ? 'My biometric measurements' : 'Mis mediciones biométricas'} className="space-y-4">
      <h3 className="font-semibold">{en ? 'My measurements' : 'Mis mediciones'}</h3>
      <p className="text-sm text-muted-foreground">{en ? 'Self-declared values. Calculated metrics cannot be edited.' : 'Valores declarados por vos. Las métricas calculadas no pueden editarse.'}</p>
      <div className="grid gap-4 md:grid-cols-2">
        {parameters.map(parameter => {
          const current = biometrics.biometrics[parameter.key]
          const draft = drafts[parameter.kind] ?? {
            value: current ? String(current.valueScaled / parameter.scale) : '',
            observedOn: biometrics.effectiveOn,
          }
          return (
            <form key={parameter.kind} className="space-y-2 rounded-xl border p-4" onSubmit={async event => {
              event.preventDefault()
              if (working) return
              setWorking(parameter.kind)
              setFeedback(previous => ({ ...previous, [parameter.kind]: '' }))
              // Reuse a key for a transport retry of the identical mutation.
              // A changed measurement, date or correction target is a new operation.
              const fingerprint = JSON.stringify([
                parameter.kind, parameter.unit, draft.value, draft.observedOn, current?.id ?? null,
              ])
              const previous = pendingOperationKeys.current[parameter.kind]
              if (!previous || previous.fingerprint !== fingerprint) {
                pendingOperationKeys.current[parameter.kind] = {
                  fingerprint, key: crypto.randomUUID(),
                }
              }
              const payload = {
                kind: parameter.kind,
                unit: parameter.unit,
                value: draft.value,
                observedOn: draft.observedOn,
                operationKey: pendingOperationKeys.current[parameter.kind].key,
              }
              try {
                const result = current
                  ? await correctCurrentSelfBiometricAction({
                      ...payload,
                      supersedesObservationId: current.id,
                      correctionReason: 'Athlete correction',
                    })
                  : await createCurrentSelfBiometricAction(payload)
                setFeedback(previous => ({
                  ...previous,
                  [parameter.kind]: result.status === 'persisted'
                    ? (en ? 'Saved' : 'Guardado')
                    : result.status === 'invalid'
                      ? (en ? 'Invalid measurement or date' : 'Medición o fecha inválida')
                      : result.status === 'conflict'
                        ? (en ? 'Conflicting change. Refresh and try again.' : 'Conflicto. Actualizá e intentá nuevamente.')
                        : (en ? 'Not authorized to save' : 'No autorizado para guardar'),
                }))
                if (result.status === 'persisted') {
                  delete pendingOperationKeys.current[parameter.kind]
                  router.refresh()
                }
              } catch {
                setFeedback(previous => ({ ...previous, [parameter.kind]: en ? 'Could not save' : 'No se pudo guardar' }))
              } finally {
                setWorking(null)
              }
            }}>
              <h4 className="font-medium">{en ? parameter.en : parameter.es}</h4>
              <label className="block text-sm" htmlFor={'bio-value-' + parameter.kind}>{en ? 'Value' : 'Valor'} ({parameter.unit})</label>
              <input id={'bio-value-' + parameter.kind} className="w-full rounded-md border bg-background p-2" inputMode="decimal" required value={draft.value} onChange={event =>
                setDrafts(previous => ({ ...previous, [parameter.kind]: { ...draft, value: event.target.value } }))
              }/>
              <label className="block text-sm" htmlFor={'bio-date-' + parameter.kind}>{en ? 'Measurement date' : 'Fecha de medición'}</label>
              <input id={'bio-date-' + parameter.kind} type="date" required max={biometrics.effectiveOn} className="w-full rounded-md border bg-background p-2" value={draft.observedOn} onChange={event =>
                setDrafts(previous => ({ ...previous, [parameter.kind]: { ...draft, observedOn: event.target.value } }))
              }/>
              {current && <p className="text-xs text-muted-foreground">
                {en ? 'Recorded' : 'Registrado'}: {current.observedOn} · {en ? 'Source: self-declared' : 'Fuente: declaración propia'}
                {current.observedTimeZone ? ' · ' + current.observedTimeZone : ''}
              </p>}
              <button className="rounded-md border px-4 py-2 disabled:opacity-50" disabled={working !== null} type="submit">
                {working === parameter.kind ? (en ? 'Saving…' : 'Guardando…') : current ? (en ? 'Correct' : 'Corregir') : (en ? 'Save' : 'Guardar')}
              </button>
              {feedback[parameter.kind] && <p role="status" className="text-sm">{feedback[parameter.kind]}</p>}
            </form>
          )
        })}
      </div>
    </section>
  )
}
