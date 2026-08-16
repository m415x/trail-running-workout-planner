import React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// Card Principal (Reemplaza los contenedores externos con bordes rounded-3xl)
export type CustomButtonProps = React.ComponentProps<typeof Button>

export function PrimaryButton({ className, ...props }: CustomButtonProps) {
  return (
    <Button
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all cursor-pointer',
        className,
      )}
      {...props}
    />
  )
}

export function SecondaryButton({ className, ...props }: CustomButtonProps) {
  return (
    <Button
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-secondary/60 text-secondary-foreground border border-foreground/20 hover:bg-secondary/80 transition-all cursor-pointer',
        className,
      )}
      {...props}
    />
  )
}

export function LinkButton({ className, ...props }: CustomButtonProps) {
  return (
    <Button
      variant='link'
      className={cn(
        'flex items-center gap-1 rounded-full text-[11px] font-semibold cursor-pointer text-primary transition-colors hover:text-primary/80 hover:no-underline p-0',
        className,
      )}
      {...props}
    />
  )
}

export function GlassButton({ className, ...props }: CustomButtonProps) {
  return (
    <Button
      className={cn(
        'flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium',
        'bg-glass-bg text-glass-foreground border border-glass-border',
        'backdrop-blur-md shadow-md cursor-pointer transition-all duration-200',
        'hover:bg-glass-bg-hover hover:scale-102 active:scale-98',
        className,
      )}
      {...props}
    />
  )
}
