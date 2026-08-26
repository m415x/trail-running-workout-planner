'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { HouseSimpleIcon, CalendarDotsIcon, ChartLineIcon, UserIcon, Icon } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

export interface NavItemsProps {
  href: string
  label: string
  icon: Icon
}

const NAV_ITEMS: NavItemsProps[] = [
  { href: '/', label: 'Inicio', icon: HouseSimpleIcon },
  { href: '/plan', label: 'Plan', icon: CalendarDotsIcon },
  { href: '/stats', label: 'Stats', icon: ChartLineIcon },
  { href: '/profile', label: 'Perfil', icon: UserIcon },
]

export function BottomNavigationBar() {
  const pathname = usePathname()

  return (
    <nav className='w-full sm:max-w-97.5 absolute bottom-0 z-50 border-t border-border/80 bg-background p-2 transition-all'>
      <div className='max-w-md mx-auto flex items-center justify-around'>
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
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

              <span className='font-medium text-[9px] font-mono leading-none tracking-tight'>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
