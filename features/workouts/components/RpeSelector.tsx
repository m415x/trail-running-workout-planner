'use client'

import { Info } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@ui/accordion'
import { Slider } from '@ui/slider'
import { cn } from '@/lib/utils'
import { CustomCardInside } from '@ui/custom/card-containers'
import { RPE_LEVELS } from '@/lib/constants'

export interface RpeSelectorProps {
  value?: number | null
  onChange: (val: number | null) => void
}

export function RpeSelector({ value = null, onChange }: RpeSelectorProps) {
  const t = useTranslations('Workouts.rpe')
  const sliderValue = value ?? 0
  const currentRpe = RPE_LEVELS.find((level) => level.value === sliderValue) ?? RPE_LEVELS[0]
  const levelKey = String(currentRpe.value)
  const details = t.raw(`levels.${levelKey}.details`) as string[]

  return (
    <div className='space-y-1.5'>
      <Accordion className='border-none'>
        <AccordionItem value='rpe-selector' className='border-none'>
          <label className='text-[11px] font-sans font-semibold text-muted-foreground uppercase flex items-center gap-1'>
            {t('title')}
          </label>

          <div className='flex items-center justify-between mt-2 min-h-8'>
            <div className='flex items-center gap-2.5'>
              <span
                className={cn(
                  'size-7 rounded-xl font-heading font-bold text-xs flex items-center justify-center shadow-xs transition-colors shrink-0',
                  value === null ? 'bg-muted text-muted-foreground' : currentRpe.colorClass,
                )}
              >
                {value === null ? '—' : currentRpe.value}
              </span>
              <div className='flex flex-col'>
                <span className='font-heading font-bold text-xs text-foreground leading-tight'>
                  {value === null ? '—' : t(`levels.${levelKey}.label`)}
                </span>
                {value !== null && (
                  <span className='text-[10px] text-muted-foreground leading-tight'>{t(`levels.${levelKey}.description`)}</span>
                )}
              </div>
            </div>

            {value !== null && value !== 0 && (
              <AccordionTrigger className='py-0 px-1 text-xs font-medium text-primary hover:text-primary/80 hover:no-underline gap-1'>
                <span>{t('details')}</span>
              </AccordionTrigger>
            )}
          </div>

          <div className='px-1 py-1.5'>
            <Slider
              value={[sliderValue]}
              onValueChange={(val) => {
                const nextVal = Array.isArray(val) ? val[0] : val
                if (typeof nextVal === 'number') onChange(nextVal)
              }}
              min={0}
              max={10}
              step={1}
              className='cursor-pointer py-1'
            />

            <div className='flex items-center justify-between text-[9px] text-muted-foreground font-medium mt-1 px-0.5'>
              <div className='flex items-center gap-1'>
                <button type='button' className='rounded px-1 hover:text-foreground' onClick={() => onChange(null)} aria-label={t('unrecorded')}>
                  —
                </button>
                <button type='button' className='rounded px-1 hover:text-foreground' onClick={() => onChange(0)} aria-label={t('zero')}>
                  0
                </button>
              </div>
              <span>{t('maximum')}</span>
            </div>
          </div>

          <AccordionContent className='pt-1 pb-0'>
            {value !== null && value !== 0 && details.length > 0 && (
              <CustomCardInside className='p-2 rounded-lg bg-background/80 border border-border/40 text-xs space-y-1.5'>
                <p className='font-semibold text-foreground text-[11px] flex items-center gap-1.5'>
                  <Info size={12} className='text-primary' />
                  {t('feeling', { value: currentRpe.value })}
                </p>
                <ul className='space-y-1 text-muted-foreground text-[11px] pl-4 list-disc'>
                  {details.map((detail, idx) => (
                    <li key={idx}>{detail}</li>
                  ))}
                </ul>
              </CustomCardInside>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
