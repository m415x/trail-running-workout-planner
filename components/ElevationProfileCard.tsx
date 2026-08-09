'use client'

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Mountain } from 'lucide-react'

import { colors } from '@/utils/constants'
import { ElevTooltipProps, ElevationChartProps } from '@/utils/interfaces'
import { CustomCard } from '@/components/ui/custom/card-containers'
import { CardHeader } from '@/components/ui/custom/section-header'

function ElevTooltip({ active, payload, label }: ElevTooltipProps) {
  if (!active || !payload?.length) return null

  return (
    <div className='rounded-xl border border-border/50 bg-popover/90 px-3 py-2 text-xs shadow-md backdrop-blur-md'>
      <p className='text-muted-foreground'>km {label}</p>
      <p className='font-semibold text-orange-500'>{payload[0].value} m</p>
    </div>
  )
}

export function ElevationProfileCard({ workout, elevData, elevMin, elevMax, yDomain }: ElevationChartProps) {
  return (
    <CustomCard>
      <CardHeader
        title='Perfil de Elevación'
        icon={Mountain}
        action={
          <div className='flex justify-center gap-3 text-[11px]'>
            <span className='text-muted-foreground'>
              Máx <span className='text-foreground font-semibold'>{elevMax.toLocaleString()} m</span>
            </span>
            <span className='text-muted-foreground'>
              Mín <span className='text-foreground font-semibold'>{elevMin.toLocaleString()} m</span>
            </span>
          </div>
        }
      />

      <div className='h-36'>
        <ResponsiveContainer width='100%' height='100%'>
          <AreaChart data={elevData} margin={{ top: 8, right: 4, left: -28, bottom: 0 }}>
            <defs>
              <linearGradient id='elevGrad' x1='0' y1='0' x2='0' y2='1'>
                <stop offset='0%' stopColor={colors.ORANGE} stopOpacity={0.45} />
                <stop offset='100%' stopColor={colors.ORANGE} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray='3 3' stroke='rgba(255,255,255,0.04)' vertical={false} />
            <XAxis dataKey='km' tick={{ fill: '#64748B', fontSize: 9 }} tickLine={false} axisLine={false} />
            <YAxis domain={yDomain} tick={{ fill: '#64748B', fontSize: 9 }} tickLine={false} axisLine={false} />
            <Tooltip content={<ElevTooltip />} />
            <Area
              type='monotone'
              dataKey='elev'
              stroke={colors.ORANGE}
              strokeWidth={2}
              fill='url(#elevGrad)'
              dot={false}
              activeDot={{ r: 4, fill: colors.ORANGE, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Gain / km density bar */}
      <div className='flex items-center gap-2 mt-1.5'>
        <span className='text-muted-foreground text-[10px]'>0 km</span>
        <div
          className='flex-1 h-px rounded-full'
          style={{
            background: `linear-gradient(90deg, ${colors.EMERALD}50, ${colors.ORANGE}50, #EF444450)`,
          }}
        />
        <span className='text-muted-foreground text-[10px]'>{workout.km} km</span>
      </div>
    </CustomCard>
  )
}
