import React from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@ui/card'

// Card Principal (Reemplaza los contenedores externos con bordes rounded-3xl)
export type CustomCardProps = React.ComponentProps<typeof CardContent>

export function CustomCard({ className, ...props }: CustomCardProps) {
  return (
    <CardContent
      className={cn('bg-card rounded-[var(--radius-ept-surface)] p-[var(--space-ept-content)] border border-border flex flex-col gap-2 shadow-[var(--elevation-ept-raised)]', className)}
      {...props}
    />
  )
}

export function CustomCardInside({ className, ...props }: CustomCardProps) {
  return <CardContent className={cn('bg-background rounded-[var(--radius-ept-control)] p-[var(--space-ept-content)] border border-border', className)} {...props} />
}

// Contenedor secundario para métricas (Sub-tarjetas de métricas o cajas internas)
export type StatCardProps = React.ComponentProps<typeof Card>

export function StatCard({ className, children, ...props }: StatCardProps) {
  return (
    <div className={cn('rounded-[var(--radius-ept-overlay)] p-3 bg-secondary/50 border border-border/40', className)} {...props}>
      {children}
    </div>
  )
}
