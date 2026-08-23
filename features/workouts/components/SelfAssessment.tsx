'use client'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Smile } from 'lucide-react'
import { FeelingSelector } from '@/features/workouts/components/FeelingSelector'
import { RpeSelector } from '@/features/workouts/components/RpeSelector'
import { useSelfAssessment, SelfAssessmentValues } from '@/features/workouts/hooks/useSelfAssessment'

export type { SelfAssessmentValues }

export interface SelfAssessmentProps {
  value?: SelfAssessmentValues
  onChange?: (values: SelfAssessmentValues) => void
  defaultOpen?: boolean
}

export function SelfAssessment({ value, onChange, defaultOpen = false }: SelfAssessmentProps) {
  const { feeling, rpe, hasData, handleFeelingChange, handleRpeChange } = useSelfAssessment({
    value,
    onChange,
  })

  return (
    <Accordion className='w-full rounded-2xl border border-border/60 bg-card/50 transition-colors'>
      <AccordionItem value='self-assessment' className='border-none px-4'>
        <AccordionTrigger className='hover:no-underline'>
          <div className='flex items-center gap-2.5'>
            <span>Autoevaluación</span>

            {/* Badge indicador cuando hay datos seleccionados */}
            {hasData && (
              <span className='ml-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary'>
                {rpe !== null && rpe !== undefined && `RPE ${rpe}`}
                {feeling && <Smile className='size-3' />}
              </span>
            )}
          </div>
        </AccordionTrigger>

        <AccordionContent className='pt-2 pb-4 space-y-4'>
          {/* Selector de Sensaciones */}
          <FeelingSelector value={feeling} onChange={handleFeelingChange} />

          {/* Divisor sutil */}
          <div className='h-px w-full bg-border/40' />

          {/* Selector RPE */}
          <div className='space-y-2'>
            <RpeSelector value={rpe} onChange={handleRpeChange} />
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
