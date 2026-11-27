import { useTranslations } from 'next-intl'
import { calculateVerticalBlockTotals, type VerticalPrimaryObjective } from '@/lib/sessions/vertical-prescription'
import type { VerticalBlockJsonReadResult } from '@/lib/sessions/vertical-prescription-json'

interface Props {
  primaryObjective: VerticalPrimaryObjective | null
  elevationGain: number | null
  verticalBlock: VerticalBlockJsonReadResult
}

export function VerticalPrescriptionSummary({ primaryObjective, elevationGain, verticalBlock }: Props) {
  const t = useTranslations('Sessions.form.prescriptions.vertical')
  const amount = (value: number | null) => value === null ? t('unknown') : t('meters', { value })
  const objective = primaryObjective === 'distance' ? t('objectiveDistance')
    : primaryObjective === 'elevation_gain' ? t('objectiveElevation')
    : primaryObjective === 'duration' ? t('objectiveDuration') : t('unspecified')
  const block = verticalBlock.status === 'valid' ? verticalBlock.block : null
  const totals = block ? calculateVerticalBlockTotals(block) : null
  return (
    <div className='space-y-2 text-sm'>
      <dl className='grid min-w-0 gap-2 sm:grid-cols-2'>
        <div><dt className='text-muted-foreground'>{t('objective')}</dt><dd>{objective}</dd></div>
        <div><dt className='text-muted-foreground'>{t('wholeGain')}</dt><dd>{amount(elevationGain)}</dd></div>
        {block && totals && (
          <>
            <div><dt className='text-muted-foreground'>{t('direction')}</dt><dd>{t(block.direction)}</dd></div>
            <div><dt className='text-muted-foreground'>{t('repetitions')}</dt><dd>{block.repetitions}</dd></div>
            <div><dt className='text-muted-foreground'>{t('coverage')}</dt><dd>{t(block.coverage)}</dd></div>
            {([['gainPerRep', block.elevationGainPerRep], ['lossPerRep', block.elevationLossPerRep]] as const).map(([key, metric]) => (
              <div key={key}>
                <dt className='text-muted-foreground'>{t(key)}</dt>
                <dd>{amount(metric.meters)} · {t(metric.provenance.kind === 'coach_manual' ? 'coachManual' : metric.provenance.kind === 'track_adopted' ? 'trackAdopted' : 'unknown')}{metric.provenance.kind === 'track_adopted' && <span className='block break-all text-xs text-muted-foreground'>{t('trackReference')}: {metric.provenance.trackReference}</span>}</dd>
              </div>
            ))}
            <div><dt className='text-muted-foreground'>{t('gainSubtotal')}</dt><dd>{amount(totals.elevationGainTotalM)}</dd></div>
            <div><dt className='text-muted-foreground'>{t('lossSubtotal')}</dt><dd>{amount(totals.elevationLossTotalM)}</dd></div>
          </>
        )}
      </dl>
      {verticalBlock.status === 'absent' && <p className='text-muted-foreground'>{t('noBlock')}</p>}
      {verticalBlock.status === 'unsupported' && <p>{t('unsupported')}</p>}
      {verticalBlock.status === 'corrupt' && <p>{t('corrupt')}</p>}
      {block && <p className='text-xs text-muted-foreground'>{block.coverage === 'complete' ? t('completeHelp') : t('partialHelp')}</p>}
    </div>
  )
}
