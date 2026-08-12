'use client'

import { useState } from 'react'
import { navItems } from '@/utils/constants'
import { cn } from '@/lib/utils'

interface BottomNavigationBarProps {
  activeNav?: number
  onNavChange?: (index: number) => void
  isFixed?: boolean // Permite alternar entre 'fixed' (pantalla completa) o 'absolute' (Phone Shell)
}

export function BottomNavigationBar({
  activeNav: externalActiveNav,
  onNavChange,
  isFixed = true,
}: BottomNavigationBarProps) {
  const [internalActiveNav, setInternalActiveNav] = useState<number>(0)

  // Soporta tanto estado interno como estado controlado desde el DashboardView
  const activeNav = externalActiveNav ?? internalActiveNav

  const handleSelect = (index: number) => {
    setInternalActiveNav(index)
    onNavChange?.(index)
  }

  return (
    <nav
      className={cn(
        'w-full max-w-97.5 z-50 border-t border-border/80 bg-primary-foreground/80 backdrop-blur-lg px-2 py-3 transition-all',
        isFixed ? 'fixed bottom-0' : 'absolute bottom-0',
      )}
    >
      <div className='max-w-md mx-auto flex items-center justify-around'>
        {navItems.map(({ icon: Icon, label }, i) => {
          const isActive = activeNav === i

          return (
            <button
              key={label}
              type='button'
              onClick={() => handleSelect(i)}
              className={cn(
                'flex flex-col items-center gap-1 transition-all duration-200 cursor-pointer py-1 px-3 rounded-xl',
                isActive
                  ? 'text-primary hover:text-primary/80 font-semibold scale-105'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon size={20} className='transition-transform duration-200' />

              <span className='font-medium text-[9px] font-mono eading-none tracking-tight'>{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
