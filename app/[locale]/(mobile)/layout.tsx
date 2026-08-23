'use client'

import { BottomNavigationBar } from '@/components/layout/BottomNavigationBar'
import { ScrollArea } from '@ui/scroll-area'
import { MobileShellProvider, useMobileShell } from '@/context/MobileShellContext'
import { cn } from '@/lib/utils'

function MobileShellInner({ children }: { children: React.ReactNode }) {
  const { shellBgColor } = useMobileShell()

  return (
    <div
      className={cn(
        'fixed inset-0 sm:static sm:min-h-screen w-full bg-background sm:bg-black',
        ' sm:flex sm:items-start sm:justify-center overflow-hidden sm:overflow-auto overscroll-none',
      )}
    >
      {/* Phone Shell */}
      <div
        className={cn(
          'w-full sm:max-w-97.5 h-dvh max-h-dvh flex flex-col relative',
          'overflow-hidden sm:shadow-2xl sm:border-x sm:border-border/40',
          shellBgColor,
        )}
      >
        {/* Scrollable content */}
        <ScrollArea className='flex-1 w-full min-h-0'>
          {/* Contenido dinámico según la ruta */}
          <main className='px-2 pt-2 pb-21'>{children}</main>
        </ScrollArea>

        {/* Barra inferior fija */}
        <BottomNavigationBar />
      </div>
    </div>
  )
}

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <MobileShellProvider>
      <MobileShellInner>{children}</MobileShellInner>
    </MobileShellProvider>
  )
}
