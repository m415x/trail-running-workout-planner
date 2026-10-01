'use client'

import {
  CalendarDays,
  CalendarRange,
  Dumbbell,
  GitBranch,
  LayoutDashboard,
  Mountain,
  ReceiptText,
  Trophy,
  Users,
  UsersRound,
} from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Link, usePathname, useRouter } from '@/i18n/routing'
import { useDashboardDirtyFormGuard } from '@/components/forms/dashboard-dirty-form-guard'
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
  useSidebar,
} from '@ui/sidebar'

const navigationItems = [
  {
    labelKey: 'overview',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    labelKey: 'athletes',
    href: '/dashboard/athletes',
    icon: Users,
  },
  {
    labelKey: 'sportingGroups',
    href: '/dashboard/groups',
    icon: UsersRound,
  },
  {
    labelKey: 'planningSubgroups',
    href: '/dashboard/cohorts',
    icon: GitBranch,
  },
  {
    labelKey: 'planning',
    href: '/dashboard/planning',
    icon: CalendarRange,
  },
  {
    labelKey: 'membership',
    href: '/dashboard/membership',
    icon: ReceiptText,
  },
  {
    labelKey: 'competitions',
    href: '/dashboard/competitions',
    icon: Trophy,
  },
  {
    labelKey: 'sessions',
    href: '/dashboard/sessions',
    icon: CalendarDays,
  },
  {
    labelKey: 'templates',
    href: '/dashboard/templates',
    icon: Dumbbell,
  },
] as const

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { guardNavigation } = useDashboardDirtyFormGuard()
  const { setOpenMobile } = useSidebar()
  const t = useTranslations('CoachShell')

  return (
    <Sidebar collapsible='icon'>
      <SidebarHeader>
        <div className='flex items-center gap-2 px-2 py-1.5'>
          <div className='flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground'>
            <Mountain className='size-4' />
          </div>
          <div className='min-w-0 group-data-[collapsible=icon]:hidden'>
            <p className='truncate text-sm font-semibold'>El Parque Team</p>
            <p className='truncate text-xs text-muted-foreground'>{t('subtitle')}</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t('management')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => {
                const isActive = item.href === '/dashboard' ? pathname === item.href : pathname.startsWith(item.href)
                const label = t(`navigation.${item.labelKey}`)

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={
                        <Link
                          href={item.href}
                          onNavigate={(event) => {
                            event.preventDefault()
                            guardNavigation(() => {
                              router.push(item.href)
                              setOpenMobile(false)
                            })
                          }}
                        />
                      }
                      isActive={isActive}
                      tooltip={label}
                    >
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
        <p className='px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden'>
          {t('footer')}
        </p>
      </SidebarFooter>
    </Sidebar>
  )
}
