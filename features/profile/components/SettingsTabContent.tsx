import { ShieldAlert, Settings } from 'lucide-react'
import { CustomCard, CustomCardInside } from '@/components/ui/custom/card-containers'
import { CardHeader } from '@/components/ui/custom/section-header'
import { Button } from '@/components/ui/button'
import { MetricBox } from '@/features/profile/components/MetricBox'

export function SettingsTabContent() {
  return (
    <div className='space-y-3 mt-2'>
      <CustomCard>
        <CardHeader title='Contacto de Emergencia / Trail' icon={ShieldAlert} />
        <CustomCardInside className='space-y-2'>
          <MetricBox label='Contacto SOS' value='María Doe (+54 9 264 555-0192)' />
          <MetricBox label='Grupo Sanguíneo' value='A Positivo (A+)' />
          <MetricBox label='Seguro Médico / Federación' value='Federación de Atletismo #8839' />
        </CustomCardInside>
      </CustomCard>

      <Button
        variant='outline'
        className='w-full text-xs font-semibold text-muted-foreground hover:text-foreground border-border/80 rounded-2xl h-11'
      >
        <Settings size={14} className='mr-1.5' />
        Preferencias de la Cuenta
      </Button>
    </div>
  )
}
