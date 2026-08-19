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
