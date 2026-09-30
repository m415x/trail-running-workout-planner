import {
  GENERATION_EXPLANATION_STAGE_ORDER,
  type GenerationExplanation,
  type GenerationExplanationFact,
  type GenerationExplanationStageEvidence,
} from '@/lib/session-generation/generation-explanation'

interface GenerationExplanationViewProps {
  generationExplanation: GenerationExplanation
  locale: string
}

export function GenerationExplanationView({
  generationExplanation,
  locale,
}: GenerationExplanationViewProps) {
  return (
    <div className='space-y-3'>
      {GENERATION_EXPLANATION_STAGE_ORDER.map((stage) => {
        const evidence = generationExplanation.stages.find(
          (candidate) => candidate.stage === stage,
        )
        return evidence ? (
          <GenerationExplanationStageView
            key={stage}
            evidence={evidence}
            locale={locale}
          />
        ) : null
      })}
    </div>
  )
}

function GenerationExplanationStageView({
  evidence,
  locale,
}: {
  evidence: GenerationExplanationStageEvidence
  locale: string
}) {
  const labels = locale === 'en'
    ? {
        inputs: 'Inputs',
        constraints: 'Constraints',
        decision: 'Decision',
        consequence: 'Consequence',
        warnings: 'Warnings',
      }
    : {
        inputs: 'Entradas',
        constraints: 'Restricciones',
        decision: 'Decisión',
        consequence: 'Consecuencia',
        warnings: 'Avisos',
      }

  const sections = [
    { label: labels.inputs, facts: evidence.inputs },
    { label: labels.constraints, facts: evidence.constraints },
    { label: labels.decision, facts: evidence.decision },
    { label: labels.consequence, facts: evidence.consequence },
  ]

  return (
    <section className='space-y-2'>
      <p className='font-medium'>{formatStageLabel(evidence.stage, locale)}</p>
      <div className='grid gap-2 md:grid-cols-2'>
        {sections.map(({ label, facts }) => (
          <div key={label}>
            <p className='text-xs font-medium text-muted-foreground'>{label}</p>
            <FactList facts={facts} />
          </div>
        ))}
      </div>

      {evidence.warnings.length > 0 && (
        <div>
          <p className='text-xs font-medium text-destructive'>{labels.warnings}</p>
          <ul className='space-y-1 text-xs text-destructive'>
            {evidence.warnings.map((warning, index) => (
              <li key={`${warning.code}-${index}`}>
                <span className='font-medium'>{warning.code}</span>
                {warning.facts.length > 0 && (
                  <ul className='ml-4 mt-1 space-y-1 text-muted-foreground'>
                    {warning.facts.map((fact, factIndex) => (
                      <li key={`${fact.code}-${factIndex}`}>
                        {formatFact(fact)}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function FactList({ facts }: { facts: GenerationExplanationFact[] }) {
  return facts.length === 0 ? (
    <p className='text-xs text-muted-foreground'>—</p>
  ) : (
    <ul className='space-y-1 text-xs text-muted-foreground'>
      {facts.map((fact, index) => (
        <li key={`${fact.code}-${index}`}>{formatFact(fact)}</li>
      ))}
    </ul>
  )
}

function formatFact(fact: GenerationExplanationFact) {
  return `${fact.code}: ${String(fact.value ?? '—')}`
}

function formatStageLabel(
  stage: GenerationExplanationStageEvidence['stage'],
  locale: string,
) {
  const labels = {
    weekly_budget: locale === 'en' ? 'Weekly budget' : 'Presupuesto semanal',
    frequency: locale === 'en' ? 'Frequency' : 'Frecuencia',
    slots: locale === 'en' ? 'Slots' : 'Días y roles',
    stimulus_template: locale === 'en' ? 'Stimulus and template' : 'Estímulo y plantilla',
    fixed_load: locale === 'en' ? 'Fixed load' : 'Carga fija',
    remaining_budget: locale === 'en' ? 'Remaining budget' : 'Presupuesto restante',
    flexible_allocation: locale === 'en' ? 'Flexible allocation' : 'Distribución flexible',
    intensity: locale === 'en' ? 'Intensity' : 'Intensidad',
    coordination_reconciliation: locale === 'en'
      ? 'Coordination and reconciliation'
      : 'Coordinación y reconciliación',
  }

  return labels[stage]
}
