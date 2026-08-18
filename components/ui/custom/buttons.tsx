import React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// Card Principal (Reemplaza los contenedores externos con bordes rounded-3xl)
export type CustomButtonProps = React.ComponentProps<typeof Button>

export function CustomButton({ className, ...props }: CustomButtonProps) {
  return (
    <Button
      className={cn(
        'flex items-center gap-2 px-2.5 py-1 rounded-xl text-xs font-semibold',
        'border transition-all cursor-pointer shadow-md hover:scale-102 active:scale-98',
        className,
      )}
      {...props}
    />
  )
}

export function PrimaryFilledButton({ className, ...props }: CustomButtonProps) {
  return (
    <CustomButton className={cn('bg-primary text-white border-primary/30 hover:bg-primary/80', className)} {...props} />
  )
}

export function PrimaryOutlineButton({ className, ...props }: CustomButtonProps) {
  return (
    <CustomButton
      className={cn('bg-primary/10 text-primary border-primary/30 hover:bg-primary/20', className)}
      {...props}
    />
  )
}

export function PrimaryLinkButton({ className, ...props }: CustomButtonProps) {
  return (
    <CustomButton
      variant='link'
      className={cn('text-primary transition-colors hover:text-primary/80 hover:no-underline p-0', className)}
      {...props}
    />
  )
}

export function SecondaryFilledButton({ className, ...props }: CustomButtonProps) {
  return (
    <CustomButton
      className={cn('bg-secondary text-white border-secondary/30 hover:bg-secondary/80', className)}
      {...props}
    />
  )
}

export function SecondaryOutlineButton({ className, ...props }: CustomButtonProps) {
  return (
    <CustomButton
      className={cn('bg-secondary/60 text-secondary-foreground border-foreground/20 hover:bg-secondary/80', className)}
      {...props}
    />
  )
}

export function GlassFilledButton({ className, ...props }: CustomButtonProps) {
  return (
    <CustomButton
      className={cn(
        'bg-glass-bg text-glass-foreground border-glass-border',
        'backdrop-blur-md duration-200 hover:bg-glass-bg-hover',
        className,
      )}
      {...props}
    />
  )
}

export function GlassOutlineButton({ className, ...props }: CustomButtonProps) {
  return <CustomButton variant='outline' className={cn('', className)} {...props} />
}
