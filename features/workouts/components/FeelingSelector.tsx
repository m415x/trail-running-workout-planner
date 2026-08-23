'use client'

import type { Icon as PhosphorIcon } from '@phosphor-icons/react'
import { SmileySadIcon, SmileyMehIcon, SmileyIcon, SmileyWinkIcon, SmileyXEyesIcon } from '@phosphor-icons/react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export type FeelingValue = 'very_weak' | 'weak' | 'normal' | 'strong' | 'very_strong'

export interface FeelingOption {
  value: FeelingValue
  label: string
  icon: PhosphorIcon
  iconClassName?: string
}

export const FEELING_OPTIONS: readonly FeelingOption[] = [
  { value: 'very_weak', label: 'Muy débil', icon: SmileyXEyesIcon },
  { value: 'weak', label: 'Débil', icon: SmileySadIcon },
  { value: 'normal', label: 'Normal', icon: SmileyMehIcon },
  { value: 'strong', label: 'Fuerte', icon: SmileyIcon },
  { value: 'very_strong', label: 'Muy fuerte', icon: SmileyWinkIcon },
] as const

interface FeelingSelectorProps {
  value?: FeelingValue | null
  onChange: (value: FeelingValue | null) => void
}

export function FeelingSelector({ value, onChange }: FeelingSelectorProps) {
  return (
    <div className='space-y-1.5'>
      <label className='text-[11px] font-sans font-semibold text-muted-foreground uppercase flex items-center gap-1'>
        ¿Cómo te has sentido?
      </label>

      <div className='flex items-start justify-between gap-1 w-full p-1'>
        {FEELING_OPTIONS.map((option) => {
          const isSelected = value === option.value
          const Icon = option.icon

          return (
            <button
              key={option.value}
              type='button'
              onClick={() => onChange(isSelected ? null : option.value)}
              className='group flex flex-col items-center flex-1 focus:outline-none'
            >
              <div className='relative'>
                <div
                  className={cn(
                    'size-11 rounded-full flex items-center justify-center transition-all duration-200',
                    isSelected
                      ? 'bg-secondary text-secondary-foreground shadow-sm ring-2 ring-primary ring-offset-2 ring-offset-background scale-105'
                      : 'bg-secondary/40 text-muted-foreground hover:bg-secondary/70 hover:text-foreground',
                  )}
                >
                  <div className='flex items-center justify-center text-current'>
                    <Icon className={cn('size-6', option.iconClassName)} />
                  </div>
                </div>

                {isSelected && (
                  <span className='absolute -bottom-1 -right-1 size-5 bg-white text-[#1a73e8] rounded-full flex items-center justify-center shadow-md border border-white'>
                    <Check className='size-3 stroke-[3.5]' />
                  </span>
                )}
              </div>

              <span
                className={cn(
                  'mt-2 text-center text-xs transition-colors duration-200 leading-tight',
                  isSelected ? 'font-medium text-foreground' : 'text-muted-foreground group-hover:text-foreground/80',
                )}
              >
                {option.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
