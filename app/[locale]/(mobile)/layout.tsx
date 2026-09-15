'use client'

import { BottomNavigationBar } from '@/components/layout/BottomNavigationBar'
import { ScrollArea } from '@ui/scroll-area'
import { MobileShellProvider, useMobileShell } from '@/context/MobileShellContext'
import { cn } from '@/lib/utils'

function MobileShellInner({ children }: { children: React.ReactNode }) {
  const { shellBgColor } = useMobileShell()

  return (
    <div className='fixed inset-0 w-full overflow-hidden overscroll-none bg-background'>
      <div
        className={cn(
          'relative flex h-dvh max-h-dvh w-full flex-col overflow-hidden',
          shellBgColor,
        )}
      >
        <ScrollArea className='min-h-0 w-full flex-1'>
          <main className='px-2 pt-2 pb-21'>{children}</main>
        </ScrollArea>

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
