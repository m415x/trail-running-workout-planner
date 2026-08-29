import { Footprints, Watch } from 'lucide-react'
import { CustomCard } from '@ui/custom/card-containers'
import { CardHeader } from '@ui/custom/section-header'
import { Button } from '@ui/button'
import { ShoeItem } from '@profile/components/ShoeItem'
import { runningShoes } from '@/data/data'

export function GearTabContent() {
  return (
    <div className='space-y-3 mt-2'>
      <CustomCard>
        <CardHeader title='Zapatillas en Rotación' icon={Footprints} />
        <div className='space-y-3'>
          {/* {runningShoes.map((shoe) => (
            <ShoeItem key={shoe.name} {...shoe} />
          ))} */}
        </div>
      </CustomCard>

      <CustomCard>
        <CardHeader title='Dispositivos Vinculados' icon={Watch} />
        <div className='space-y-2'>
          <div className='flex items-center justify-between p-2.5 rounded-xl bg-secondary/40'>
            <div className='flex items-center gap-2.5'>
              <div className='size-2 rounded-full bg-emerald-500 animate-pulse' />
              <div>
                <p className='text-xs font-semibold text-foreground'>Garmin Forerunner 965</p>
                <p className='text-[10px] text-muted-foreground'>Sincronización automática activa</p>
              </div>
            </div>
            <Button size='sm' variant='ghost' className='text-xs h-7'>
              Configurar
            </Button>
          </div>
        </div>
      </CustomCard>
    </div>
  )
}
