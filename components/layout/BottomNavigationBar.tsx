'use client'

import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/routing'
import { HouseSimpleIcon, CalendarDotsIcon, ChartLineIcon, UserIcon, Icon } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

export interface NavItemsProps {
  href: string
  labelKey: 'home' | 'plan' | 'stats' | 'profile'
  icon: Icon
}

const NAV_ITEMS: NavItemsProps[] = [
  { href: '/', labelKey: 'home', icon: HouseSimpleIcon },
  { href: '/plan', labelKey: 'plan', icon: CalendarDotsIcon },
  { href: '/stats', labelKey: 'stats', icon: ChartLineIcon },
  { href: '/profile', labelKey: 'profile', icon: UserIcon },
]

export function BottomNavigationBar() {
  const t = useTranslations('AthleteShell')
  const pathname = usePathname()

  return (
    <nav className='absolute bottom-0 z-50 w-full border-t border-border/80 bg-background p-2 transition-all'>
      <div className='max-w-md mx-auto flex items-center justify-around'>
        {NAV_ITEMS.map(({ href, labelKey, icon: Icon }) => {
          const isActive = pathname === href

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-1 transition-all duration-200 py-1 px-3 rounded-xl cursor-pointer',
                isActive
                  ? 'text-primary hover:text-primary/80 font-semibold scale-105'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon size={20} className='transition-transform duration-200' />

              <span className='font-medium text-[9px] font-mono leading-none tracking-tight'>{t(labelKey)}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
