'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface HeaderUserProps {
  user: {
    name: string
    teamRole?: string
    email: string
    avatar: string
  }
}

export function HeaderUser({ user }: HeaderUserProps) {
  // Obtener iniciales para el Fallback
  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase()

  return (
    <button type='button' className='flex items-center gap-3 text-left outline-none cursor-pointer group'>
      {/* Avatar con borde activo primario */}
      <div className='rounded-full border-3 border-primary transition-transform group-hover:scale-105'>
        <Avatar className='size-11'>
          <AvatarImage src={user.avatar} alt={user.name} className='object-cover' />
          <AvatarFallback className='font-semibold bg-secondary text-foreground text-xs'>{initials}</AvatarFallback>
        </Avatar>
      </div>

      {/* Info del Atleta */}
      <div className='flex flex-col justify-center'>
        <h1 className='font-heading text-foreground text-xl font-bold leading-tight tracking-tight'>{user.name}</h1>
        <p className='text-muted-foreground text-xs font-normal font-sans'>
          {user.teamRole ?? 'El Parque Team Athlete'}
        </p>
      </div>
    </button>
  )
}
