'use client'

import { useTranslations } from 'next-intl'
import type { AthleteVerticalProjection, AthleteVerticalBlock } from '@/lib/athlete-planning/effective-vertical-session'

export function AthleteVerticalPrescription({ vertical }: { vertical: AthleteVerticalProjection }) {
  const t = useTranslations('AthletePlan.session.vertical')
  const amount = (value: number | null) => value === null ? t('unknown') : t('meters', { value })
  const renderBlock = (block: AthleteVerticalBlock) => (
    <dl className='grid min-w-0 gap-1 sm:grid-cols-2'>
      <div><dt>{t('direction')}</dt><dd>{t(block.direction)}</dd></div>
      <div><dt>{t('repetitions')}</dt><dd>{block.repetitions}</dd></div>
      <div><dt>{t('coverage')}</dt><dd>{t(block.coverage)}</dd></div>
      <div><dt>{t('gainPerRep')}</dt><dd>{amount(block.elevationGainPerRep.meters)} · {t(block.elevationGainPerRep.provenance)}</dd></div>
      <div><dt>{t('lossPerRep')}</dt><dd>{amount(block.elevationLossPerRep.meters)} · {t(block.elevationLossPerRep.provenance)}</dd></div>
      <div><dt>{t('gainSubtotal')}</dt><dd>{amount(block.elevationGainTotalM)}</dd></div>
      <div><dt>{t('lossSubtotal')}</dt><dd>{amount(block.elevationLossTotalM)}</dd></div>
    </dl>
  )
  return (
    <section className='min-w-0 space-y-2 break-words rounded-lg border p-3 text-sm' aria-label={t('title')}>
      <h3 className='font-semibold'>{t('title')}</h3>
      <p>{t('effectiveGain')}: <strong>{amount(vertical.effectiveElevationGain)}</strong></p>
      {vertical.primaryObjective && <p>{t('objective')}: {t(vertical.primaryObjective)}</p>}
      <p>{t(vertical.state)}</p>
      {vertical.effectiveBlock && <div className='space-y-1'><p className='font-semibold'>{t('effectiveBlock')}</p>{renderBlock(vertical.effectiveBlock)}<p>{t(vertical.effectiveBlock.coverage === 'partial' ? 'partialHelp' : 'completeHelp')}</p></div>}
      {vertical.referenceBlock && <details className='rounded-md bg-muted p-2'><summary className='cursor-pointer font-medium'>{t('referenceOnly')}</summary><p className='my-2'>{t('referenceWarning')}</p>{renderBlock(vertical.referenceBlock)}</details>}
      {(vertical.blockStatus === 'unsupported' || vertical.blockStatus === 'corrupt') && <p>{t('unavailableBlock')}</p>}
    </section>
  )
}
