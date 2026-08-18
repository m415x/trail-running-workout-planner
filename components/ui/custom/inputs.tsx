import React from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export function PrimaryInput({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <Input
      type={type}
      data-slot='input'
      className={cn('h-10 rounded-xl font-mono text-sm pl-4', className)}
      {...props}
    />
  )
}
