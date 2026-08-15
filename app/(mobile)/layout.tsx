import { BottomNavigationBar } from '@/components/layout/BottomNavigationBar'
import { ScrollArea } from '@/components/ui/scroll-area'

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className='min-h-screen bg-black flex items-start justify-center'>
      {/* Phone Shell */}
      <div className='w-full max-w-97.5 h-dvh max-h-dvh flex flex-col relative overflow-hidden bg-background'>
        {/* Scrollable content */}
        <ScrollArea className='flex-1 w-full min-h-0'>
          {/* Contenido dinámico según la ruta */}
          <main className='px-4 pt-1 pb-21.5'>{children}</main>
        </ScrollArea>

        {/* Barra inferior fija */}
        <BottomNavigationBar />
      </div>
    </div>
  )
}
