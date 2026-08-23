'use client'

import React, { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { AlertTriangle, LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ConfirmActionDialogProps {
  /** Función que recibe el handler para abrir el diálogo */
  trigger: (openDialog: () => void) => React.ReactNode
  title?: string
  description?: string
  icon?: LucideIcon
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'destructive' | 'primary'
  onConfirm: () => void
  onCancel?: () => void
}

export function ConfirmActionDialog({
  trigger,
  title = '¿Confirmar acción?',
  description = 'Esta operación no se puede deshacer.',
  icon: Icon = AlertTriangle,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'destructive',
  onConfirm,
  onCancel,
}: ConfirmActionDialogProps) {
  const [open, setOpen] = useState(false)
  const isDestructive = variant === 'destructive'

  const handleConfirm = () => {
    setOpen(false)
    onConfirm()
  }

  const handleCancel = () => {
    setOpen(false)
    onCancel?.()
  }

  return (
    <>
      {/* Se renderiza el botón directo sin componentes Trigger envolventes */}
      {trigger(() => setOpen(true))}

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className='max-w-sm rounded-3xl p-5 border-border bg-card shadow-2xl'>
          <AlertDialogHeader className='flex flex-col items-start text-left sm:text-left space-y-2 w-full'>
            <AlertDialogTitle className='flex items-center justify-start gap-2 text-base font-heading font-bold text-foreground text-left w-full'>
              {Icon && <Icon className={cn('size-5 shrink-0', isDestructive ? 'text-destructive' : 'text-primary')} />}
              <span>{title}</span>
            </AlertDialogTitle>
            <AlertDialogDescription className='text-xs text-muted-foreground leading-relaxed text-left'>
              {description}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className='flex flex-row gap-2 mt-4 sm:space-x-0'>
            <AlertDialogCancel
              onClick={handleCancel}
              className='flex-1 rounded-xl text-xs h-9 border-border bg-secondary/50 hover:bg-secondary text-foreground'
            >
              {cancelLabel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={cn(
                'flex-1 rounded-xl text-xs h-9 font-medium shadow-sm transition-all',
                isDestructive
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90',
              )}
            >
              {confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
