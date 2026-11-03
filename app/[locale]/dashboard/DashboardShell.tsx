'use client'

import { SidebarInset, SidebarProvider, SidebarTrigger } from '@ui/sidebar'
import { Separator } from '@ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@ui/dropdown-menu'
import { CircleUserRound } from 'lucide-react'
import { AppSidebar } from '@/components/dashboard/app-sidebar'
import { CoachHomeDestinationsContext } from '@/features/coach-home/coach-home-destinations'
import { DashboardDirtyFormGuardProvider } from '@/components/forms/dashboard-dirty-form-guard'
import { useLocale, useTranslations } from 'next-intl'
import { logoutAction } from '@/app/actions/auth-actions'
import { completeLogoutNavigation } from '@/lib/auth/logout-navigation'
import { createCoachNavigationResumeRefresh } from '@/lib/authorization/coach-navigation-resume-refresh'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export function DashboardShell({ children, visibleDestinations }: {
  children: React.ReactNode
  visibleDestinations: readonly string[]
}) {
  const router = useRouter()
  const [logoutFailed, setLogoutFailed] = useState(false)
  useEffect(() => {
    const resume = createCoachNavigationResumeRefresh(() => router.refresh())
    const onVisibilityChange = () => resume.onVisibilityChange(document.visibilityState === 'visible')
    const onFocus = () => resume.onFocus()
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', onFocus)
    }
  }, [router])

  const t = useTranslations('CoachShell')
  const locale = useLocale()
  const logoutLocale = locale === 'en' ? 'en' : 'es'

  return (
    <DashboardDirtyFormGuardProvider>
      <SidebarProvider defaultOpen={false}>
        <AppSidebar visibleDestinations={visibleDestinations} />
        <SidebarInset className='min-w-0'>
          <header className='flex h-14 shrink-0 items-center gap-2 border-b px-3 sm:px-4 md:h-16'>
            <SidebarTrigger className='-ml-1' />
            <Separator orientation='vertical' className='mr-2 h-4' />
            <div className='flex flex-1 items-center justify-between'>
              <h1 className='text-lg font-semibold'>{t('title')}</h1>

              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={t('accountMenu')}
                  className='inline-flex size-9 items-center justify-center rounded-full border border-border hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                >
                  <CircleUserRound className='size-5' aria-hidden='true' />
                </DropdownMenuTrigger>
                <DropdownMenuContent className='w-56' align='end'>
                  {logoutFailed && <p role='alert' className='px-2 text-sm text-destructive'>{t('signOutError')}</p>}
                  <DropdownMenuItem
                    className='text-red-600 focus:text-red-600'
                    onClick={() => { setLogoutFailed(false); void completeLogoutNavigation({ locale: logoutLocale, signOut: () => logoutAction(logoutLocale), replace: (path) => router.replace(path), refresh: () => router.refresh() }).then((result) => { if (result === 'invalid') setLogoutFailed(true) }) }}
                  >
                    {t('signOut')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className='flex min-w-0 flex-1 flex-col gap-3 p-3 sm:gap-4 sm:p-4 lg:gap-8 lg:p-8'>
            <CoachHomeDestinationsContext.Provider value={visibleDestinations}>{children}</CoachHomeDestinationsContext.Provider>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </DashboardDirtyFormGuardProvider>
  )
}
