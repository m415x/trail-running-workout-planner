import React from 'react'
import { Input } from '@ui/input'
import { cn } from '@/lib/utils'

export function PrimaryInput({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <Input
      type={type}
      data-slot='input'
      onFocus={(event) => event.target.select()}
      className={cn(
        'h-10 rounded-xl font-mono text-sm text-right pr-2 [appearance:textfield]',
        '[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
        className,
      )}
      {...props}
    />
  )
}
