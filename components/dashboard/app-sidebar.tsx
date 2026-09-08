'use client'

import { CalendarDays, CalendarRange, Dumbbell, LayoutDashboard, Mountain, Users, UsersRound } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Link, usePathname } from '@/i18n/routing'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@ui/sidebar'

const navigationItems = [
  {
    label: 'Resumen',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Atletas',
    href: '/dashboard/athletes',
    icon: Users,
  },
  {
    label: 'Grupos',
    href: '/dashboard/groups',
    icon: UsersRound,
  },
  {
    label: 'Planificación',
    href: '/dashboard/planning',
    icon: CalendarRange,
  },
  {
    label: 'Sesiones',
    href: '/dashboard/sessions',
    icon: CalendarDays,
  },
  {
    label: 'templates',
    href: '/dashboard/templates',
    icon: Dumbbell,
  },
] as const

export function AppSidebar() {
  const pathname = usePathname()
  const t = useTranslations('WorkoutTemplates')

  return (
    <Sidebar collapsible='icon'>
      <SidebarHeader>
        <div className='flex items-center gap-2 px-2 py-1.5'>
          <div className='flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground'>
            <Mountain className='size-4' />
          </div>
          <div className='min-w-0 group-data-[collapsible=icon]:hidden'>
            <p className='truncate text-sm font-semibold'>El Parque Team</p>
            <p className='truncate text-xs text-muted-foreground'>Panel del coach</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Gestión</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => {
                const isActive = item.href === '/dashboard' ? pathname === item.href : pathname.startsWith(item.href)
                const label = item.label === 'templates' ? t('navigation') : item.label

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton render={<Link href={item.href} />} isActive={isActive} tooltip={label}>
                      <item.icon />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <p className='px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden'>Fase 1 · Núcleo de planificación</p>
      </SidebarFooter>
    </Sidebar>
  )
}
