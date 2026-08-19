import { BottomNavigationBar } from '@/components/layout/BottomNavigationBar'
import { ScrollArea } from '@/components/ui/scroll-area'

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className='fixed inset-0 sm:static sm:min-h-screen w-full bg-background sm:bg-black sm:flex sm:items-start sm:justify-center overflow-hidden sm:overflow-auto overscroll-none'>
      {/* Phone Shell */}
      <div className='w-full sm:max-w-97.5 h-dvh max-h-dvh flex flex-col relative overflow-hidden bg-background sm:shadow-2xl sm:border-x sm:border-border/40'>
        {/* Scrollable content */}
        <ScrollArea className='flex-1 w-full min-h-0'>
          {/* Contenido dinámico según la ruta */}
          <main className='px-4 pt-4 pb-21.5'>{children}</main>
        </ScrollArea>

        {/* Barra inferior fija */}
        <BottomNavigationBar />
      </div>
    </div>
  )
}
