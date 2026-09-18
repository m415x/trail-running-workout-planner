'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@ui/alert-dialog'
import { applyBeforeUnloadProtection } from '@/lib/forms/dirty-form-before-unload'
import { createDirtyFormGuardController } from '@/lib/forms/dirty-form-guard-controller'
import type { DirtyFormValue } from '@/lib/forms/dirty-form'

interface DirtyFormGuardContextValue {
  guardNavigation(navigate: () => void): void
  markSaved(): void
}

const DirtyFormGuardContext = createContext<DirtyFormGuardContextValue | null>(null)

export interface DirtyFormGuardProviderProps {
  initialValue: DirtyFormValue
  currentValue: DirtyFormValue
  children: ReactNode
  title: string
  description: string
  stayLabel: string
  discardLabel: string
}

export function DirtyFormGuardProvider({
  initialValue,
  currentValue,
  children,
  title,
  description,
  stayLabel,
  discardLabel,
}: DirtyFormGuardProviderProps) {
  const [controller] = useState(() => {
    let latestValue = currentValue
    const guardController = createDirtyFormGuardController(initialValue, () => latestValue)

    return {
      guardController,
      setCurrentValue(value: DirtyFormValue) {
        latestValue = value
      },
    }
  })
  controller.setCurrentValue(currentValue)

  const [confirmationOpen, setConfirmationOpen] = useState(false)

  const guardNavigation = useCallback(
    (navigate: () => void) => {
      controller.guardController.guardNavigation(navigate)
      setConfirmationOpen(controller.guardController.hasPendingNavigation())
    },
    [controller],
  )

  const markSaved = useCallback(() => {
    controller.guardController.markSaved()
  }, [controller])

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      applyBeforeUnloadProtection(controller.guardController.isDirty(), event)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [controller])

  const stay = () => {
    controller.guardController.stay()
    setConfirmationOpen(false)
  }

  const discard = () => {
    controller.guardController.discard()
    setConfirmationOpen(false)
  }

  return (
    <DirtyFormGuardContext.Provider value={{ guardNavigation, markSaved }}>
      {children}

      <AlertDialog open={confirmationOpen} onOpenChange={(open) => !open && stay()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={stay}>{stayLabel}</AlertDialogCancel>
            <AlertDialogAction variant='destructive' onClick={discard}>
              {discardLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DirtyFormGuardContext.Provider>
  )
}

export function useDirtyFormGuard(): DirtyFormGuardContextValue {
  const context = useContext(DirtyFormGuardContext)
  if (!context) throw new Error('useDirtyFormGuard must be used within DirtyFormGuardProvider')
  return context
}
