'use client'

import { useState } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { BottomNavigationBar } from '@/components/blocks/BottomNavigationBar'
import { HomeTab } from '@/components/views/HomeTab'
import { ProfileTab } from '@/components/views/ProfileTab'

export default function DashboardView() {
  // 0 = Inicio / Dashboard, 1 = Plan / Calendario, 2 = Progreso / Stats, 3 = Perfil
  const [activeNav, setActiveNav] = useState<number>(0)

  return (
    <div className='min-h-screen bg-black flex items-start justify-center'>
      {/* Phone shell */}
      <div className='w-full max-w-97.5 min-h-screen flex flex-col relative overflow-hidden bg-background'>
        {/* Scrollable content */}
        <ScrollArea className='flex flex-1 w-full px-4 pb-21.5'>
          {/* Pestaña 0: Inicio / Dashboard */}
          {activeNav === 0 && <HomeTab />}

          {/* Pestaña 1: Plan / Calendario */}
          {activeNav === 1 && (
            <div className='text-center py-12 text-muted-foreground text-sm font-sans'>
              <p className='font-heading font-bold text-foreground text-base mb-1'>Plan Semanal</p>
              Vista de Calendario y Microciclos en desarrollo.
            </div>
          )}

          {/* Pestaña 2: Estadísticas / Progreso */}
          {activeNav === 2 && (
            <div className='text-center py-12 text-muted-foreground text-sm font-sans'>
              <p className='font-heading font-bold text-foreground text-base mb-1'>Progreso</p>
              Gráficos y volumen mensual en desarrollo.
            </div>
          )}

          {/* Pestaña 3: Perfil de Usuario */}
          {activeNav === 3 && <ProfileTab />}
        </ScrollArea>

        {/* ── Bottom Navigation Fixed / Absolute al Shell ── */}
        <BottomNavigationBar
          activeNav={activeNav}
          onNavChange={setActiveNav}
          isFixed={false} // Se posiciona absolute dentro del marco max-w-97.5
        />
      </div>
    </div>
  )
}
