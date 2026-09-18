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
import { createDirtyFormBrowserProtection } from '@/lib/forms/dirty-form-browser-protection'
import { createDashboardDirtyFormGuard } from '@/lib/forms/dashboard-dirty-form-guard'
import { useTranslations } from 'next-intl'
import type { DirtyFormValue } from '@/lib/forms/dirty-form'

interface DashboardDirtyFormGuardContextValue {
  register(initialValue: DirtyFormValue): void
  update(currentValue: DirtyFormValue): void
  unregister(): void
  markSaved(): void
  guardNavigation(navigate: () => void): void
}

const DashboardDirtyFormGuardContext =
  createContext<DashboardDirtyFormGuardContextValue | null>(null)

export function DashboardDirtyFormGuardProvider({
  children,
}: {
  children: ReactNode
}) {
  const t = useTranslations('DirtyFormGuard')
  const [guard] = useState(createDashboardDirtyFormGuard)
  const [confirmationOpen, setConfirmationOpen] = useState(false)

  const guardNavigation = useCallback(
    (navigate: () => void) => {
      guard.guardNavigation(navigate)
      setConfirmationOpen(guard.hasPendingNavigation())
    },
    [guard],
  )

  useEffect(() => {
    const protection = createDirtyFormBrowserProtection(
      () => guard.isDirty(),
      (handler) => {
        const handleBeforeUnload = (event: BeforeUnloadEvent) => handler(event)
        window.addEventListener('beforeunload', handleBeforeUnload)

        return () => window.removeEventListener('beforeunload', handleBeforeUnload)
      },
    )

    protection.start()
    return () => protection.stop()
  }, [guard])

  const stay = () => {
    guard.stay()
    setConfirmationOpen(false)
  }

  const discard = () => {
    guard.discard()
    setConfirmationOpen(false)
  }

  return (
    <DashboardDirtyFormGuardContext.Provider
      value={{
        register: guard.register,
        update: guard.update,
        unregister: guard.unregister,
        markSaved: guard.markSaved,
        guardNavigation,
      }}
    >
      {children}

      <AlertDialog open={confirmationOpen} onOpenChange={(open) => !open && stay()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={stay}>{t('stay')}</AlertDialogCancel>
            <AlertDialogAction variant='destructive' onClick={discard}>
              {t('discard')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardDirtyFormGuardContext.Provider>
  )
}

export function useDashboardDirtyFormGuard() {
  const context = useContext(DashboardDirtyFormGuardContext)
  if (!context) {
    throw new Error(
      'useDashboardDirtyFormGuard must be used within DashboardDirtyFormGuardProvider',
    )
  }
  return context
}
