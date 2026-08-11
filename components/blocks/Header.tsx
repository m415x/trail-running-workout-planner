'use client'

import { Bell } from 'lucide-react'

export function Header() {
  return (
    <div className='px-5 pt-14 pb-3 flex items-center justify-between'>
      <div>
        <p className='text-muted-foreground text-[11px] font-medium tracking-widest uppercase'>
          Martes · 11 Agosto 2026
        </p>
        <h1 className='font-barlow text-foreground text-[28px] font-bold mt-0.5 leading-tight'>Hola, Cristian</h1>
      </div>
      <button className='relative p-2 rounded-2xl border border-border bg-card'>
        <Bell size={18} className='text-muted-foreground' />
        <span className='absolute top-1.5 right-1.5 w-2 h-2 rounded-full border-2 border-card bg-primary' />
      </button>
    </div>
  )
}
