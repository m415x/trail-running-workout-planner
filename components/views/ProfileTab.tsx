'use client'

import { Activity, Heart, Pencil, Settings, Footprints, Trophy, ShieldAlert, Flame, Watch } from 'lucide-react'
import { currentUser } from '@/data/data'
import { CustomCard, CustomCardInside } from '@/components/ui/custom/card-containers'
import { CardHeader } from '@/components/ui/custom/section-header'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

export function ProfileTab() {
  const fullName = `${currentUser.firstName} ${currentUser.lastName}`
  const initials = `${currentUser.firstName[0] ?? ''}${currentUser.lastName[0] ?? ''}`.toUpperCase()

  return (
    <div className='space-y-4 pb-4'>
      {/* ── Cabecera de Perfil del Atleta ── */}
      <CustomCard className='items-center text-center pt-6 pb-5'>
        <div className='relative'>
          <Avatar className='size-24 border-3 border-primary shadow-lg shadow-primary/20'>
            <AvatarImage src={currentUser.avatar} alt={fullName} className='object-cover' />
            <AvatarFallback className='font-heading font-bold text-xl bg-secondary'>{initials}</AvatarFallback>
          </Avatar>
          <button
            type='button'
            className='absolute bottom-0 right-0 p-1.5 rounded-full bg-primary text-white hover:bg-primary/90 transition-transform active:scale-95 shadow-md cursor-pointer'
            title='Editar foto'
          >
            <Pencil size={12} />
          </button>
        </div>

        <div className='mt-3'>
          <h2 className='font-heading font-bold text-foreground text-xl tracking-tight'>{fullName}</h2>
          <p className='text-xs text-primary font-medium font-sans'>
            @{currentUser.nickName?.toLowerCase() ?? 'atleta'} · Trail Runner
          </p>
        </div>

        {/* Resumen Rápido de Métricas Clave */}
        <div className='grid grid-cols-3 gap-2 w-full mt-4 pt-4 border-t border-border/60'>
          <div className='flex flex-col'>
            <span className='font-heading font-bold text-foreground text-base'>72 kg</span>
            <span className='text-[10px] text-muted-foreground font-sans uppercase'>Peso</span>
          </div>
          <div className='flex flex-col border-x border-border/60'>
            <span className='font-heading font-bold text-foreground text-base'>188 bpm</span>
            <span className='text-[10px] text-muted-foreground font-sans uppercase'>FC Máx</span>
          </div>
          <div className='flex flex-col'>
            <span className='font-heading font-bold text-foreground text-base'>54 ml/kg</span>
            <span className='text-[10px] text-muted-foreground font-sans uppercase'>VO2 Máx</span>
          </div>
        </div>
      </CustomCard>

      {/* ── Tabs de Navegación del Perfil ── */}
      <Tabs defaultValue='athlete' className='w-full'>
        <TabsList className='w-full grid grid-cols-3 bg-secondary/60 p-1 rounded-2xl h-10'>
          <TabsTrigger value='athlete' className='rounded-xl text-xs font-semibold'>
            Fisiología
          </TabsTrigger>
          <TabsTrigger value='gear' className='rounded-xl text-xs font-semibold'>
            Material
          </TabsTrigger>
          <TabsTrigger value='settings' className='rounded-xl text-xs font-semibold'>
            Ajustes
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Datos Fisiológicos & Zonas ── */}
        <TabsContent value='athlete' className='space-y-3 mt-3'>
          <CustomCard>
            <CardHeader title='Zonas Cardíacas (FC)' icon={Heart} />
            <div className='space-y-2'>
              <ZoneRow zone='Z1' name='Recuperación Activa' range='< 132 bpm' color='bg-hr-z1' />
              <ZoneRow zone='Z2' name='Base Aeróbica' range='132 – 150 bpm' color='bg-hr-z2' />
              <ZoneRow zone='Z3' name='Tempo / Ritmo' range='151 – 165 bpm' color='bg-hr-z3' />
              <ZoneRow zone='Z4' name='Umbral Anaeróbico' range='166 – 178 bpm' color='bg-hr-z4' />
              <ZoneRow zone='Z5' name='Capacidad Máxima / VO2' range='> 178 bpm' color='bg-hr-z5' />
            </div>
          </CustomCard>

          <CustomCard>
            <CardHeader title='Información Física' icon={Activity} />
            <div className='grid grid-cols-2 gap-2'>
              <MetricBox label='Altura' value='1.75 m' />
              <MetricBox label='Edad' value='40 años' />
              <MetricBox label='FC Reposo' value='46 bpm' />
              <MetricBox label='Umbral Lactato' value='172 bpm' />
            </div>
          </CustomCard>
        </TabsContent>

        {/* ── Tab 2: Material & Zapatillas ── */}
        <TabsContent value='gear' className='space-y-3 mt-3'>
          <CustomCard>
            <CardHeader title='Zapatillas en Rotación' icon={Footprints} />
            <div className='space-y-3'>
              <ShoeItem
                name='Salomon S/Lab Genesis'
                type='Competición / Terreno Técnico'
                km={248}
                maxKm={650}
                status='Óptimo'
              />
              <ShoeItem
                name='Hoka Speedgoat 5'
                type='Rodajes Largos / Amortiguación'
                km={490}
                maxKm={700}
                status='Desgaste medio'
              />
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
        </TabsContent>

        {/* ── Tab 3: Ajustes / Emergencia ── */}
        <TabsContent value='settings' className='space-y-3 mt-3'>
          <CustomCard>
            <CardHeader title='Contacto de Emergencia / Trail' icon={ShieldAlert} />
            <CustomCardInside className='space-y-2'>
              <MetricBox label='Contacto SOS' value='María Doe (+54 9 264 555-0192)' />
              <MetricBox label='Grupo Sanguíneo' value='A Positivo (A+)' />
              <MetricBox label='Seguro Médico / Federación' value='Federación Andinismo #8839' />
            </CustomCardInside>
          </CustomCard>

          <Button
            variant='outline'
            className='w-full text-xs font-semibold text-muted-foreground hover:text-foreground border-border/80 rounded-2xl h-11'
          >
            <Settings size={14} className='mr-1.5' />
            Preferencias de la Cuenta
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ── Componentes Auxiliares de Presentación ──

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className='p-2.5 rounded-xl bg-secondary/30 border border-border/40'>
      <span className='text-[10px] text-muted-foreground block font-sans uppercase font-medium'>{label}</span>
      <span className='text-xs font-heading font-semibold text-foreground mt-0.5 block'>{value}</span>
    </div>
  )
}

function ZoneRow({ zone, name, range, color }: { zone: string; name: string; range: string; color: string }) {
  return (
    <div className='flex items-center justify-between p-2 rounded-xl bg-secondary/30 border border-border/30'>
      <div className='flex items-center gap-2'>
        <span className={`text-[10px] font-heading font-bold px-1.5 py-0.5 rounded text-white ${color}`}>{zone}</span>
        <span className='text-xs font-medium text-foreground'>{name}</span>
      </div>
      <span className='font-mono text-xs text-muted-foreground'>{range}</span>
    </div>
  )
}

function ShoeItem({
  name,
  type,
  km,
  maxKm,
  status,
}: {
  name: string
  type: string
  km: number
  maxKm: number
  status: string
}) {
  const percentage = Math.min(100, Math.round((km / maxKm) * 100))

  return (
    <div className='p-3 rounded-xl bg-secondary/30 border border-border/40 space-y-2'>
      <div className='flex justify-between items-start'>
        <div>
          <p className='font-heading font-bold text-xs text-foreground'>{name}</p>
          <p className='text-[10px] text-muted-foreground'>{type}</p>
        </div>
        <span className='text-[10px] font-mono px-2 py-0.5 rounded-full bg-secondary font-semibold'>
          {km} / {maxKm} km
        </span>
      </div>

      {/* Mini barra de vida de la zapatilla */}
      <div className='space-y-1'>
        <div className='h-1.5 w-full bg-muted rounded-full overflow-hidden'>
          <div
            className={`h-full rounded-full ${percentage > 80 ? 'bg-amber-500' : 'bg-primary'}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className='flex justify-between text-[9px] text-muted-foreground'>
          <span>{status}</span>
          <span>{percentage}% usado</span>
        </div>
      </div>
    </div>
  )
}
