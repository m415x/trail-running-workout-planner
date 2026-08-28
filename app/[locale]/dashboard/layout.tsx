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
import { Button } from '@ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@ui/avatar'
import { AppSidebar } from '@/components/dashboard/app-sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className='flex h-16 shrink-0 items-center gap-2 border-b px-4'>
          <SidebarTrigger className='-ml-1' />
          <Separator orientation='vertical' className='mr-2 h-4' />
          <div className='flex flex-1 items-center justify-between'>
            <h1 className='text-lg font-semibold'>Panel del Coach</h1>

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
                  <DropdownMenuItem>Perfil</DropdownMenuItem>
                  <DropdownMenuItem>Configuración</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className='text-red-600 focus:text-red-600'>Cerrar sesión</DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className='flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8'>{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
