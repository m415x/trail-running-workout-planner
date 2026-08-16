'use client'

import { useMemo } from 'react'
import { UserProps } from '@/types/user.types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatFullDate } from '@/utils/date-helpers'

export function HeaderUser({ user }: { user: UserProps }) {
  // Nombre completo compuesto
  const fullName = `${user.firstName} ${user.lastName}`

  // Iniciales exactas para el Fallback
  const initials = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase()

  // Calcula y formatea la fecha actual ("Jueves · 13 Agosto 2026")
  const today = useMemo(() => {
    return formatFullDate(new Date())
  }, [])

  return (
    <button type='button' className='flex items-center gap-3 text-left outline-none cursor-pointer group'>
      {/* Avatar con borde activo primario */}
      <div className='rounded-full border-3 border-primary transition-transform group-hover:scale-105'>
        <Avatar className='size-12'>
          <AvatarImage src={user.avatar} alt={fullName} className='object-cover' />
          <AvatarFallback className='font-semibold bg-secondary text-foreground text-xs'>{initials}</AvatarFallback>
        </Avatar>
      </div>

      <div className='flex flex-col justify-center'>
        {/* Info del Atleta */}
        <h1 className='font-heading text-foreground text-xl font-bold leading-tight tracking-tight'>
          Hola, {user.nickName ?? fullName}
        </h1>

        {/* Fecha de hoy en formato largo */}
        <p className='text-muted-foreground text-xs font-normal font-sans'>{today}</p>
      </div>
    </button>
  )
}
