'use client'

import { Pencil } from 'lucide-react'
import { User } from '@/types'
import { Avatar, AvatarFallback, AvatarImage } from '@ui/avatar'
import { CustomCard } from '@ui/custom/card-containers'

export function ProfileHeaderHero({ user }: { user: User }) {
  const fullName = `${user.firstName} ${user.lastName}`
  const initials = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase()

  return (
    <CustomCard className='border-none bg-transparent p-1'>
      {/* Sección del Avatar Solapado y Datos */}
      <div className='flex flex-row items-center gap-4'>
        {/* Avatar con borde circular blanco de corte */}
        <div className='relative'>
          <Avatar className='size-20 rounded-full border-6 border-background shadow-lg ring-1 ring-border/20'>
            <AvatarImage src={user.avatar} alt={fullName} className='object-cover' />
            <AvatarFallback className='font-heading font-bold text-xl bg-secondary text-foreground'>
              {initials}
            </AvatarFallback>
          </Avatar>
          <button
            type='button'
            className='absolute bottom-0 right-0 p-1.5 rounded-full bg-primary text-white hover:bg-primary/90 transition-transform active:scale-95 shadow-md cursor-pointer border-2 border-background'
            title='Editar foto'
          >
            <Pencil size={12} />
          </button>
        </div>

        {/* Nombre y datos del atleta */}
        <div>
          <h1 className='font-heading font-bold text-foreground text-xl tracking-tight leading-tight'>{fullName}</h1>
          <p className='text-xs text-muted-foreground font-sans mt-0.5'>
            Atleta desde 2024 · @{user.nickName?.toLowerCase() ?? 'runner'}
          </p>
        </div>
      </div>
    </CustomCard>
  )
}
