'use client'

import { Team, User } from '@/types'
import { Avatar, AvatarFallback, AvatarImage } from '@ui/avatar'
import { Bell } from 'lucide-react'
import { AnimatedThemeToggler } from '@ui/animated-theme-toggler'
import { useHomeHeader } from '@workouts/hooks/useHomeHeader'
import { cn } from '@/lib/utils'
import { ThemeToggleButton } from '@/components/ui/custom/buttons'

export function HomeHeader({ team, user }: { team: Team; user: User }) {
  const { today, fullName, initials } = useHomeHeader()

  return (
    <div className='flex items-center justify-between'>
      <div className='flex items-center gap-4 text-left outline-none'>
        {/* Avatar con borde activo primario */}
        <div className='relative'>
          <Avatar className='size-14 rounded-full border-3 border-primary shadow-lg'>
            {/* <AvatarImage src={team.avatar} alt={team.name} className='object-cover' /> */}
            {/* Imagen para modo claro */}
            <AvatarImage
              src={team.avatarLight}
              alt={team.name}
              className='border-image-light object-cover dark:hidden'
            />

            {/* Imagen para modo oscuro */}
            <AvatarImage
              src={team.avatarDark}
              alt={team.name}
              className='border-image-dark object-cover hidden dark:block'
            />
            <AvatarFallback className='font-semibold text-foreground text-xs'>{initials}</AvatarFallback>
          </Avatar>
          <button
            type='button'
            className={cn(
              'font-mono text-[10px] font-bold absolute bottom-0 right-0 size-5 flex items-center',
              'justify-center rounded-full bg-background text-foreground hover:bg-primary/90 transition-transform',
              'hover:text-background active:scale-95 shadow-md cursor-pointer border border-background',
            )}
            title='Ver team'
          >
            {user.group}
          </button>
        </div>

        <div className='flex flex-col justify-center'>
          {/* Info del Atleta */}
          <h1 className='font-heading text-foreground text-xl font-bold leading-tight tracking-tight'>
            Hola, {user.nickName ?? fullName}
          </h1>

          {/* Fecha de hoy en formato largo */}
          <p className='text-muted-foreground text-xs font-normal font-sans'>{today}</p>
        </div>
      </div>

      {/* Controles del lado derecho */}
      <div className='flex items-center gap-2'>
        <ThemeToggleButton className='text-muted-foreground' />

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
