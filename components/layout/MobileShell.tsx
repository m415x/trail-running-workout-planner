'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import type { ReactNode } from 'react'

import { BottomNavigationBar } from '@/components/layout/BottomNavigationBar'
import { ScrollArea } from '@ui/scroll-area'
import { MobileShellProvider, useMobileShell } from '@/context/MobileShellContext'
import { cn } from '@/lib/utils'
import {
  createAthleteTypographyBrowserUpdate,
  resolveAthleteTypographyBootstrap,
} from '@/lib/athlete-typography/bootstrap'
import type { AthleteTypographyPreference } from '@/lib/athlete-typography/preference'
import '@/features/athlete-typography/typography.css'

type AthleteTypographyState = {
  preference: AthleteTypographyPreference
  setPreference: (rawPreference: unknown) => void
}

const AthleteTypographyContext = createContext<AthleteTypographyState | null>(null)

/** Future Settings controls may consume this without changing the auth boundary. */
export function useOptionalAthleteTypography() {
  return useContext(AthleteTypographyContext)
}

export function useAthleteTypography() {
  const state = useContext(AthleteTypographyContext)
  if (!state) throw new Error('useAthleteTypography requires MobileShell')
  return state
}

function MobileShellInner({ children }: { children: ReactNode }) {
  const { shellBgColor } = useMobileShell()
  const { preference } = useAthleteTypography()

  return (
    <div
      className='athlete-typography fixed inset-0 w-full overflow-hidden overscroll-none bg-background'
      data-athlete-typography={preference}
    >
      <div className={cn('relative flex h-dvh max-h-dvh w-full flex-col overflow-hidden', shellBgColor)}>
        <ScrollArea className='min-h-0 w-full flex-1'>
          <main className='px-2 pt-2 pb-21'>{children}</main>
        </ScrollArea>
        <BottomNavigationBar />
      </div>
    </div>
  )
}

export function MobileShell({
  children,
  initialTypographyPreference,
}: {
  children: ReactNode
  initialTypographyPreference: AthleteTypographyPreference
}) {
  // SSR and the first client render both use this exact validated prop.
  const [preference, setCurrentPreference] = useState<AthleteTypographyPreference>(
    () => resolveAthleteTypographyBootstrap(initialTypographyPreference).preference,
  )

  const setPreference = useCallback((rawPreference: unknown) => {
    const update = createAthleteTypographyBrowserUpdate(rawPreference, {
      secure: window.location.protocol === 'https:',
    })
    document.cookie = update.cookie
    setCurrentPreference(update.preference)
  }, [])

  return (
    <AthleteTypographyContext.Provider value={{ preference, setPreference }}>
      <MobileShellProvider>
        <MobileShellInner>{children}</MobileShellInner>
      </MobileShellProvider>
    </AthleteTypographyContext.Provider>
  )
}
