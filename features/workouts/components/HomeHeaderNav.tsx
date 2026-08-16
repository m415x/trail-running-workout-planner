'use client'

import { Bell } from 'lucide-react'
import { UserProps } from '@/types/user.types'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { HeaderUser } from '@/features/workouts/components/HeaderUser'

export function HomeHeaderNav({ user }: { user: UserProps }) {
  return (
    <div className='flex items-center justify-between'>
      {/* Nuevo componente de usuario desplegable */}
      <HeaderUser user={user} />

      {/* Controles del lado derecho */}
      <div className='flex items-center gap-2'>
        <AnimatedThemeToggler variant='star' fromCenter className='text-muted-foreground' />

        <button
          type='button'
          aria-label='Notificaciones'
          className='relative p-2.5 rounded-2xl border border-border/80 bg-card/60 hover:bg-card transition-colors cursor-pointer'
        >
          <Bell size={18} className='text-muted-foreground' />
          <span className='absolute top-2 right-2 size-2 rounded-full border-2 border-card bg-primary' />
        </button>
      </div>
    </div>
  )
}
