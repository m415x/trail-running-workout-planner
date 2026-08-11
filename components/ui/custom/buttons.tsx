import React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// Card Principal (Reemplaza los contenedores externos con bordes rounded-3xl)
export type CustomButtonProps = React.ComponentProps<typeof Button>

export function DefaultButton({ className, ...props }: CustomButtonProps) {
  return (
    <Button
      className={cn(
        'flex items-center gap-1 rounded-full text-[11px] font-semibold cursor-pointer text-primary transition-colors hover:text-background bg-primary/20 ',
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
