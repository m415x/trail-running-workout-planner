'use client'

import { useTranslations } from 'next-intl'
import { Input } from '@ui/input'
import { Button } from '@ui/button'
import { readVerticalBlockJson } from '@/lib/sessions/vertical-prescription-json'
import { calculateVerticalBlockTotals, type VerticalPrimaryObjective } from '@/lib/sessions/vertical-prescription'
import {
  hasHistoricalTrack, initialManualVerticalBlock, manualDraftFromBlock,
  parseManualVerticalBlock, prepareVerticalPrescriptionSubmission,
  type ManualVerticalBlockDraft, type PreviousVerticalPrescription, type VerticalPrescriptionDraft,
} from '@/lib/sessions/vertical-prescription-editor'
import { VerticalPrescriptionSummary } from './VerticalPrescriptionSummary'

interface Props {
  microcycleId: string
  previous: PreviousVerticalPrescription | null
  draft: VerticalPrescriptionDraft
  elevationGain: string
  onDraftChange: (draft: VerticalPrescriptionDraft) => void
  onElevationGainChange: (value: string) => void
}

export function VerticalPrescriptionEditor({ microcycleId, previous, draft, elevationGain, onDraftChange, onElevationGainChange }: Props) {
  const t = useTranslations('Sessions.form.prescriptions.vertical')
  const read = readVerticalBlockJson(previous?.verticalBlockJson ?? null)
  const opaque = read.status === 'unsupported' || read.status === 'corrupt'
  const historicalTrack = read.status === 'valid' && hasHistoricalTrack(read.block) && draft.block !== null
  const objective = draft.primaryObjective === undefined ? previous?.primaryObjective ?? null : draft.primaryObjective
  const active = draft.block === undefined
    ? read.status === 'valid' && !historicalTrack ? manualDraftFromBlock(read.block) : null
    : draft.block
  const prepared = prepareVerticalPrescriptionSubmission({ ...draft, previous, elevationGain })
  const prefix = 'vertical:' + microcycleId
  const id = (field: string) => prefix + ':' + field
  const errorId = id('error')
  let totals: ReturnType<typeof calculateVerticalBlockTotals> | null = null
  try {
    if (active) totals = calculateVerticalBlockTotals(parseManualVerticalBlock(active))
  } catch {
    // Invalid draft remains visible and can be corrected without coercion.
  }
  const complete = active?.coverage === 'complete'
  const effectiveGain = complete ? (totals?.elevationGainTotalM == null ? '' : String(totals.elevationGainTotalM)) : elevationGain
  const amount = (value: number | null | undefined) => value == null ? t('unknown') : t('meters', { value })

  function changeBlock(next: ManualVerticalBlockDraft | null) {
    // Preserve the last effective total when switching out of complete or
    // removing a block; changing to complete is an explicit derivation.
    if (complete && next?.coverage !== 'complete') onElevationGainChange(effectiveGain)
    onDraftChange({ ...draft, block: next })
  }

  function changeField<K extends keyof ManualVerticalBlockDraft>(field: K, value: ManualVerticalBlockDraft[K]) {
    if (active) changeBlock({ ...active, [field]: value })
  }

  const selectClass = 'border-input bg-background h-10 w-full min-w-0 rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring'
  return (
    <fieldset className='min-w-0 space-y-3 rounded-md border p-3' aria-describedby={id('help')}>
      <legend className='px-1 text-sm font-medium'>{t('title')}</legend>
      <p id={id('help')} className='text-xs text-muted-foreground'>{t('help')}</p>
      <div className='space-y-1'>
        <label htmlFor={id('objective')} className='text-sm font-medium'>{t('objective')}</label>
        <select id={id('objective')} className={selectClass} value={objective ?? ''} disabled={opaque} onChange={event => onDraftChange({ ...draft, primaryObjective: (event.target.value || null) as VerticalPrimaryObjective | null })}>
          <option value=''>{t('unspecified')}</option>
          <option value='distance'>{t('objectiveDistance')}</option>
          <option value='elevation_gain'>{t('objectiveElevation')}</option>
          <option value='duration'>{t('objectiveDuration')}</option>
        </select>
      </div>

      {opaque ? (
        <p role='status' className='rounded-md bg-muted p-3 text-sm'>{read.status === 'unsupported' ? t('unsupported') : t('corrupt')}</p>
      ) : historicalTrack ? (
        <div className='space-y-2'>
          <VerticalPrescriptionSummary primaryObjective={previous?.primaryObjective ?? null} elevationGain={previous?.elevationGain ?? null} verticalBlock={read} />
          <p role='alert' className='text-sm text-destructive'>{t('historicalTrack')}</p>
          <Button type='button' variant='outline' className='h-auto min-h-10 max-w-full whitespace-normal text-center' onClick={() => changeBlock(null)}>{t('removeHistorical')}</Button>
        </div>
      ) : active ? (
        <>
          <div className='grid min-w-0 gap-3 sm:grid-cols-2'>
            <div className='space-y-1'>
              <label htmlFor={id('direction')} className='text-sm font-medium'>{t('direction')}</label>
              <select id={id('direction')} className={selectClass} value={active.direction} onChange={e => changeField('direction', e.target.value as ManualVerticalBlockDraft['direction'])}>
                <option value='ascent'>{t('ascent')}</option>
                <option value='descent'>{t('descent')}</option>
                <option value='circuit'>{t('circuit')}</option>
              </select>
            </div>
            <div className='space-y-1'>
              <label htmlFor={id('repetitions')} className='text-sm font-medium'>{t('repetitions')}</label>
              <Input id={id('repetitions')} type='text' inputMode='numeric' value={active.repetitions} onChange={e => changeField('repetitions', e.target.value)} aria-describedby={errorId} aria-invalid={!prepared.ok && prepared.error === 'invalidBlock'} />
            </div>
            {(['gain', 'loss'] as const).map(field => (
              <div key={field} className='space-y-1'>
                <label htmlFor={id(field)} className='text-sm font-medium'>{field === 'gain' ? t('gainPerRep') : t('lossPerRep')}</label>
                <Input id={id(field)} type='text' inputMode='numeric' value={active[field]} placeholder={t('unknown')} onChange={e => changeField(field, e.target.value)} aria-describedby={id(field + 'Provenance') + ' ' + errorId} aria-invalid={!prepared.ok && prepared.error === 'invalidBlock'} />
                <p id={id(field + 'Provenance')} className='text-xs text-muted-foreground'>{t('provenance')}: {active[field] === '' ? t('unknown') : t('coachManual')}</p>
              </div>
            ))}
          </div>
          <div className='space-y-1'>
            <label htmlFor={id('coverage')} className='text-sm font-medium'>{t('coverage')}</label>
            <select id={id('coverage')} className={selectClass} value={active.coverage} onChange={e => changeField('coverage', e.target.value as ManualVerticalBlockDraft['coverage'])}>
              <option value='complete'>{t('complete')}</option>
              <option value='partial'>{t('partial')}</option>
            </select>
            <p className='text-xs text-muted-foreground'>{complete ? t('completeHelp') : t('partialHelp')}</p>
          </div>
          <dl className='grid gap-2 rounded-md bg-muted p-3 sm:grid-cols-2' aria-live='polite'>
            <div><dt className='text-xs'>{t('gainSubtotal')}</dt><dd className='font-medium'>{totals ? amount(totals.elevationGainTotalM) : t('invalidBlock')}</dd></div>
            <div><dt className='text-xs'>{t('lossSubtotal')}</dt><dd className='font-medium'>{totals ? amount(totals.elevationLossTotalM) : t('invalidBlock')}</dd></div>
          </dl>
          <Button type='button' variant='outline' className='h-auto min-h-10 max-w-full whitespace-normal text-center' onClick={() => changeBlock(null)}>{t('remove')}</Button>
        </>
      ) : read.status === 'valid' && hasHistoricalTrack(read.block) ? (
        <div className='space-y-2'>
          <p role='status' className='text-sm'>{t('historicalRemovalPending')}</p>
          <Button type='button' variant='outline' className='h-auto min-h-10 max-w-full whitespace-normal text-center' onClick={() => {
            onElevationGainChange(previous?.elevationGain == null ? '' : String(previous.elevationGain))
            onDraftChange({ ...draft, block: undefined })
          }}>{t('undoRemoval')}</Button>
        </div>
      ) : (
        <Button type='button' variant='outline' className='h-auto min-h-10 max-w-full whitespace-normal text-center' onClick={() => changeBlock(initialManualVerticalBlock())}>{t('add')}</Button>
      )}
      <div className='space-y-1'>
        <label htmlFor={id('total')} className='text-sm font-medium'>{t('wholeGain')}</label>
        <Input id={id('total')} name={'elevationGain:' + microcycleId} type='text' inputMode='numeric' readOnly={complete || opaque || historicalTrack} value={effectiveGain} placeholder={t('unknown')} onChange={e => onElevationGainChange(e.target.value)} aria-describedby={id('totalHelp') + ' ' + errorId} aria-invalid={!prepared.ok && prepared.error === 'invalidTotal'} />
        <p id={id('totalHelp')} className='text-xs text-muted-foreground'>{complete ? t('completeHelp') : active ? t('partialHelp') : t('wholeHelp')}</p>
      </div>
      <p id={errorId} className='text-sm text-destructive' aria-live='polite'>{!prepared.ok && prepared.error !== 'historicalTrack' ? t(prepared.error) : ''}</p>
      <p className='text-xs text-muted-foreground'>{t('trackUnavailable')}</p>
      <p className='text-xs text-muted-foreground'>{t('executionHelp')}</p>
    </fieldset>
  )
}
