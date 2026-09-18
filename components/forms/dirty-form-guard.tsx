'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
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
  const currentRef = useRef(currentValue)
  currentRef.current = currentValue

  const controllerRef = useRef<ReturnType<typeof createDirtyFormGuardController> | null>(null)
  if (!controllerRef.current) {
    controllerRef.current = createDirtyFormGuardController(initialValue, () => currentRef.current)
  }

  const controller = controllerRef.current
  const [confirmationOpen, setConfirmationOpen] = useState(false)

  const guardNavigation = useCallback(
    (navigate: () => void) => {
      controller.guardNavigation(navigate)
      setConfirmationOpen(controller.hasPendingNavigation())
    },
    [controller],
  )

  const markSaved = useCallback(() => {
    controller.markSaved()
  }, [controller])

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      applyBeforeUnloadProtection(controller.isDirty(), event)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [controller])

  const stay = () => {
    controller.stay()
    setConfirmationOpen(false)
  }

  const discard = () => {
    controller.discard()
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
