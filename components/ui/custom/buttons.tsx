import React from 'react'
import { useTheme } from 'next-themes'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@ui/button'
import { AnimatedThemeToggler } from '@ui/animated-theme-toggler'

// Card Principal (Reemplaza los contenedores externos con bordes rounded-3xl)
export type CustomButtonProps = React.ComponentProps<typeof Button>

export function CustomButton({ className, ...props }: CustomButtonProps) {
  return (
    <Button
      className={cn(
        'flex items-center gap-2 px-2.5 rounded-xl text-xs font-semibold h-10',
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

export interface PillButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: LucideIcon
  iconClassName?: string
  value: string | number
  valueClassName?: string
  subtitle?: string
  subtitleClassName?: string
}

export const PillButton = React.forwardRef<HTMLButtonElement, PillButtonProps>(
  ({ icon: Icon, iconClassName, value, valueClassName, subtitle, subtitleClassName, className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type='button'
        className={cn(
          'flex flex-col items-center justify-center rounded-xl w-17 p-3 border shadow-none transition-all cursor-pointer hover:scale-105 active:scale-98 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring select-none shrink-0',
          className,
        )}
        {...props}
      >
        {Icon && <Icon size={13} className={cn('mb-1 shrink-0', iconClassName)} />}
        <span className={cn('font-heading text-2xl font-black leading-none tracking-tight', valueClassName)}>
          {value}
        </span>
        {subtitle && (
          <span className={cn('text-[9px] font-medium mt-0.5 tracking-tight', subtitleClassName)}>{subtitle}</span>
        )}
      </button>
    )
  },
)
PillButton.displayName = 'PillButton'

export type ThemeToggleButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'variant'
>

export function ThemeToggleButton({ className, ...props }: ThemeToggleButtonProps) {
  const { theme, setTheme } = useTheme()

  return (
    <AnimatedThemeToggler
      variant='star'
      fromCenter
      theme={theme === 'dark' ? 'dark' : 'light'}
      onThemeChange={(newTheme) => setTheme(newTheme)}
      className={cn(className)}
      {...props}
    />
  )
}
