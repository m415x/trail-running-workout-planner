'use client'

import { UserProps } from '@/utils/interfaces'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export function HeaderUser({ user }: { user: UserProps }) {
  // Nombre completo compuesto
  const fullName = `${user.firstName} ${user.lastName}`

  // Iniciales exactas para el Fallback
  const initials = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase()

  return (
    <button type='button' className='flex items-center gap-3 text-left outline-none cursor-pointer group'>
      {/* Avatar con borde activo primario */}
      <div className='rounded-full border-3 border-primary transition-transform group-hover:scale-105'>
        <Avatar className='size-11'>
          <AvatarImage src={user.avatar} alt={fullName} className='object-cover' />
          <AvatarFallback className='font-semibold bg-secondary text-foreground text-xs'>{initials}</AvatarFallback>
        </Avatar>
      </div>

      {/* Info del Atleta */}
      <div className='flex flex-col justify-center'>
        <h1 className='font-heading text-foreground text-xl font-bold leading-tight tracking-tight'>
          {user.nickName ?? fullName}
        </h1>
        <p className='text-muted-foreground text-xs font-normal font-sans'>
          {user.teamRole ?? 'El Parque Team Athlete'}
        </p>
      </div>
    </button>
  )
}
