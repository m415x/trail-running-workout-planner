'use client'

import { Bell } from 'lucide-react'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { HeaderUser } from '@/components/blocks/HeaderUser'

const CURRENT_USER = {
  name: 'Cristian Lahoz',
  teamRole: 'Trail Runner',
  email: 'cristianlahoz@elparque.com.ar',
  avatar: '/avatars/cristian.png',
}

export function Header() {
  return (
    <div className='px-5 pt-12 pb-3 flex items-center justify-between'>
      {/* Nuevo componente de usuario desplegable */}
      <HeaderUser user={CURRENT_USER} />

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
