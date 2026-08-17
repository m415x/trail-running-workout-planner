'use client'

import { ChevronDown, ChevronUp, Info } from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import { RpeSelectorProps } from '@/features/workouts/types/workout.types'
import { useRpeSelector } from '@/features/workouts/hooks/useRpeSelector'
import { CustomCardInside } from '@/components/ui/custom/card-containers'

export function RpeSelector({ value, onChange }: RpeSelectorProps) {
  const { showDetails, setShowDetails, currentRpe } = useRpeSelector(value)

  return (
    <CustomCardInside className='p-3.5 space-y-3'>
      {/* Cabecera del RPE */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <span
            className={cn(
              'size-7 rounded-xl font-heading font-bold text-xs flex items-center justify-center shadow-xs transition-colors',
              currentRpe.colorClass,
            )}
          >
            {currentRpe.value}
          </span>
          <div>
            <p className='font-heading font-bold text-xs text-foreground leading-none'>{currentRpe.label}</p>
            <p className='text-[10px] text-muted-foreground mt-0.5'>{currentRpe.description}</p>
          </div>
        </div>

        <button
          type='button'
          onClick={() => setShowDetails(!showDetails)}
          className='text-xs text-primary font-medium hover:underline flex items-center gap-1 cursor-pointer'
        >
          {showDetails ? 'Ocultar detalles' : 'Ver detalles'}
          {showDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {/* Slider con recorrido continuo de 1 a 10 */}
      <div className='px-1 py-1'>
        <Slider
          value={[value]}
          onValueChange={(val) => {
            const nextVal = Array.isArray(val) ? val[0] : val
            if (typeof nextVal === 'number') {
              onChange(nextVal)
            }
          }}
          min={1}
          max={10}
          step={1}
          className='cursor-pointer py-1'
        />

        <div className='flex justify-between text-[9px] text-muted-foreground font-medium mt-1.5 px-0.5'>
          <span>Fácil (1)</span>
          <span>Moderado (5)</span>
          <span>Máximo (10)</span>
        </div>
      </div>

      {/* Tarjeta de Detalles explicativos (Estilo Strava) */}
      {showDetails && (
        <div className='p-3 rounded-xl bg-background/80 border border-border/40 text-xs space-y-1.5 animate-in fade-in-50 duration-200'>
          <p className='font-semibold text-foreground text-[11px] flex items-center gap-1.5'>
            <Info size={12} className='text-primary' />
            ¿Qué se siente en nivel {currentRpe.value}?
          </p>
          <ul className='min-h-12 space-y-1 text-muted-foreground text-[11px] pl-4 list-disc'>
            {currentRpe.details.map((detail, idx) => (
              <li key={idx}>{detail}</li>
            ))}
          </ul>
        </div>
      )}
    </CustomCardInside>
  )
}
