'use client'

import { useState, useRef, ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Camera, ChevronLeft, Pencil } from 'lucide-react'
import { UserProps } from '@/types/common.types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { SecondaryOutlineButton, GlassFilledButton, SecondaryFilledButton } from '@/components/ui/custom/buttons'

export function ProfileHeaderHero({ user }: { user: UserProps }) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Estado para la foto de portada (fallback al fondo gradiente/lila)
  const [coverImage, setCoverImage] = useState<string | null>(null)

  const fullName = `${user.firstName} ${user.lastName}`
  const initials = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase()

  const handleCoverUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const imageUrl = URL.createObjectURL(file)
      setCoverImage(imageUrl)
    }
  }

  return (
    <div className='relative -mx-4 -mt-4 mb-4 overflow-hidden rounded-b-[2rem] bg-background shadow-sm border-b border-border/40'>
      <input type='file' ref={fileInputRef} onChange={handleCoverUpload} accept='image/*' className='hidden' />

      {/* ── 1. Hero Cover Banner (Personalizable) ── */}
      <div className='relative h-40 w-full bg-linear-to-tr from-indigo-600 via-primary to-purple-500 overflow-hidden'>
        {coverImage && (
          <Image
            src={coverImage}
            alt='Foto de portada del atleta'
            fill
            priority
            sizes='(max-width: 400px) 100vw, 390px'
            className='object-cover brightness-90 transition-all duration-300'
            unoptimized={coverImage.startsWith('blob:')} // Permite previews de subidas locales en memoria
          />
        )}

        {/* Botón Volver (Estilo Pill / Glass) */}
        <GlassFilledButton onClick={() => router.back()} className='absolute top-4 left-4 size-8 rounded-full'>
          <ChevronLeft size={18} />
        </GlassFilledButton>

        {/* Botón Cambiar Portada */}
        <GlassFilledButton onClick={() => fileInputRef.current?.click()} className='absolute top-4 right-4'>
          <Camera size={13} />
          <span>Cambiar fondo</span>
        </GlassFilledButton>
      </div>

      {/* ── 2. Sección del Avatar Solapado y Datos ── */}
      <div className='px-5 pb-5 pt-0 -mt-12 relative'>
        <div className='flex justify-between items-end mb-4'>
          {/* Avatar con borde circular blanco de corte */}
          <div className='relative'>
            <Avatar className='size-24 rounded-full border-6 border-background shadow-lg ring-1 ring-border/20'>
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

          {/* Botón "Editar Perfil" */}
          <SecondaryOutlineButton>Editar Perfil</SecondaryOutlineButton>
        </div>

        {/* Nombre y datos del atleta */}
        <div>
          <h1 className='font-heading font-bold text-foreground text-xl tracking-tight leading-tight'>{fullName}</h1>
          <p className='text-xs text-muted-foreground font-sans mt-0.5'>
            Atleta desde 2024 · @{user.nickName?.toLowerCase() ?? 'runner'}
          </p>
        </div>
      </div>
    </div>
  )
}
