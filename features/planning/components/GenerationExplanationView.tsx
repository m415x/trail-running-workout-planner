import { useTranslations } from 'next-intl'
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
  const t = useTranslations('CoachPlanning')

  return (
    <div className='space-y-3' aria-label={t('generationExplanation')}>
      {GENERATION_EXPLANATION_STAGE_ORDER.map((stage) => {
        const evidence = generationExplanation.stages.find(
          (candidate) => candidate.stage === stage,
        )
        return evidence ? (
          <GenerationExplanationStageView
            key={stage}
            evidence={evidence}
            locale={locale}
            planningSubgroupLabel={t('planningSubgroup')}
          />
        ) : null
      })}
    </div>
  )
}

function GenerationExplanationStageView({
  evidence,
  locale,
  planningSubgroupLabel,
}: {
  evidence: GenerationExplanationStageEvidence
  locale: string
  planningSubgroupLabel: string
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
            <FactList facts={facts} locale={locale} planningSubgroupLabel={planningSubgroupLabel} />
          </div>
        ))}
      </div>

      {evidence.warnings.length > 0 && (
        <div>
          <p className='text-xs font-medium text-destructive'>{labels.warnings}</p>
          <ul className='space-y-1 text-xs text-destructive'>
            {evidence.warnings.map((warning, index) => (
              <li key={`${warning.code}-${index}`}>
                <span className='font-medium'>
                  {formatGenerationExplanationWarning(warning.code, locale)}
                </span>
                {warning.facts.length > 0 && (
                  <ul className='ml-4 mt-1 space-y-1 text-muted-foreground'>
                    {warning.facts.map((fact, factIndex) => (
                      <li key={`${fact.code}-${factIndex}`}>
                        {formatFact(fact, locale, planningSubgroupLabel)}
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

function FactList({
  facts,
  locale,
  planningSubgroupLabel,
}: {
  facts: GenerationExplanationFact[]
  locale: string
  planningSubgroupLabel: string
}) {
  return facts.length === 0 ? (
    <p className='text-xs text-muted-foreground'>—</p>
  ) : (
    <ul className='space-y-1 text-xs text-muted-foreground'>
      {facts.map((fact, index) => (
        <li key={`${fact.code}-${index}`}>{formatFact(fact, locale, planningSubgroupLabel)}</li>
      ))}
    </ul>
  )
}

function formatFact(
  fact: GenerationExplanationFact,
  locale: string,
  planningSubgroupLabel: string,
) {
  return `${formatGenerationExplanationLabel(fact.code, locale, planningSubgroupLabel)}: ${String(fact.value ?? '—')}`
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


function formatGenerationExplanationLabel(
  code: string,
  locale: string,
  planningSubgroupLabel: string,
) {
  const labels: Record<string, { es: string; en: string }> = {
    target_volume_km: { es: 'Volumen objetivo', en: 'Target volume' },
    target_elevation_gain: { es: 'Desnivel objetivo', en: 'Target elevation gain' },
    maximum_weekly_volume_km: { es: 'Volumen semanal máximo', en: 'Maximum weekly volume' },
    frequency_mode: { es: 'Modo de frecuencia', en: 'Frequency mode' },
    fixed_sessions_per_week: { es: 'Sesiones semanales fijas', en: 'Fixed weekly sessions' },
    selected_session_count: { es: 'Sesiones seleccionadas', en: 'Selected sessions' },
    habitual_slot_keys: { es: 'Días habituales', en: 'Habitual days' },
    selected_habitual_slot_keys: { es: 'Días habituales mantenidos', en: 'Habitual days kept' },
    omitted_habitual_slot_keys: { es: 'Días habituales omitidos', en: 'Omitted habitual days' },
    selected_fallback_slot_keys: { es: 'Días alternativos usados', en: 'Fallback days used' },
    selected_slot_keys: { es: 'Días seleccionados', en: 'Selected days' },
    unconstrained_slot_keys: { es: 'Distribución sin restricciones', en: 'Unconstrained distribution' },
    selected_roles: { es: 'Roles seleccionados', en: 'Selected roles' },
    recovery_constraint_changed_selection: {
      es: 'La recuperación modificó la distribución',
      en: 'Recovery changed the distribution',
    },
    race_replaced_habitual_slot: {
      es: 'La competencia reemplazó un día habitual',
      en: 'Race replaced a habitual day',
    },
    selected_template: { es: 'Plantilla seleccionada', en: 'Selected template' },
    template_material_factors: { es: 'Factores de selección', en: 'Selection factors' },
    fixed_slot_load: { es: 'Carga fija por circuito', en: 'Fixed circuit load' },
    fixed_volume_km: { es: 'Volumen fijo', en: 'Fixed volume' },
    fixed_elevation_gain: { es: 'Desnivel fijo', en: 'Fixed elevation gain' },
    remaining_volume_km: { es: 'Volumen restante', en: 'Remaining volume' },
    remaining_elevation_gain: { es: 'Desnivel restante', en: 'Remaining elevation gain' },
    flexible_volume_allocation: { es: 'Distribución flexible de volumen', en: 'Flexible volume allocation' },
    flexible_elevation_allocation: { es: 'Distribución flexible de desnivel', en: 'Flexible elevation allocation' },
    default_method: { es: 'Método de intensidad previsto', en: 'Planned intensity method' },
    effective_method: { es: 'Método de intensidad aplicado', en: 'Applied intensity method' },
    emphasis: { es: 'Énfasis semanal', en: 'Weekly emphasis' },
    predominant_zone: { es: 'Zona predominante', en: 'Predominant zone' },
    reference_percentage_target: { es: 'Porcentaje de referencia objetivo', en: 'Reference percentage target' },
    intense_sessions_target: { es: 'Sesiones intensas objetivo', en: 'Target intense sessions' },
    assigned_intense_sessions: { es: 'Sesiones intensas ubicadas', en: 'Assigned intense sessions' },
    minimum_recovery_days: { es: 'Días mínimos de recuperación', en: 'Minimum recovery days' },
    training_slot_keys: { es: 'Sesiones de entrenamiento', en: 'Training sessions' },
    slot_intensity: { es: 'Intensidad por sesión', en: 'Intensity by session' },
    competition_present: { es: 'Competencia presente', en: 'Race present' },
    race_name: { es: 'Competencia', en: 'Race' },
    race_date: { es: 'Fecha de competencia', en: 'Race date' },
    race_distance_km: { es: 'Distancia de competencia', en: 'Race distance' },
    race_elevation_gain: { es: 'Desnivel de competencia', en: 'Race elevation gain' },
    race_load_separate_from_training_budget: {
      es: 'Carga de competencia separada del presupuesto de entrenamiento',
      en: 'Race load kept separate from training budget',
    },
    planning_scope_kind: { es: 'Alcance de planificación', en: 'Planning scope' },
    planning_cohort_id: { es: planningSubgroupLabel, en: planningSubgroupLabel },
    microcycle_id: { es: 'Microciclo', en: 'Microcycle' },
    shared_event_key: { es: 'Evento compartido', en: 'Shared event' },
    shared_prescription_count: { es: 'Prescripciones compartiendo la sesión', en: 'Prescriptions sharing the session' },
    coexisting_microcycle_ids: { es: 'Microciclos coexistentes', en: 'Coexisting microcycles' },
    current_scope_participates: { es: 'El alcance actual participa', en: 'Current scope participates' },
    event_ownership: { es: 'Ownership de Session', en: 'Session ownership' },
    prescription_ownership: { es: 'Ownership de prescripción', en: 'Prescription ownership' },
    current_state_coach_protected: { es: 'Estado protegido por el Coach', en: 'Coach-protected current state' },
    generator_may_replace_current_state: { es: 'El generador puede reemplazar el estado actual', en: 'Generator may replace current state' },
    generated_origin_retained: { es: 'Origen generado conservado', en: 'Generated origin retained' },
    event_regeneration_action: { es: 'Acción sobre Session', en: 'Session regeneration action' },
    prescription_regeneration_action: { es: 'Acción sobre prescripción', en: 'Prescription regeneration action' },
    obsolete_event_ids: { es: 'Sessions obsoletas', en: 'Obsolete Sessions' },
    obsolete_prescription_ids: { es: 'Prescripciones obsoletas', en: 'Obsolete prescriptions' },
    preserved_record_count: { es: 'Registros preservados', en: 'Preserved records' },
    preserved_records: { es: 'Detalle de preservación', en: 'Preservation detail' },
    allocated_training_volume_km: { es: 'Volumen de entrenamiento asignado', en: 'Allocated training volume' },
    allocated_training_elevation_gain: { es: 'Desnivel de entrenamiento asignado', en: 'Allocated training elevation gain' },
    remaining_training_volume_km: { es: 'Volumen de entrenamiento restante', en: 'Remaining training volume' },
    remaining_training_elevation_gain: { es: 'Desnivel de entrenamiento restante', en: 'Remaining training elevation gain' },
    competition_load_separate: {
      es: 'La competencia no consume el presupuesto de entrenamiento',
      en: 'Race load does not consume the training budget',
    },
  }

  const label = labels[code]
  if (label) return locale === 'en' ? label.en : label.es
  return humanizeGenerationExplanationCode(code)
}

function formatGenerationExplanationWarning(code: string, locale: string) {
  const warnings: Record<string, { es: string; en: string }> = {
    no_compatible_template: {
      es: 'No hubo una plantilla compatible para esta sesión.',
      en: 'No compatible template was available for this session.',
    },
    reference_percentage_target_missing: {
      es: 'Falta el porcentaje de referencia para aplicar ese método de intensidad.',
      en: 'Reference percentage is missing for the selected intensity method.',
    },
    intense_sessions_not_fully_assigned: {
      es: 'No pudieron ubicarse todas las sesiones intensas respetando las restricciones.',
      en: 'Not all intense sessions could be assigned while respecting the constraints.',
    },
    protected_generation_collision: {
      es: 'Se preservó una edición del Coach y el generador no la reemplazó.',
      en: 'A Coach edit was preserved and was not replaced by the generator.',
    },
    current_generation_not_present_in_shared_result: {
      es: 'La prescripción actual no participa del resultado compartido de esta generación.',
      en: 'The current prescription is not part of this shared generation result.',
    },
  }

  const warning = warnings[code]
  if (warning) return locale === 'en' ? warning.en : warning.es
  return humanizeGenerationExplanationCode(code)
}

function humanizeGenerationExplanationCode(code: string) {
  return code
    .split('_')
    .filter(Boolean)
    .map((part, index) => (
      index === 0
        ? part.charAt(0).toUpperCase() + part.slice(1)
        : part
    ))
    .join(' ')
}
