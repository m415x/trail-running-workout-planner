import React from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'

// Card Principal (Reemplaza los contenedores externos con bordes rounded-3xl)
export type CustomCardProps = React.ComponentProps<typeof CardContent>

export function CustomCard({ className, ...props }: CustomCardProps) {
  return (
    <CardContent
      className={cn('bg-card rounded-3xl p-4 border border-border flex flex-col gap-3', className)}
      {...props}
    />
  )
}

export function CustomCardInside({ className, ...props }: CustomCardProps) {
  return <CardContent className={cn('bg-background rounded-xl p-4 border border-border', className)} {...props} />
}

// Contenedor secundario para métricas (Sub-tarjetas de métricas o cajas internas)
export type StatCardProps = React.ComponentProps<typeof Card>

export function StatCard({ className, children, ...props }: StatCardProps) {
  return (
    <div className={cn('rounded-2xl p-3 bg-secondary/50 border border-border/40', className)} {...props}>
      {children}
    </div>
  )
}

// Contenedor destacado para notas del coach o alertas
interface NoteCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  variant?: 'orange' | 'emerald' | 'sky'
}

const variantStyles = {
  orange: 'bg-orange-500/10 border-orange-500/20 text-orange-500',
  emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500',
  sky: 'bg-sky-500/10 border-sky-500/20 text-sky-500',
}

export function NoteCard({ title, children, variant = 'orange', className, ...props }: NoteCardProps) {
  return (
    <div
      className={cn('rounded-2xl p-3 border', variantStyles[variant].split(' ').slice(0, 2).join(' '), className)}
      {...props}
    >
      <p className={cn('font-bold uppercase tracking-wider mb-1 text-[10px]', variantStyles[variant].split(' ')[2])}>
        {title}
      </p>
      <div className='text-foreground/80 text-xs leading-relaxed font-sans'>{children}</div>
    </div>
  )
}
