'use client'

import { SidebarInset, SidebarProvider, SidebarTrigger } from '@ui/sidebar'
import { Separator } from '@ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@ui/avatar'
import { AppSidebar } from '@/components/dashboard/app-sidebar'
import { DashboardDirtyFormGuardProvider } from '@/components/forms/dashboard-dirty-form-guard'
import { useTranslations } from 'next-intl'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('CoachShell')

  return (
    <DashboardDirtyFormGuardProvider>
      <SidebarProvider defaultOpen={false}>
      <AppSidebar />
      <SidebarInset className='min-w-0'>
        <header className='flex h-14 shrink-0 items-center gap-2 border-b px-3 sm:px-4 md:h-16'>
          <SidebarTrigger className='-ml-1' />
          <Separator orientation='vertical' className='mr-2 h-4' />
          <div className='flex flex-1 items-center justify-between'>
            <h1 className='text-lg font-semibold'>{t('title')}</h1>

            {/* ✅ SOLUCIÓN: La propiedad 'asChild' es clave aquí */}
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Avatar className='h-8 w-8'>
                  <AvatarImage src='/avatars/coach.png' alt='Coach' />
                  <AvatarFallback>CO</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>

              <DropdownMenuContent className='w-56' align='end'>
                <DropdownMenuGroup>
                  <DropdownMenuLabel className='font-normal'>
                    <div className='flex flex-col space-y-1'>
                      <p className='text-sm font-medium leading-none'>Coach Name</p>
                      <p className='text-xs leading-none text-muted-foreground'>coach@trailrun.com</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>{t('profile')}</DropdownMenuItem>
                  <DropdownMenuItem>{t('settings')}</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className='text-red-600 focus:text-red-600'>{t('signOut')}</DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className='flex min-w-0 flex-1 flex-col gap-3 p-3 sm:gap-4 sm:p-4 lg:gap-8 lg:p-8'>{children}</main>
      </SidebarInset>
      </SidebarProvider>
    </DashboardDirtyFormGuardProvider>
  )
}
